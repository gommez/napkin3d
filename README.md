# napkin3d

Turn a napkin sketch into editable, dimensioned geometry and an extruded part. Mobile-first, entirely in your browser, with local autosave.

```sh
npm ci
npm run dev
```

Open the printed URL at `/napkin3d/`. For production verification:

```sh
npm test
npm run lint
npm run build
npm run preview
```

For the automated mobile browser smoke test, run `npx playwright install --with-deps chromium`, then `npm run test:e2e`.

Create a project → add a part → photograph a sketch → calibrate → trace → edit dimensions → open 3D → export SVG/STL. Rectangles/circles extrude independently; lines are guides. No boolean union or holes. Dimensions are mm.

## Publish to GitHub Pages

1. Push this work to `main`.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
3. The included workflow tests, builds and deploys automatically on pushes to `main` (or run it manually).
4. Intended URL: **https://gommez.github.io/napkin3d/**.

Vite, manifest and service-worker scope use `/napkin3d/`. On iPhone use Safari → Share → Add to Home Screen; on Android use the browser install/add-to-home-screen action. Camera and installation need HTTPS (provided by Pages). A network-first service worker caches visited assets; visit 3D online before using it offline.

Projects are saved only in this browser/device. Clearing browser storage removes them. SVG/STL exports are outputs, not editable project backups. Import STL into slicers using millimetres; inspect separate/overlapping shells before printing.

See [product](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md), [data model](docs/DATA_MODEL.md), and [roadmap](docs/ROADMAP.md).
