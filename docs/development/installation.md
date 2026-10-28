---
order = 1
---

# Installation

The React app lives in `web-react/`, and every command below runs from there:

```bash
cd web-react
npm install
```

## Development

- **App Dev Server**: Runs on port `5173` (`http://localhost:5173`)

  ```bash
  npm run dev
  ```

- **Debug overlay**: on the home page, `⌘ D` (`Ctrl D`) or the footer's **Debug** link opens a panel over the Device showing the app's state kept in `localStorage`: its keys, and the picked one's state, read from the store that keeps it, as pretty-printed JSON. It follows the stores while open, so a change shows as it is made, and the keys still play the Device under it.

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
- **Format**: `npm run format` (check with `npm run format:check`); besides web-react it formats the root's `README.md` and `docs/`, the crates' READMEs and sound-engine's scripts.

## Docs pictures

Each picture is written twice, `name.webp` and a `name.dark.webp` twin, and the `/docs` route shows the one that matches the theme.

- **Diagrams**: `npm run diagrams` draws the synth engine's diagrams from `web-react/scripts/diagrams/` as SVGs on a transparent background.
- **Screenshots**: `npm run screenshots` drives the Device headlessly with `web-react/scripts/screenshots/` and shoots every picture of it in the docs. It needs the app running on port `3000` (or set `STUDIO_URL`); name a set to shoot only that one, as in `npm run screenshots -- the-device --dark`.

## Deploy

`web-react/Dockerfile` builds the app with its Storybook and serves it with `react-router-serve` on port `3000`. It's built from the repo's root, since the app reads the root's `docs/` and `README.md`; `Dockerfile.dockerignore` beside it keeps the context to those and `web-react/`:

```bash
docker build -f web-react/Dockerfile -t studio-web-react .
docker run --rm -p 3000:3000 studio-web-react
```

On Railway, leave the service's root directory unset (the repo's root), set the Dockerfile Path to `/web-react/Dockerfile`, and watch `/web-react/**`, `/docs/**` and `/README.md`.

## Clean

- **Clean Artifacts & Dependencies**:

  ```bash
  npm run clean
  ```
