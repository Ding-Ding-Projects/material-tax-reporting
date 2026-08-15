# Resolves the validated public dim-sum photo into a release asset.
#
# The release contract requires every release to attach a real dish photograph,
# and it equally requires that a missing photograph never blocks an installer
# from shipping. Those two rules meet here, so this file is deliberately total:
# no photo problem throws. Every failure degrades to an unavailable result
# carrying the exact reason, which the release notes then state plainly.
#
# The selector already downloaded and structurally validated the bytes. This
# re-checks them at the attach boundary rather than trusting that record,
# because the file crosses a build and an installer packaging step in between.
# The recorded hash proves the bytes are the ones that were validated; the
# envelope check proves the file on disk is still a complete image.
#
# Dot-source this file to use Resolve-DimSumReleasePhoto.

$script:DimSumPhotoEnvelopes = @{
    'png' = [pscustomobject]@{
        MediaType = 'image/png'
        Head      = [byte[]]@(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        Tail      = [byte[]]@(0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82)
    }
    'jpeg' = [pscustomobject]@{
        MediaType = 'image/jpeg'
        Head      = [byte[]]@(0xFF, 0xD8, 0xFF)
        Tail      = [byte[]]@(0xFF, 0xD9)
    }
}

function Read-DimSumFileSegment {
    param(
        [Parameter(Mandatory)][IO.FileStream]$Stream,
        [Parameter(Mandatory)][int]$Count
    )
    $buffer = New-Object byte[] $Count
    $filled = 0
    while ($filled -lt $Count) {
        $read = $Stream.Read($buffer, $filled, $Count - $filled)
        if ($read -le 0) { throw "the file ended after $filled of $Count expected bytes" }
        $filled += $read
    }
    return $buffer
}

function Test-DimSumImageEnvelope {
    <#
        .SYNOPSIS
        Confirms a file still begins and ends as its declared image format.

        .DESCRIPTION
        This is the attach-boundary counterpart to the byte-level validation the
        selector already performed. It reads only the leading signature and the
        trailing terminator, so it costs nothing on a multi-megabyte photograph
        while still catching the two payloads that matter: something that is not
        an image at all, and an image whose tail never arrived.
    #>
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Format
    )
    $envelope = $script:DimSumPhotoEnvelopes[$Format]
    if (-not $envelope) { throw "the recorded image format '$Format' is not one this release pipeline attaches" }

    $stream = [IO.File]::OpenRead($Path)
    try {
        $minimum = $envelope.Head.Length + $envelope.Tail.Length
        if ($stream.Length -lt $minimum) {
            throw "the file is $($stream.Length) bytes, too short to carry a $($Format.ToUpperInvariant()) envelope"
        }
        $head = Read-DimSumFileSegment -Stream $stream -Count $envelope.Head.Length
        for ($index = 0; $index -lt $envelope.Head.Length; $index++) {
            if ($head[$index] -ne $envelope.Head[$index]) {
                throw "the file does not begin with a $($Format.ToUpperInvariant()) signature"
            }
        }
        [void]$stream.Seek(-$envelope.Tail.Length, [IO.SeekOrigin]::End)
        $tail = Read-DimSumFileSegment -Stream $stream -Count $envelope.Tail.Length
        for ($index = 0; $index -lt $envelope.Tail.Length; $index++) {
            if ($tail[$index] -ne $envelope.Tail[$index]) {
                throw "the file does not end with a $($Format.ToUpperInvariant()) terminator, so it is truncated"
            }
        }
    }
    finally {
        $stream.Dispose()
    }
    return $envelope.MediaType
}

