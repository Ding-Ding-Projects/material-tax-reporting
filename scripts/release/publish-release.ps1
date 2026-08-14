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
$started = [DateTimeOffset]::Parse($WorkflowStartedAt).ToUniversalTime()
$timingCaptured = [DateTimeOffset]::UtcNow
$prepublicationElapsed = $timingCaptured - $started
if ($prepublicationElapsed.TotalSeconds -lt 0) { throw 'The timing evidence timestamp precedes the workflow start.' }
$prepublicationDuration = '{0:00}:{1:00}:{2:00}' -f [Math]::Floor($prepublicationElapsed.TotalHours), $prepublicationElapsed.Minutes, $prepublicationElapsed.Seconds
$timingLimitation = 'The exact publication-completion timestamp is returned only after the final draft-to-public transition. This atomic publication path performs no post-publication mutation, so completion and end-to-end duration remain absent from embedded assets and are reported only in the workflow log after publication.'

$timingPath = Join-Path $releaseRoot 'workflow-timing.json'
$timing = [ordered]@{
    schemaVersion = 1
    workflowStarted = $started.ToString('yyyy-MM-ddTHH:mm:ssZ')
    prepublicationEvidenceTimestamp = $timingCaptured.ToString('yyyy-MM-ddTHH:mm:ssZ')
    prepublicationElapsed = $prepublicationDuration
    publicationCompleted = $null
    workflowDuration = $null
    workflowRun = "$env:GITHUB_SERVER_URL/$Repository/actions/runs/$env:GITHUB_RUN_ID"
    limitation = $timingLimitation
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
    "- Prepublication evidence timestamp: $($timingCaptured.ToString('yyyy-MM-ddTHH:mm:ssZ'))"
    "- Prepublication elapsed time: $prepublicationDuration"
    '- Workflow completed: not embedded; publication occurs only after this complete draft is read back.'
    '- Workflow duration: not embedded; exact completion is reported in the workflow log after the single public-state transition.'
    "- Timing limitation: $timingLimitation"
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
$allAssets = @($primaryAssets + $evidenceAssets)
$expectedNames = @($manifest.artifacts.name + @('SHA256SUMS.txt', 'workflow-timing.json', 'line-count.md', 'release-notes.md'))
$createArguments = @('release', 'create', $Tag, '--repo', $Repository, '--target', $CommitSha, '--title', $title, '--notes-file', $releaseNotesPath, '--draft')
$createArguments += $allAssets
& gh @createArguments
if ($LASTEXITCODE -ne 0) { throw "Creating the complete draft release failed with exit code $LASTEXITCODE." }

$releasePages = (& gh api --paginate --slurp "repos/$Repository/releases?per_page=100") | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'The draft release inventory could not be read back.' }
$releaseInventory = @()
foreach ($page in @($releasePages)) { $releaseInventory += @($page) }
$draftMatches = @($releaseInventory | Where-Object tag_name -eq $Tag)
if ($draftMatches.Count -ne 1) { throw "Expected exactly one draft record for $Tag; received $($draftMatches.Count)." }
$draft = $draftMatches[0]
if (-not $draft.draft -or $draft.prerelease -or $draft.target_commitish -ne $CommitSha) {
    throw 'The private release record is not a draft, is a prerelease, or targets the wrong commit.'
}
$normalizedDraftBody = ([string]$draft.body).Replace("`r`n", "`n").Trim()
$normalizedExpectedBody = ([string]$notes).Replace("`r`n", "`n").Trim()
if ($normalizedDraftBody -ne $normalizedExpectedBody) { throw 'The complete draft notes did not read back byte-for-text equivalent.' }

$readbackRoot = Join-Path $releaseRoot '.draft-readback'
$expectedReadbackRoot = [IO.Path]::GetFullPath((Join-Path $releaseRoot '.draft-readback'))
if ([IO.Path]::GetFullPath($readbackRoot) -ne $expectedReadbackRoot) { throw 'The draft readback path is outside the release directory.' }
if (Test-Path -LiteralPath $readbackRoot) { Remove-Item -LiteralPath $readbackRoot -Recurse -Force }
New-Item -ItemType Directory -Path $readbackRoot -Force | Out-Null
try {
    foreach ($expectedName in $expectedNames) {
        $matches = @($draft.assets | Where-Object name -eq $expectedName)
        if ($matches.Count -ne 1 -or $matches[0].size -le 0 -or [string]::IsNullOrWhiteSpace($matches[0].url)) {
            throw "Draft release asset $expectedName is missing, duplicated, empty, or lacks an API URL."
        }
        $sourcePath = Join-Path $releaseRoot $expectedName
        $readbackPath = Join-Path $readbackRoot $expectedName
        $headers = @{
            Accept = 'application/octet-stream'
            Authorization = "Bearer $env:GH_TOKEN"
            'X-GitHub-Api-Version' = '2022-11-28'
            'User-Agent' = 'material-tax-reporting-release'
        }
        Invoke-WebRequest -UseBasicParsing -Uri $matches[0].url -Headers $headers -OutFile $readbackPath
        $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
        $readbackHash = (Get-FileHash -LiteralPath $readbackPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($sourceHash -ne $readbackHash) { throw "Draft release asset $expectedName failed authenticated hash readback." }
    }
}
finally {
    if (Test-Path -LiteralPath $readbackRoot) { Remove-Item -LiteralPath $readbackRoot -Recurse -Force }
}

$publishedRecord = (& gh api --method PATCH "repos/$Repository/releases/$($draft.id)" -F draft=false) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Publishing the verified complete draft $Tag failed with exit code $LASTEXITCODE." }
if ($publishedRecord.draft -or $publishedRecord.prerelease -or $publishedRecord.tag_name -ne $Tag -or -not $publishedRecord.published_at) {
    throw 'The single final public-state transition did not return the expected published release.'
}
$published = [DateTimeOffset]::Parse($publishedRecord.published_at).ToUniversalTime()
$duration = $published - $started
if ($duration.TotalSeconds -lt 0) { throw 'The release publication timestamp precedes the workflow start.' }
$durationText = '{0:00}:{1:00}:{2:00}' -f [Math]::Floor($duration.TotalHours), $duration.Minutes, $duration.Seconds

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
foreach ($expectedName in $expectedNames) {
    $matches = @($finalRelease.assets | Where-Object name -eq $expectedName)
    if ($matches.Count -ne 1 -or $matches[0].size -le 0 -or [string]::IsNullOrWhiteSpace($matches[0].url)) {
        throw "Published release asset $expectedName is missing, duplicated, empty, or lacks a download URL."
    }
}
Write-Host "Published release: $($finalRelease.url)"
Write-Host "Published source commit: $resolvedSha"
Write-Host "Publication completed: $($published.ToString('yyyy-MM-ddTHH:mm:ssZ'))"
Write-Host "Exact end-to-end duration: $durationText"
Write-Host 'The exact completion timestamp and duration are intentionally log-only because the release is not mutated after publication.'
Write-Host "Published assets: $($expectedNames -join ', ')"
