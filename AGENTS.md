# Working on Rvnce

- Keep the profile format versioned. Validate incoming data and preserve the behavior of prior exports, or document and implement a migration.
- Keep browser storage, file input, and downloads in the editor. The public renderer accepts profile data and assets and has no editor imports. Use it for preview and export.
- Keep exported paths relative. Profile content is text and validated data. Any future arbitrary code requires an explicit trust and isolation design.
- Keep runtime dependencies small and document third-party asset rights. Use original or appropriately licensed code, media, and fonts.
- Run Prettier, Oxlint, TypeScript, Vitest, the production build, and relevant Playwright checks. Document user-visible changes in both READMEs.
- Include only files needed by the feature. Keep generated output, traces, and credentials out of Git.
