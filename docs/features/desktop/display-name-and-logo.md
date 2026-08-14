# Display name and logo

## What this is

The application's displayed name and mark can be changed. A bounded display name of at most 60 characters replaces
the shipped name in the title bar, in the window title and on the About card. A logo may be one of the shipped marks
or a local raster image.

## Local image rules

A chosen image is validated in the privileged boundary: only PNG and JPEG are accepted, the declared type must match
the leading bytes of the file, the file must be no larger than 256 KB, and a PNG larger than 512 by 512 pixels is
refused. Vector markup is rejected outright. The accepted image is returned as an inline data address, which the
shipped content security policy already permits.

## This is presentation only

The About card states it plainly: the package name, the project file extension, the file-dialog filter labels and the
application data location are unchanged, so a renamed application still opens exactly the same project files.

## Boundaries

The application prepares information for a manually reviewed CRA mail-in PDF package only. It does not provide NETFILE, EFILE, electronic submission, direct CRA transmission, or automatic filing. Renaming the application does not rename or re-scope anything the report itself depends on.

## Failure modes

- An image whose contents do not match its declared format is refused with that reason.
- An over-large image or an over-large pixel dimension is refused before anything is stored.

## Verification status

The application build (`npm run build --workspace @material-tax-reporting/desktop`) was run and completed, and the generated main, preload and renderer bundles were parsed to confirm they are syntactically valid. No tests, lint, type checks, packaging, installer creation, release, runtime launch, screenshot, accessibility conformance check, performance measurement or native-speaker language review were run for this change, so none is claimed here.

## Related articles

- [Settings and preferences](settings-and-preferences.md)
- [Appearance editor](appearance-editor.md)
- [Tabs and navigation](tabs-and-navigation.md)
