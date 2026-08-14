[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Repository,
    [Parameter(Mandatory)][string]$CommitSha,
    [Parameter(Mandatory)][string]$Tag,
    [Parameter(Mandatory)][string]$Version,
    [Parameter(Mandatory)][string]$WorkflowStartedAt,
    [Parameter(Mandatory)][string]$DimSumPath
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$releaseRoot = Join-Path $repositoryRoot 'dist\squirrel-windows'
$manifestPath = Join-Path $releaseRoot 'release-manifest.json'
$lineCountPath = Join-Path $releaseRoot 'line-count.md'
$releaseTemplatePath = Join-Path $repositoryRoot 'CHANGELOG.release.md'

if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Repository must be an owner/name identifier.' }
if ($CommitSha -notmatch '^[0-9a-f]{40}$') { throw 'CommitSha must be a full lowercase SHA-1.' }
if ($Tag -ne "v$Version" -or $Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Tag and Version do not form the expected semantic release identity.' }
if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) { throw 'GH_TOKEN is required through the release-token fallback chain.' }
foreach ($requiredPath in @($manifestPath, $lineCountPath, $releaseTemplatePath, $DimSumPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) { throw "Required release input is missing: $requiredPath" }
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or $manifest.sourceCommit -ne $CommitSha -or $manifest.packageVersion -ne $Version) {
    throw 'The release manifest does not match the requested source commit and package version.'
}
if ($manifest.signatureStatus -ne 'NotSigned' -or $manifest.installer -ne 'Squirrel.Windows') {
    throw 'The release manifest does not describe the required unsigned Squirrel.Windows package.'
}

$primaryAssets = @()
$requiredKinds = @('setup', 'release-index', 'full-package', 'application-icon')
foreach ($kind in $requiredKinds) {
    $records = @($manifest.artifacts | Where-Object kind -eq $kind)
    if ($records.Count -ne 1) { throw "The release manifest requires exactly one $kind artifact." }
}
foreach ($artifact in @($manifest.artifacts)) {
    if ($artifact.kind -notin @($requiredKinds + 'delta-package')) { throw "Unexpected release artifact kind $($artifact.kind)." }
    $assetPath = Join-Path $releaseRoot $artifact.name
    $item = Get-Item -LiteralPath $assetPath
    $actualHash = (Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($item.Length -le 0 -or $item.Length -ne $artifact.bytes -or $actualHash -ne $artifact.sha256) {
        throw "Release artifact validation failed for $($artifact.name)."
    }
    $primaryAssets += $assetPath
}

$existingTag = git -C $repositoryRoot ls-remote --tags origin "refs/tags/$Tag"
if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace(($existingTag -join ''))) {
    throw "Release tag $Tag already exists; immutable release identities are never reused."
}

$dimSum = Get-Content -LiteralPath $DimSumPath -Raw | ConvertFrom-Json
$title = "Material Tax Reporting $Tag"
if ($dimSum.available) { $title = "$title - $($dimSum.codeName)" }
$initialNotes = @(
    'Unsigned Squirrel.Windows release. Code signing is permanently disabled.'
    ''
    "Source commit: ``$CommitSha``"
    'Release evidence is being finalized by the same workflow run.'
) -join "`n"

$createArguments = @('release', 'create', $Tag, '--repo', $Repository, '--target', $CommitSha, '--title', $title, '--notes', $initialNotes, '--draft')
$createArguments += $primaryAssets
& gh @createArguments
if ($LASTEXITCODE -ne 0) { throw "Creating the draft release failed with exit code $LASTEXITCODE." }

& gh release edit $Tag --repo $Repository --draft=false
if ($LASTEXITCODE -ne 0) { throw "Publishing release $Tag failed with exit code $LASTEXITCODE." }

$release = (& gh release view $Tag --repo $Repository --json tagName,isDraft,isPrerelease,publishedAt,targetCommitish,url,assets) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $release.isDraft -or $release.isPrerelease -or $release.tagName -ne $Tag) {
    throw 'The published release is missing, draft, prerelease, or has the wrong tag.'
}
$started = [DateTimeOffset]::Parse($WorkflowStartedAt).ToUniversalTime()
$published = [DateTimeOffset]::Parse($release.publishedAt).ToUniversalTime()
$duration = $published - $started
if ($duration.TotalSeconds -lt 0) { throw 'The release publication timestamp precedes the workflow start.' }
$durationText = '{0:00}:{1:00}:{2:00}' -f [Math]::Floor($duration.TotalHours), $duration.Minutes, $duration.Seconds

