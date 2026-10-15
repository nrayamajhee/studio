---
order = 1
---

# Installation

```bash
npm install
```

## Development

- **App Dev Server**: Runs on port `5173` (`http://localhost:5173`)

  ```bash
  npm run dev
  ```

- **Storybook**: Runs on port `6006` (`http://localhost:6006`)
  ```bash
  npm run storybook
  ```

## Build

- **Build App**:

  ```bash
  npm run build
  ```

- **Build Storybook**:

  ```bash
  npm run build-storybook
  ```

## Checks

- **Typecheck**: `npm run typecheck`
- **Unit tests** (DSP, synth engine and the Synth screen's pages, Node): `npm run test:unit`
- **Story smoke tests** (headless Chromium): `npx vitest run --project storybook`
- **Lint**: `npm run lint` (fix with `npm run lint:fix`)
- **Format**: `npm run format` (check with `npm run format:check`)

## Docs pictures

Each picture is written twice, `name.webp` and a `name.dark.webp` twin, and the `/docs` route shows the one that matches the theme.

- **Diagrams**: `npm run diagrams` draws the synth engine's diagrams from `scripts/diagrams/` as SVGs on a transparent background.
- **Screenshots**: `npm run screenshots` drives the Device headlessly with `scripts/screenshots/` and shoots every picture of it in the docs. It needs the app running on port `3000` (or set `STUDIO_URL`); name a set to shoot only that one, as in `npm run screenshots -- the-device --dark`.

## Clean

- **Clean Artifacts & Dependencies**:

  ```bash
  npm run clean
  ```
