# Contributing to Rvnce

## Set up and check your changes

Use Node.js 24 with npm. Run:

    npm ci
    npm run dev

Before opening a pull request, run:

    npm run format:check
    npm run lint
    npm run typecheck
    npm test
    npm run build
    npx playwright install chromium webkit
    npm run test:e2e

Run `npm run format` to apply Prettier. On Linux, `npx playwright install --with-deps chromium webkit` installs browser system dependencies too. Browser checks run against the production build, so rebuild after changing app code.

## File an issue or propose a change

- Search existing issues before opening a new one.
- For bugs, include the browser and version, steps to reproduce, what you expected, and what happened. Use a sample profile without personal data.
- For features, describe the problem, who encounters it, and an example workflow. Start an issue before a change to the profile format or trust model.
- For a documentation issue, identify the page and the part that needs correction.
- Report security problems privately using [SECURITY.md](SECURITY.md).

## Open a pull request

Fork the repository, branch from `main`, and keep the change focused. In the PR template, explain what changed and why, record the checks you ran, and link the issue when one exists. Include before and after screenshots for visual changes. Add a regression test when the existing suite would miss a changed behavior. Keep user-facing documentation synchronized in both languages.

Use strict TypeScript and share profile rendering between preview and export. Keep browser storage and downloads in the editor. Preserve relative paths in exports. Use assets with documented rights and keep dependency additions small. See [AGENTS.md](AGENTS.md) for repository conventions.