$timingPath = Join-Path $releaseRoot 'workflow-timing.json'
$timing = [ordered]@{
    schemaVersion = 1
    workflowStarted = $started.ToString('yyyy-MM-ddTHH:mm:ssZ')
    workflowCompleted = $published.ToString('yyyy-MM-ddTHH:mm:ssZ')
    workflowDuration = $durationText
    workflowRun = "$env:GITHUB_SERVER_URL/$Repository/actions/runs/$env:GITHUB_RUN_ID"
}
$timing | ConvertTo-Json | Set-Content -LiteralPath $timingPath -Encoding utf8

$dishLines = if ($dimSum.available) {
    @(
        "Dim sum code name: $($dimSum.codeName)"
        "Public dish photo: [$($dimSum.assetName)]($($dimSum.photoUrl))"
        "Public catalog: $($dimSum.catalogUrl)"
    )
} else {
    @(
        'Dim sum code name: unavailable'
        "Public dish photo: unavailable - $($dimSum.reason)"
        "Public catalog: $($dimSum.catalogUrl)"
    )
}
$releaseNotesPath = Join-Path $releaseRoot 'release-notes.md'
$notes = @(
    (Get-Content -LiteralPath $releaseTemplatePath -Raw).Trim()
    ''
    '## Release evidence'
    ''
    "- Version: ``$Version``"
    "- Source commit: ``$CommitSha``"
    "- Workflow run: $env:GITHUB_SERVER_URL/$Repository/actions/runs/$env:GITHUB_RUN_ID"
    "- Workflow started: $($started.ToString('yyyy-MM-ddTHH:mm:ssZ'))"
    "- Workflow completed: $($published.ToString('yyyy-MM-ddTHH:mm:ssZ'))"
    "- Workflow duration: $durationText"
    '- Installer: unsigned Squirrel.Windows Setup.exe with RELEASES, a full package, and any generated delta packages.'
    '- Signing: NotSigned. Windows may show an unknown-publisher or SmartScreen warning.'
    '- Automated checks: no tests, lint, type checks, security scans, accessibility checks, or screenshots ran in this release workflow.'
    ''
    ($dishLines | ForEach-Object { "- $_" })
    ''
    (Get-Content -LiteralPath $lineCountPath -Raw).Trim()
  ) -join "`n"
$notes | Set-Content -LiteralPath $releaseNotesPath -Encoding utf8

$hashInputs = @($primaryAssets + $lineCountPath + $timingPath + $releaseNotesPath)
$hashPath = Join-Path $releaseRoot 'SHA256SUMS.txt'
$hashLines = foreach ($assetPath in $hashInputs) {
    $hash = (Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([IO.Path]::GetFileName($assetPath))"
}
$hashLines | Set-Content -LiteralPath $hashPath -Encoding ascii

$evidenceAssets = @($hashPath, $timingPath, $lineCountPath, $releaseNotesPath)
& gh release upload $Tag @evidenceAssets --repo $Repository
if ($LASTEXITCODE -ne 0) { throw "Uploading release evidence failed with exit code $LASTEXITCODE." }
& gh release edit $Tag --repo $Repository --notes-file $releaseNotesPath
if ($LASTEXITCODE -ne 0) { throw "Finalizing release notes failed with exit code $LASTEXITCODE." }

$tagReference = (& gh api "repos/$Repository/git/ref/tags/$Tag") | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "The published tag $Tag could not be resolved." }
$resolvedSha = $tagReference.object.sha
if ($tagReference.object.type -eq 'tag') {
    $tagObject = (& gh api "repos/$Repository/git/tags/$resolvedSha") | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Annotated tag $Tag could not be peeled." }
    $resolvedSha = $tagObject.object.sha
}
if ($resolvedSha -ne $CommitSha) { throw "Release tag $Tag resolves to $resolvedSha instead of $CommitSha." }

$finalRelease = (& gh release view $Tag --repo $Repository --json tagName,isDraft,isPrerelease,targetCommitish,url,assets) | ConvertFrom-Json
if ($finalRelease.isDraft -or $finalRelease.isPrerelease -or $finalRelease.tagName -ne $Tag) { throw 'Final release state is not a unique non-draft release.' }
$expectedNames = @($manifest.artifacts.name + @('SHA256SUMS.txt', 'workflow-timing.json', 'line-count.md', 'release-notes.md'))
foreach ($expectedName in $expectedNames) {
    $matches = @($finalRelease.assets | Where-Object name -eq $expectedName)
    if ($matches.Count -ne 1 -or $matches[0].size -le 0 -or [string]::IsNullOrWhiteSpace($matches[0].url)) {
        throw "Published release asset $expectedName is missing, duplicated, empty, or lacks a download URL."
    }
}
Write-Host "Published release: $($finalRelease.url)"
Write-Host "Published source commit: $resolvedSha"
Write-Host "Published assets: $($expectedNames -join ', ')"

