[CmdletBinding()]
param(
    [switch]$Silent
)

$ErrorActionPreference = 'Stop'
$taskWatch = [Diagnostics.Stopwatch]::StartNew()
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$manifestPath = Join-Path $repositoryRoot 'dependency-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ($manifest.schemaVersion -ne 1 -or $manifest.status -ne 'active' -or $manifest.platform -ne 'win32-x64') {
    throw 'dependency-manifest.json does not describe the supported Windows x64 dependency contract.'
}
if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'The supported build requires 64-bit Windows.'
}

$localDataRoot = [Environment]::GetFolderPath('LocalApplicationData')
if ([string]::IsNullOrWhiteSpace($localDataRoot)) {
    throw 'The per-user local application-data directory could not be resolved.'
}
$toolchainRoot = [IO.Path]::GetFullPath((Join-Path $localDataRoot 'MaterialTaxReporting\toolchains'))
$downloadCache = [IO.Path]::GetFullPath((Join-Path $localDataRoot 'MaterialTaxReporting\download-cache'))
$npmCache = [IO.Path]::GetFullPath((Join-Path $localDataRoot 'MaterialTaxReporting\npm-cache'))
New-Item -ItemType Directory -Path $toolchainRoot, $downloadCache, $npmCache -Force | Out-Null

function Write-Phase([string]$Message) {
    if (-not $Silent) { Write-Host $Message }
}

function Get-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

function Assert-OwnedTemporaryPath([string]$Path, [string]$Parent) {
    $resolvedPath = [IO.Path]::GetFullPath($Path)
    $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    if (-not $resolvedPath.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify temporary path outside the expected per-user directory: $resolvedPath"
    }
}

function Install-VerifiedArchive {
    param(
        [Parameter(Mandatory)]$Entry,
        [Parameter(Mandatory)][string]$Destination,
        [Parameter(Mandatory)][string]$RequiredRelativePath
    )

    $requiredPath = Join-Path $Destination $RequiredRelativePath
    if (Test-Path -LiteralPath $requiredPath -PathType Leaf) {
        Write-Phase "Dependency $($Entry.id) $($Entry.version): already installed at $Destination"
        return
    }

    $archivePath = Join-Path $downloadCache $Entry.archive
    $partialPath = "$archivePath.partial"
    $stagingPath = Join-Path $toolchainRoot ('.stage-' + $Entry.id + '-' + [Guid]::NewGuid().ToString('N'))
    Assert-OwnedTemporaryPath -Path $partialPath -Parent $downloadCache
    Assert-OwnedTemporaryPath -Path $stagingPath -Parent $toolchainRoot

    try {
        Write-Phase "Dependency $($Entry.id) $($Entry.version): downloading from $($Entry.url)"
        Invoke-WebRequest -UseBasicParsing -Uri $Entry.url -OutFile $partialPath
        $actualHash = Get-Sha256 -Path $partialPath
        if ($actualHash -ne $Entry.sha256) {
            throw "Dependency $($Entry.id) $($Entry.version) SHA-256 mismatch. Expected $($Entry.sha256); received $actualHash from $($Entry.url)."
        }

        New-Item -ItemType Directory -Path $stagingPath -Force | Out-Null
        Expand-Archive -LiteralPath $partialPath -DestinationPath $stagingPath -Force

        $candidateRoot = $stagingPath
        $topLevel = @(Get-ChildItem -LiteralPath $stagingPath -Force)
        if ($topLevel.Count -eq 1 -and $topLevel[0].PSIsContainer) {
            $candidateRoot = $topLevel[0].FullName
        }
        if (-not (Test-Path -LiteralPath (Join-Path $candidateRoot $RequiredRelativePath) -PathType Leaf)) {
            throw "Dependency $($Entry.id) $($Entry.version) did not contain $RequiredRelativePath."
        }

        if (Test-Path -LiteralPath $Destination) {
            Assert-OwnedTemporaryPath -Path $Destination -Parent $toolchainRoot
            Remove-Item -LiteralPath $Destination -Recurse -Force
        }
        New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
        Move-Item -LiteralPath $candidateRoot -Destination $Destination
        Write-Phase "Dependency $($Entry.id) $($Entry.version): installed at $Destination"
    }
    finally {
        if (Test-Path -LiteralPath $partialPath) { Remove-Item -LiteralPath $partialPath -Force }
        if (Test-Path -LiteralPath $stagingPath) {
            Assert-OwnedTemporaryPath -Path $stagingPath -Parent $toolchainRoot
            Remove-Item -LiteralPath $stagingPath -Recurse -Force
        }
    }
}

$node = @($manifest.toolchains | Where-Object id -eq 'node')
$git = @($manifest.binaries | Where-Object id -eq 'git')
if ($node.Count -ne 1 -or $git.Count -ne 1) {
    throw 'The dependency manifest must declare exactly one Node.js toolchain and one Git binary.'
}

