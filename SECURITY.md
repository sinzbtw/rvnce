# Security

## Reporting a vulnerability

Use the repository's **Security → Advisories → Report a vulnerability** form. Include affected versions, symptoms, reproducible steps, and the impact. Keep credentials and private profile data out of the report. Coordinate public disclosure with the maintainers.

If the form is unavailable, open a minimal issue asking for a private reporting channel. Keep the vulnerability, reproduction steps, and affected data out of the public issue.

The latest published version and `main` are supported.

## Current trust model

Rvnce stores one draft in IndexedDB and validates versioned profile and theme JSON before applying it. Published links are limited to HTTP(S). Profile text is rendered as text and appearance values use bounded numbers, enumerations, and hexadecimal colors. Resource paths are assigned by the exporter.

Uploaded avatars and still backgrounds have byte and pixel limits and are re-encoded. ZIP export re-encodes the avatar, removing source metadata. GIF and H.264 MP4 backgrounds keep their original bytes, including metadata or embedded audio. Their playback is muted. The editor checks format, dimensions, and size before decoding a supported background.

The standalone HTML includes a content security policy and uses local CSS, fonts, and media. Motion backgrounds allow a local playback script. Site visitors connect to an external destination when they follow a link. The optional Rvnce credit uses a plain link and sends no requests until clicked.

Drafts are stored per browser origin. Anyone with access to that browser profile can read the local draft. Downloaded JSON and ZIP files contain any personal content the author entered.

## Planned custom code

Self-hosted deployments can eventually let an owner opt in to running their own HTML, CSS, and JavaScript on a site they control. For a centralized service, untrusted code must run on a dedicated origin without application cookies or credentials, inside tightly sandboxed frames with a restrictive CSP. Communication must use a narrow, versioned API with validated frame identity and message shape. Keep editing, auth, and administration on the trusted origin. Resolve widget network access and resource loading before enabling custom code.
