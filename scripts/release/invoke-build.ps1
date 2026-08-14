[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Application', 'Installer', 'Run')]
    [string]$Mode,
    [switch]$Silent
)

$ErrorActionPreference = 'Stop'
$totalWatch = [Diagnostics.Stopwatch]::StartNew()
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$manifest = Get-Content -LiteralPath (Join-Path $repositoryRoot 'dependency-manifest.json') -Raw | ConvertFrom-Json
$node = @($manifest.toolchains | Where-Object id -eq 'node')
$git = @($manifest.binaries | Where-Object id -eq 'git')
if ($node.Count -ne 1 -or $git.Count -ne 1) { throw 'The dependency manifest is missing the pinned Node.js or Git entry.' }

$localDataRoot = [Environment]::GetFolderPath('LocalApplicationData')
$toolchainRoot = Join-Path $localDataRoot 'MaterialTaxReporting\toolchains'
$nodeExe = Join-Path $toolchainRoot ("node-$($node[0].version)\node.exe")
$npmCmd = Join-Path $toolchainRoot ("node-$($node[0].version)\npm.cmd")
$gitExe = Join-Path $toolchainRoot ("git-$($git[0].version)\cmd\git.exe")
foreach ($requiredTool in @($nodeExe, $npmCmd, $gitExe)) {
    if (-not (Test-Path -LiteralPath $requiredTool -PathType Leaf)) { throw "Required bootstrapped tool is missing: $requiredTool" }
}
$env:PATH = ((Split-Path -Parent $gitExe), (Split-Path -Parent $nodeExe), $env:PATH) -join ';'

function Write-Phase([string]$Message) {
    if (-not $Silent) { Write-Host $Message }
}

