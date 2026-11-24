# Rvnce

[English](README.md) · [Русский](README.ru.md)

Rvnce is an open-source editor for personal bio pages. Start with a preset, make it yours, and download a standalone site you can host yourself.

[Open the editor](https://sinzbtw.github.io/rvnce/) · [Graphic](https://sinzbtw.github.io/rvnce/demo/) · [Minimal](https://sinzbtw.github.io/rvnce/demo/minimal/) · [Midnight](https://sinzbtw.github.io/rvnce/demo/midnight/) · [Glass](https://sinzbtw.github.io/rvnce/demo/glass/) · [Neon](https://sinzbtw.github.io/rvnce/demo/neon/)

![Rvnce appearance editor and live profile preview](docs/images/editor.png)

![Five profiles rendered with the built-in presets](docs/images/presets.png)

## Make a profile

1. In **Profile**, add a name, bio, language, and photo. **Show Made with Rvnce** is on for new profiles and is free to turn off or on at any time.
2. In **Links**, add and reorder up to 24 destinations.
3. In **Appearance**, choose a preset and a light or dark palette. Customize the background, fonts, profile card, avatar, links, and motion. Changes appear in the live preview. **Examples** opens published profiles in separate tabs.
4. Download **Export JSON** for a full backup, **Export theme** to share just the appearance and its background, or **Download site** to publish.

Rvnce saves one draft per browser origin. If another tab changes the draft, export your current edits before loading the saved version. If browser storage is unavailable, download a JSON backup before closing the editor.

## Backgrounds and backups

- Choose a color, linear or radial gradient, PNG, JPEG, WebP, GIF, or H.264 MP4. Photo uploads can be up to 8 MiB and are resized to fit the site. GIFs can be up to 3 MiB and 240 frames. MP4s can be up to 8 MiB and 15 seconds. Both motion formats are limited to 1920 × 1080.
- A motion background includes a still poster and a stop or play button. The page starts with the poster when the visitor prefers reduced motion or playback is blocked. If the editor cannot open a local MP4, it lets you upload a poster image for it. GIF and MP4 files are included as uploaded, including any metadata or embedded audio. Background video plays muted.
- Profile and theme JSON files can be up to 16 MiB. Profile backups use schema v3. Import upgrades v1 and v2 profiles with their Graphic styling and the credit off. Version 1 profiles receive the original default language, `en`.

[Watch a short editor walkthrough](docs/images/appearance.gif).

## Run locally

Use Node.js 24 and npm.

    npm ci
    npm run dev

For a production build and a local preview:

    npm run build
    npm run preview

Serve `dist/` at the root or under a subpath to host the editor and examples.

## Publish a profile

Choose **Download site**, extract the ZIP, and upload all the files in it to your static host. Keep `index.html`, `profile.css`, `.nojekyll`, the fonts, and any profile assets together.

For GitHub Pages, upload the extracted files to the root of your profile repository. Under **Settings → Pages**, choose **Deploy from a branch**, select the branch and **`/ (root)`**, then open the URL that GitHub shows. The relative paths also work under a project subpath.

The exported page needs no server code and makes no requests to the editor. Text, links, static backgrounds, and the optional credit work without JavaScript. An animated background uses a small local player and falls back to its poster when scripting is off.

## Development and license

Rvnce uses Preact, TypeScript, and Vite. The editor preview, sample pages, and site exporter share the same public profile renderer. Vitest covers documents and export logic. Playwright runs against the built editor and exported pages.

See [Architecture](ARCHITECTURE.md), [Contributing](CONTRIBUTING.md), [Roadmap](ROADMAP.md), and [Security](SECURITY.md).

The source is licensed under [MIT](LICENSE). Manrope, Source Sans 3, and Source Serif 4 use the SIL Open Font License. Each exported profile includes the selected family's license in `fonts/OFL.txt`.
