[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$DestinationRoot
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$manifest = Get-Content -LiteralPath (Join-Path $repositoryRoot 'dependency-manifest.json') -Raw | ConvertFrom-Json
$entry = @($manifest.binaries | Where-Object id -eq 'github-cli')
if ($entry.Count -ne 1) { throw 'The dependency manifest must declare exactly one GitHub CLI binary.' }

$destinationRootResolved = [IO.Path]::GetFullPath($DestinationRoot)
$destination = Join-Path $destinationRootResolved ("gh-$($entry[0].version)")
$ghPath = Join-Path $destination 'bin\gh.exe'
if (-not (Test-Path -LiteralPath $ghPath -PathType Leaf)) {
    New-Item -ItemType Directory -Path $destinationRootResolved -Force | Out-Null
    $archivePath = Join-Path $destinationRootResolved $entry[0].archive
    $partialPath = "$archivePath.partial"
    $stagingPath = Join-Path $destinationRootResolved ('.gh-stage-' + [Guid]::NewGuid().ToString('N'))
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $entry[0].url -OutFile $partialPath
        $actualHash = (Get-FileHash -LiteralPath $partialPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $entry[0].sha256) {
            throw "GitHub CLI SHA-256 mismatch. Expected $($entry[0].sha256); received $actualHash."
        }
        New-Item -ItemType Directory -Path $stagingPath -Force | Out-Null
        Expand-Archive -LiteralPath $partialPath -DestinationPath $stagingPath -Force
        # The Windows GitHub CLI archive keeps bin\gh.exe at its root beside LICENSE,
        # while other platform archives nest that same layout inside one versioned
        # directory. Accept either shape instead of assuming the nested one.
        $candidateRoot = $stagingPath
        $topLevel = @(Get-ChildItem -LiteralPath $stagingPath -Force)
        if ($topLevel.Count -eq 1 -and $topLevel[0].PSIsContainer) {
            $candidateRoot = $topLevel[0].FullName
        }
        if (-not (Test-Path -LiteralPath (Join-Path $candidateRoot 'bin\gh.exe') -PathType Leaf)) {
            $observed = ($topLevel | ForEach-Object { $_.Name }) -join ', '
            throw "The GitHub CLI archive did not contain bin\gh.exe. Top-level archive entries: $observed"
        }
        if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Move-Item -LiteralPath $candidateRoot -Destination $destination
    }
    finally {
        if (Test-Path -LiteralPath $partialPath) { Remove-Item -LiteralPath $partialPath -Force }
        if (Test-Path -LiteralPath $stagingPath) { Remove-Item -LiteralPath $stagingPath -Recurse -Force }
    }
}

$reportedVersion = (& $ghPath --version | Select-Object -First 1)
if ($reportedVersion -notmatch [Regex]::Escape($entry[0].version)) {
    throw "GitHub CLI version mismatch: expected $($entry[0].version); received $reportedVersion."
}
Write-Output (Split-Path -Parent $ghPath)