function Assert-GeneratedDirectory([string]$Path, [string]$ExpectedRelativePath) {
    $expected = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $ExpectedRelativePath)).TrimEnd('\')
    $actual = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    if (-not $actual.Equals($expected, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clear unexpected generated directory: $actual"
    }
}

function Get-SourceCommit {
    $commit = (& $gitExe -C $repositoryRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[0-9a-f]{40}$') {
        throw 'The source commit could not be resolved from the current checkout.'
    }
    return $commit
}

function Invoke-DesktopBuild {
    $phaseWatch = [Diagnostics.Stopwatch]::StartNew()
    $desktopDist = Join-Path $repositoryRoot 'apps\desktop\dist'
    Assert-GeneratedDirectory -Path $desktopDist -ExpectedRelativePath 'apps\desktop\dist'
    if (Test-Path -LiteralPath $desktopDist) { Remove-Item -LiteralPath $desktopDist -Recurse -Force }
    $startedAt = [DateTimeOffset]::UtcNow
    $sourceCommit = Get-SourceCommit
    Write-Phase "Application build: cleared stale output and pinned source commit $sourceCommit."

    $previousLocation = Get-Location
    try {
        Set-Location -LiteralPath $repositoryRoot
        & $npmCmd run build:desktop
        if ($LASTEXITCODE -ne 0) { throw "The desktop workspace build exited with code $LASTEXITCODE." }
    }
    finally {
        Set-Location -LiteralPath $previousLocation
    }

    $expectedOutputs = @(
        'apps\desktop\dist\main\main.js',
        'apps\desktop\dist\preload\index.cjs',
        'apps\desktop\dist\renderer\index.html'
    )
    $outputRecords = @()
    foreach ($relativePath in $expectedOutputs) {
        $fullPath = Join-Path $repositoryRoot $relativePath
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Required desktop build output is missing: $relativePath" }
        $item = Get-Item -LiteralPath $fullPath
        if ($item.Length -le 0 -or $item.LastWriteTimeUtc -lt $startedAt.UtcDateTime) {
            throw "Desktop build output is empty or stale: $relativePath"
        }
        $outputRecords += [ordered]@{
            path = $relativePath.Replace('\', '/')
            bytes = $item.Length
            sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    $provenance = [ordered]@{
        schemaVersion = 1
        sourceCommit = $sourceCommit
        builtAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        outputs = $outputRecords
    }
    $provenancePath = Join-Path $desktopDist 'build-provenance.json'
    $temporaryProvenance = "$provenancePath.tmp"
    $provenanceJson = $provenance | ConvertTo-Json -Depth 5
    [IO.File]::WriteAllText($temporaryProvenance, $provenanceJson + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryProvenance -Destination $provenancePath -Force
    $phaseWatch.Stop()
    Write-Host ("Application build complete for {0} in {1:n1} seconds." -f $sourceCommit, $phaseWatch.Elapsed.TotalSeconds)
}

function Assert-CurrentBuildProvenance {
    $provenancePath = Join-Path $repositoryRoot 'apps\desktop\dist\build-provenance.json'
    if (-not (Test-Path -LiteralPath $provenancePath -PathType Leaf)) { throw 'Desktop build provenance is missing.' }
    $provenance = Get-Content -LiteralPath $provenancePath -Raw | ConvertFrom-Json
    $sourceCommit = Get-SourceCommit
    if ($provenance.schemaVersion -ne 1 -or $provenance.sourceCommit -ne $sourceCommit) {
        throw "Desktop build provenance does not match source commit $sourceCommit."
    }
    foreach ($output in @($provenance.outputs)) {
        $fullPath = Join-Path $repositoryRoot $output.path
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Provenance output is missing: $($output.path)" }
        $actualHash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $output.sha256) { throw "Provenance hash mismatch for $($output.path)." }
    }
    return $provenance
}

switch ($Mode) {
    'Application' {
        Invoke-DesktopBuild
    }
    'Installer' {
        Invoke-DesktopBuild
        $provenance = Assert-CurrentBuildProvenance
        $phaseWatch = [Diagnostics.Stopwatch]::StartNew()
        Write-Phase "Installer build: packaging source commit $($provenance.sourceCommit) with unsigned Squirrel.Windows."
        $previousLocation = Get-Location
        try {
            Set-Location -LiteralPath $repositoryRoot
            $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
            $env:CSC_LINK = ''
            $env:WIN_CSC_LINK = ''
            $env:CSC_KEY_PASSWORD = ''
            & $npmCmd run package:windows
            if ($LASTEXITCODE -ne 0) { throw "The unsigned Squirrel.Windows package command exited with code $LASTEXITCODE." }
        }
        finally {
            Set-Location -LiteralPath $previousLocation
        }

        $releaseManifestPath = Join-Path $repositoryRoot 'dist\squirrel-windows\release-manifest.json'
        if (-not (Test-Path -LiteralPath $releaseManifestPath -PathType Leaf)) { throw 'The packaging manifest was not produced.' }
        $releaseManifest = Get-Content -LiteralPath $releaseManifestPath -Raw | ConvertFrom-Json
        if ($releaseManifest.sourceCommit -ne $provenance.sourceCommit -or $releaseManifest.signatureStatus -ne 'NotSigned') {
            throw 'The packaging manifest has the wrong source commit or signing state.'
        }
        $setupRecord = @($releaseManifest.artifacts | Where-Object kind -eq 'setup')
        if ($setupRecord.Count -ne 1) { throw 'The packaging manifest must contain exactly one Setup.exe.' }
        $setupPath = Join-Path $repositoryRoot ("dist\squirrel-windows\" + $setupRecord[0].name)
        $setupHash = (Get-FileHash -LiteralPath $setupPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($setupHash -ne $setupRecord[0].sha256) { throw 'The reported Setup.exe SHA-256 does not match the built file.' }
        $phaseWatch.Stop()
        Write-Host ("Unsigned installer build complete in {0:n1} seconds." -f $phaseWatch.Elapsed.TotalSeconds)
        Write-Host "Installer path: $setupPath"
        Write-Host "Installer SHA-256: $setupHash"
        Write-Host 'Signing status: NotSigned. Windows may show an unknown-publisher or SmartScreen warning.'
    }
    'Run' {
        [void](Assert-CurrentBuildProvenance)
        $previousLocation = Get-Location
        try {
            Set-Location -LiteralPath $repositoryRoot
            & $npmCmd run start --workspace '@material-tax-reporting/desktop'
            if ($LASTEXITCODE -ne 0) { throw "The desktop start command exited with code $LASTEXITCODE." }
        }
        finally {
            Set-Location -LiteralPath $previousLocation
        }
    }
}

$totalWatch.Stop()
Write-Host ("Requested operation finished in {0:n1} seconds." -f $totalWatch.Elapsed.TotalSeconds)
