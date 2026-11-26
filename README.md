# Rvnce

[English](README.md) · [Русский](README.ru.md)

Rvnce is an open-source editor for personal bio pages. Build a page for your work and links, see it as visitors will, and download a standalone site you can host yourself.

**[Open the live editor](https://sinzbtw.github.io/rvnce/)**

![The Rvnce appearance editor beside Mira Park’s profile preview, with a photo, link buttons, and a row of social icons](docs/images/editor.png)

[Make a profile](#make-a-profile) · [Run locally](#run-locally) · [Publish a profile](#publish-a-profile) · [Contribute](CONTRIBUTING.md)

## Finished profiles

![Three published Rvnce profiles: Lina Moreno on a light serif layout, Studio Vesper on a dark gradient card, and Patch Signal on a dark green layout](docs/images/presets.png)

- **Minimal** pairs serif type with a quiet palette for a writer’s links. [Open Lina Moreno](https://sinzbtw.github.io/rvnce/demo/minimal/)
- **Midnight** gives a film and sound studio a dark gradient and warm accents. [Open Studio Vesper](https://sinzbtw.github.io/rvnce/demo/midnight/)
- **Neon** uses high-contrast green outlines for a creative coding portfolio. [Open Patch Signal](https://sinzbtw.github.io/rvnce/demo/neon/)

Two more presets are available to browse. [Graphic](https://sinzbtw.github.io/rvnce/demo/) · [Glass](https://sinzbtw.github.io/rvnce/demo/glass/)

## Make a profile

1. **Customize.** Add a name, bio, page language, and photo in **Profile**. Add up to 24 destinations in **Links** and reorder button links and icon links separately. Icon links detect supported websites and can use an uploaded image in its original colors or tinted to match your profile. In **Appearance**, choose a preset and tune the background, fonts, card, avatar, link style, and effects.
2. **Preview.** Open **Preview**, switch between desktop and phone widths, and use **Examples** to open published profiles. Background, entrance animation, cursor and trail, page overlay, click effects, and name effects have their own preview dialogs. Move or click inside a dialog’s preview to try pointer effects. Name sparkles and text styling can be enabled independently.
3. **Export.** Use **Export JSON** for a full backup, **Export theme** for appearance and its assets, or **Download site** to publish the standalone ZIP.

![The page overlay settings dialog shows preset, color, and intensity controls next to a preview of the profile](docs/images/appearance-preview.png)

**Page overlay** includes Glitch with a burst frequency control, Matrix rain with adjustable density, Film dust, and Drifting embers. The effect layer leaves links clickable and respects reduced motion.

Snow, floating particles, name sparkles, and the animated name gradient keep moving while enabled. Film grain adds a fine static texture. Ripple, Particle burst, and click Sparkles fade after each click.

The editing form fills the space next to the sidebar when the floating preview is closed. Opening the preview makes room for it beside the form. In settings dialogs, the preview fits the profile content and scrolls when the profile is taller than the available space.

In **Profile**, you can also add a **Browser tab icon** and toggle **Show Made with Rvnce**, which is on for new profiles. A PNG, JPEG, or WebP tab icon is fitted into a 64 × 64 PNG and included in the exported site.

Open **Settings** in the header to choose the editor language or the **System**, **Light**, or **Dark** editor theme. Rvnce remembers both choices in your browser. On a desktop, use the sidebar to switch sections and open **Preview** from the header when needed. You can drag the floating preview or move it with the arrow keys. On a phone, switch between **Editor** and **Preview**. The interface respects your reduced-motion preference.

Rvnce saves one draft per browser origin. If another tab changes the draft, export your current edits before loading the saved version. If browser storage is unavailable, download a JSON backup before closing the editor.

## Backgrounds and backups

- Choose a color, linear or radial gradient, PNG, JPEG, WebP, GIF, or H.264 MP4. Photo uploads can be up to 8 MiB and are resized to fit the site. GIFs can be up to 3 MiB and 240 frames. MP4s can be up to 8 MiB in any duration. Both motion formats are limited to 1920 × 1080.
- A motion background includes a still poster and a stop or play button. The page starts with the poster when the visitor prefers reduced motion or playback is blocked. If the editor cannot open a local MP4, it lets you upload a poster image for it. GIF and MP4 files are included as uploaded, including any metadata or embedded audio. Background video plays muted.
- Profile and theme JSON files can be up to 16 MiB. Backups use profile schema v5 and theme schema v2. Profiles v1–v4 and themes v1 import with the new effects off and their original button links. Version 1 and 2 profiles keep their Graphic styling and disabled credit, and v1 profiles receive the original default language, `en`.
- Cursor and link icon images accept PNG, JPEG, or WebP up to 4 MiB. Rvnce converts them to PNG and fits them within 32 × 32 and 64 × 64 pixels respectively.

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

The exported page needs no server code and makes no requests to the editor. Text, links, static backgrounds, and the optional credit work without JavaScript. Animated backgrounds, click effects, and cursor trails use local scripts. A motion background shows its poster when scripting is off. The page respects the visitor’s reduced-motion preference.

## Development and license

Rvnce uses Preact, TypeScript, Vite, and Motion for editor animations. The editor preview, sample pages, and site exporter share the same public profile renderer. Vitest covers documents and export logic. Playwright runs against the built editor and exported pages.

See [Architecture](ARCHITECTURE.md), [Contributing](CONTRIBUTING.md), [Roadmap](ROADMAP.md), and [Security](SECURITY.md).

The source and original Rvnce mark are licensed under [MIT](LICENSE). Motion uses the [MIT license](https://github.com/motiondivision/motion/blob/main/LICENSE.md). Manrope, Source Sans 3, and Source Serif 4 use the SIL Open Font License. Each exported profile includes the selected family's license in `fonts/OFL.txt`.

Editor and generic profile icons come from Lucide. Social logos come from Font Awesome Brands under CC BY 4.0 and use the profile’s link color. Exports include both icon license files in `icons/`. [Lucide license](https://github.com/lucide-icons/lucide/blob/1.79.0/LICENSE) · [Font Awesome Free license](https://fontawesome.com/license/free)