$nodeRoot = Join-Path $toolchainRoot ("node-$($node[0].version)")
$gitRoot = Join-Path $toolchainRoot ("git-$($git[0].version)")
Install-VerifiedArchive -Entry $node[0] -Destination $nodeRoot -RequiredRelativePath 'node.exe'
Install-VerifiedArchive -Entry $git[0] -Destination $gitRoot -RequiredRelativePath 'cmd\git.exe'

$nodeExe = Join-Path $nodeRoot 'node.exe'
$npmCmd = Join-Path $nodeRoot 'npm.cmd'
$gitExe = Join-Path $gitRoot 'cmd\git.exe'
$nodeVersion = (& $nodeExe --version).TrimStart('v').Trim()
$npmVersion = (& $npmCmd --version).Trim()
$gitVersion = (& $gitExe --version).Trim()
if ($nodeVersion -ne $node[0].version) { throw "Node.js version mismatch: expected $($node[0].version), received $nodeVersion." }
if ($npmVersion -ne $node[0].bundledNpmVersion) { throw "npm version mismatch: expected $($node[0].bundledNpmVersion), received $npmVersion." }
if (-not $gitVersion.Contains($git[0].version)) { throw "Git version mismatch: expected $($git[0].version), received $gitVersion." }
Write-Phase "Toolchain ready: Node.js $nodeVersion, npm $npmVersion, $gitVersion"

$lockPath = Join-Path $repositoryRoot 'package-lock.json'
$lockHash = Get-Sha256 -Path $lockPath
$markerPath = Join-Path $repositoryRoot 'node_modules\.mtr-dependencies.sha256'
$requiredPackages = @(
    'node_modules\electron\dist\electron.exe',
    'node_modules\electron\package.json',
    'node_modules\electron-builder\package.json',
    'node_modules\electron-builder-squirrel-windows\package.json',
    'node_modules\png-to-ico\package.json',
    'node_modules\sharp\package.json'
)
$warmInstall = (Test-Path -LiteralPath $markerPath -PathType Leaf) -and
    ((Get-Content -LiteralPath $markerPath -Raw).Trim() -eq $lockHash)
foreach ($relativePath in $requiredPackages) {
    if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot $relativePath) -PathType Leaf)) {
        $warmInstall = $false
    }
}
$expectedPackageVersions = @{}
foreach ($dependency in @($manifest.dependencies)) { $expectedPackageVersions[$dependency.name] = $dependency.version }
foreach ($packageName in $expectedPackageVersions.Keys) {
    $packageManifestPath = Join-Path $repositoryRoot ("node_modules\$packageName\package.json")
    if (-not (Test-Path -LiteralPath $packageManifestPath -PathType Leaf)) {
        $warmInstall = $false
        continue
    }
    $installedPackage = Get-Content -LiteralPath $packageManifestPath -Raw | ConvertFrom-Json
    if ($installedPackage.version -ne $expectedPackageVersions[$packageName]) { $warmInstall = $false }
}

if ($warmInstall) {
    Write-Phase 'Package dependencies: verified warm installation matches package-lock.json.'
} else {
    Write-Phase 'Package dependencies: installing the exact package-lock.json graph.'
    $previousLocation = Get-Location
    try {
        Set-Location -LiteralPath $repositoryRoot
        $env:npm_config_cache = $npmCache
        $env:npm_config_audit = 'false'
        $env:npm_config_fund = 'false'
        $env:npm_config_update_notifier = 'false'
        $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
        $env:CSC_LINK = ''
        $env:WIN_CSC_LINK = ''
        $env:CSC_KEY_PASSWORD = ''
        & $npmCmd ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci exited with code $LASTEXITCODE while installing package-lock.json."
        }
    }
    finally {
        Set-Location -LiteralPath $previousLocation
    }
    foreach ($relativePath in $requiredPackages) {
        if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot $relativePath) -PathType Leaf)) {
            throw "The package installation completed without required file $relativePath."
        }
    }
    foreach ($packageName in $expectedPackageVersions.Keys) {
        $installedPackage = Get-Content -LiteralPath (Join-Path $repositoryRoot ("node_modules\$packageName\package.json")) -Raw | ConvertFrom-Json
        if ($installedPackage.version -ne $expectedPackageVersions[$packageName]) {
            throw "Installed package $packageName has version $($installedPackage.version), expected $($expectedPackageVersions[$packageName])."
        }
    }
    $lockHash | Set-Content -LiteralPath $markerPath -Encoding ascii -NoNewline
    Write-Phase 'Package dependencies: exact locked graph installed and verified.'
}

$taskWatch.Stop()
Write-Host ("Dependency bootstrap complete in {0:n1} seconds." -f $taskWatch.Elapsed.TotalSeconds)