function Resolve-DimSumReleasePhoto {
    <#
        .SYNOPSIS
        Turns a dim-sum selection record into an attachable release asset.

        .DESCRIPTION
        Returns an object describing either a validated photo copied into the
        release directory, or an unavailable result with the exact reason. It
        never throws, because a dish photograph is decoration with a purpose and
        must never gate a release.
    #>
    param(
        [Parameter(Mandatory)][AllowNull()]$Selection,
        [Parameter(Mandatory)][string]$RepositoryRoot,
        [Parameter(Mandatory)][string]$ReleaseRoot
    )

    $result = [ordered]@{
        Available   = $false
        CodeName    = $null
        AssetName   = $null
        AssetPath   = $null
        MediaType   = $null
        Description = $null
        PhotoUrl    = $null
        CatalogUrl  = $null
        Reason      = 'no dim-sum selection record was produced'
    }

    if ($null -eq $Selection) { return [pscustomobject]$result }
    $properties = @($Selection.PSObject.Properties.Name)
    if ($properties -contains 'catalogUrl') { $result.CatalogUrl = [string]$Selection.catalogUrl }
    if (-not ($properties -contains 'available') -or -not $Selection.available) {
        $result.Reason = if ($properties -contains 'reason' -and $Selection.reason) {
            [string]$Selection.reason
        } else {
            'the selection record reports no available dish'
        }
        return [pscustomobject]$result
    }

    try {
        if (-not ($properties -contains 'photo') -or $null -eq $Selection.photo) {
            throw 'the selection record names a dish but carries no validated photo'
        }
        $photo = $Selection.photo
        $photoProperties = @($photo.PSObject.Properties.Name)
        foreach ($required in @('releaseAssetName', 'repositoryPath', 'format', 'bytes', 'sha256')) {
            if (-not ($photoProperties -contains $required)) { throw "the photo record is missing its $required field" }
        }

        $assetName = [string]$photo.releaseAssetName
        if ($assetName -notmatch '^dim-sum-[A-Za-z0-9][A-Za-z0-9._-]*$' -or $assetName.Contains('..')) {
            throw "the recorded release asset name '$assetName' is not a safe asset file name"
        }
        $recordedHash = ([string]$photo.sha256).ToLowerInvariant()
        if ($recordedHash -notmatch '^[0-9a-f]{64}$') { throw 'the photo record does not carry a SHA-256 digest' }
        $recordedBytes = [int64]$photo.bytes
        if ($recordedBytes -le 0) { throw "the photo record declares $recordedBytes bytes" }

        # The recorded path is remote-influenced data, so it is resolved and then
        # required to land exactly where the selector is allowed to write.
        $expectedDirectory = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot '.tmp\dim-sum'))
        $sourcePath = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot ([string]$photo.repositoryPath)))
        if ([IO.Path]::GetDirectoryName($sourcePath) -ne $expectedDirectory) {
            throw 'the recorded photo path resolves outside the release download directory'
        }
        if ([IO.Path]::GetFileName($sourcePath) -ne $assetName) {
            throw 'the recorded photo path and release asset name disagree'
        }
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf -ErrorAction Stop)) {
            throw 'the validated photo file was not present after the build'
        }

        $item = Get-Item -LiteralPath $sourcePath -ErrorAction Stop
        if ($item.Length -ne $recordedBytes) {
            throw "the photo file is $($item.Length) bytes rather than the validated $recordedBytes"
        }
        $actualHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
        if ($actualHash -ne $recordedHash) { throw 'the photo file does not match the digest recorded when it was validated' }

        $format = ([string]$photo.format).ToLowerInvariant()
        $mediaType = Test-DimSumImageEnvelope -Path $sourcePath -Format $format

        $destination = Join-Path $ReleaseRoot $assetName
        Copy-Item -LiteralPath $sourcePath -Destination $destination -Force -ErrorAction Stop
        $copied = Get-Item -LiteralPath $destination -ErrorAction Stop
        if ($copied.Length -ne $recordedBytes) { throw 'the photo did not copy into the release directory intact' }

        $dimensions = ''
        if (($photoProperties -contains 'width') -and ($photoProperties -contains 'height')) {
            $dimensions = ", $([int]$photo.width)x$([int]$photo.height)"
        }
        $result.Available = $true
        $result.CodeName = [string]$Selection.codeName
        $result.AssetName = $assetName
        $result.AssetPath = $destination
        $result.MediaType = $mediaType
        $result.Description = "$($format.ToUpperInvariant()) image$dimensions, $('{0:N0}' -f $recordedBytes) bytes"
        $result.PhotoUrl = [string]$Selection.photoUrl
        $result.Reason = $null
    }
    catch {
        # Degrade both the photo and the code name together. Publishing the code
        # name without its photograph would consume a single-use dish name for a
        # release that never carried its picture.
        $result.Available = $false
        $result.CodeName = $null
        $result.AssetName = $null
        $result.AssetPath = $null
        $result.MediaType = $null
        $result.Description = $null
        $result.PhotoUrl = $null
        $result.Reason = "the selected dish photo could not be attached: $($_.Exception.Message)"
    }

    return [pscustomobject]$result
}
