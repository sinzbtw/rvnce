# Rvnce

[English](README.md) · [Русский](README.ru.md)

Rvnce is an open-source editor for personal bio pages. Build a profile in your browser, preview it as you edit, and download a standalone site you can host yourself.

[Open the editor](https://sinzbtw.github.io/rvnce/) · [View the sample profile](https://sinzbtw.github.io/rvnce/demo/)

## What you can do

- Edit a display name, bio, and photo. Upload a PNG, JPEG, or WebP image up to 4 MB.
- Add, edit, remove, and reorder up to 24 links.
- Choose a light or dark profile and set an accent color.
- Preview at wide and phone widths. Edits are saved locally when browser storage is available.
- Import or export a versioned JSON profile, including its photo, or download a ready-to-host ZIP.

If browser storage is unavailable, changes may be lost when you refresh or close the page. Export a JSON copy to keep editing later.

The sample profile, Mira Park, is fictional. Its avatar was supplied for the demo. Its links point to public design and software resources.

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

1. In the editor, choose **Download site**.
2. Extract the ZIP and upload its contents to your static host. Keep `index.html`, `profile.css`, the `fonts/` directory, the photo if present, and `.nojekyll` together.
3. Open the URL for that directory.

For GitHub Pages, put the extracted files at the root of the repository you use for your profile. Under **Settings → Pages**, set the source to **Deploy from a branch**, choose the branch with those files, and select **`/ (root)`**. GitHub shows the published URL after deployment. Relative asset paths also work for project sites under `/<repository>/`. The profile runs without a database, application server, or JavaScript.

## Profile JSON

Use **Export JSON** for a portable copy. Here is a minimal example you can import:

    {
      "schemaVersion": 1,
      "profile": { "name": "Mira Park", "bio": "Independent poster designer.", "avatar": null },
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
