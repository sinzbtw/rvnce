# Security

## Reporting a vulnerability

Use the repository's **Security → Advisories → Report a vulnerability** form. Include affected versions, symptoms, reproducible steps, and the impact. Keep credentials and private profile data out of the report. Coordinate public disclosure with the maintainers.

If the form is unavailable, open a minimal issue asking for a private reporting channel. Keep the vulnerability, reproduction steps, and affected data out of the public issue.

The latest published version and `main` are supported.

## Current trust model

Rvnce stores one draft in the browser and validates imported JSON before applying it. Published links are limited to HTTP(S). Profile text is rendered as text. Avatar uploads have file size and pixel limits, are decoded as raster images, and are resized and encoded as PNG. ZIP export re-encodes the avatar, removing source metadata. A JSON backup can retain the PNG bytes from an imported draft. The standalone HTML includes a content security policy and uses local CSS, fonts, and images. Site visitors connect to a link's destination when they follow that link.

Drafts are stored per browser origin. Anyone with access to that browser profile can read the local draft. Downloaded JSON and ZIP files contain any personal content the author entered.

## Planned custom code

Self-hosted deployments can eventually let an owner opt in to running their own HTML, CSS, and JavaScript on a site they control. For a centralized service, untrusted code must run on a dedicated origin without application cookies or credentials, inside tightly sandboxed frames with a restrictive CSP. Communication must use a narrow, versioned API with validated frame identity and message shape. Keep editing, auth, and administration on the trusted origin. Resolve widget network access and resource loading before enabling custom code.
