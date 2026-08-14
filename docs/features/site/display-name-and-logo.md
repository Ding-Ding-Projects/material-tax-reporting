# Display name and mark

## Behaviour

The header name and mark can be changed for this browser. The name is a trimmed field of 1 to 60 characters; an empty field restores the shipped product name.

The mark is either one of the shipped inline marks or a local image. A local image is validated by the kernel: the declared type must be PNG or JPEG, the declared length must be within the limit, and the leading bytes must actually match the declared format. Vector markup is rejected outright, because an SVG can carry script and external references and nothing here needs to inline untrusted markup.

The mark is decorative. It is hidden from assistive technology, and the accessible name always comes from the text beside it. The document title is left as the shipped product name, so a personalized name never travels in a shared link.

This surface does not move the paper-only product boundary. It changes no tax figure, no rule citation, no boundary statement and no review requirement, and it implements nothing resembling NETFILE, EFILE, electronic submission, direct CRA transmission or automatic filing.

## Configuration

- Display name: empty, or 1 to 60 characters.
- Mark: one of the shipped marks, or a local PNG or JPEG within the kernel's size limit.

## Failure modes

- A rejected image names the exact reason and the previous mark stays in use.
- An image that cannot be read in this browser reports that and leaves the previous mark in place.
- A stored selection that cannot be read falls back to the default shipped mark.

## Privacy and security

The name and the image stay in this browser. The image is held as an inline data value in local storage and is never transmitted.

## Verification status

This lane ran the site build (`npm run pages:build` in `apps/site`) and the source checks in `apps/site/src/checks`. It did not run tests, lint checks, type checks, accessibility checks, screenshots or other captures, or browser-based user-interface quality assurance. Nothing in this article should be read as evidence from one of those activities.

## Related articles

- [Material 3 shell and appearance](material-3-shell-and-appearance.md)
- [Command palette](command-palette.md)
