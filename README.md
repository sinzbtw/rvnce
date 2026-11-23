# Rvnce

[English](README.md) · [Русский](README.ru.md)

Rvnce is an open-source editor for personal bio pages. Build a profile in your browser, preview it as you edit, and download a standalone site you can host yourself.

[Open the editor](https://sinzbtw.github.io/rvnce/) · [View the sample profile](https://sinzbtw.github.io/rvnce/demo/)

## What you can do

- Edit a display name, bio, photo, and page language. Upload a PNG, JPEG, or WebP image up to 4 MiB, 24 megapixels, and 8192 pixels per side.
- Add, edit, remove, and reorder up to 24 links.
- Choose a light or dark profile and set an accent color.
- Preview at wide and phone widths. Preview links are static. Published links open their destinations.
- Import or export a versioned JSON draft, including incomplete fields and the photo, or download a ready-to-host ZIP once the profile is complete.

Rvnce saves one draft per browser origin. If the draft changes in another tab, the editor keeps your current edits on screen. Download a JSON copy before loading the saved version. If storage is unavailable, export a JSON copy before refreshing or closing the page.

The sample profile, Mira Park, is fictional. Its portrait was supplied for the demo. The photographer and redistribution terms have yet to be confirmed. The sample links point to public design and software resources.

## Run locally

Use Node.js 24 and npm.

    npm ci
    npm run dev

Open the URL shown by Vite. The editor links to the sample static profile.

For a production build and a local preview:

    npm run build
    npm run preview

Serve the contents of `dist/` at the root or under a subpath to host the editor and sample profile.

## Publish a profile

1. Fill in the display name, enter a page language tag such as `en`, and complete each link with a label and a full HTTP(S) URL. Choose **Download site**. The ZIP contains a re-encoded PNG, which strips metadata from the source photo.
2. Extract the ZIP and upload its contents to your static host. Keep `index.html`, `profile.css`, the `fonts/` directory, the photo if present, and `.nojekyll` together.
3. Open the URL for that directory.

For GitHub Pages, put the extracted files at the root of the repository you use for your profile. Under **Settings → Pages**, set the source to **Deploy from a branch**, choose the branch with those files, and select **`/ (root)`**. GitHub shows the published URL after deployment. Relative asset paths also work for project sites under `/<repository>/`. The profile runs without a database, application server, or JavaScript.

## Profile JSON

**Export JSON** downloads a portable draft. **Import JSON** accepts v2 drafts and upgrades v1 profiles with `en`, the language used by earlier exports. Change the page language before publishing if the profile uses another language. A minimal example to import:

    {
      "schemaVersion": 2,
      "profile": { "name": "Mira Park", "bio": "Independent poster designer.", "avatar": null, "language": "en" },
      "appearance": { "theme": "rvnce", "variant": "light", "accent": "#4434d4" },
      "blocks": [
        {
          "id": "resources",
          "type": "link",
          "label": "Open-source tools",
          "url": "https://github.com/explore"
        }
      ]
    }

## Development

Rvnce uses Preact, TypeScript, and Vite. The public renderer takes validated profile data and assets. The editor preview, sample profile, and exporter use that renderer. Vitest covers profile validation and export logic. Playwright tests the production editor and exported profiles.

See [Architecture](ARCHITECTURE.md) for the component diagram and instructions for generating a local interactive code graph with Graphify.

See [Contributing](CONTRIBUTING.md) for local checks and reviews, [Roadmap](ROADMAP.md) for planned work, and [Security](SECURITY.md) for the trust model and private reporting.

## License

Rvnce source code is licensed under [MIT](LICENSE). Manrope is distributed under the SIL Open Font License. Published exports include its license in `fonts/OFL.txt`.
