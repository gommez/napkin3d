# NAPKIN3D · STATUS

## Current objective

Implement the zero-cost, browser-local Automatic Scanner milestone on `lab` while preserving GitHub Pages production on `main` and the existing Vercel LAB preview. HOME leads to Automatic Project or Manual Project. Automatic Project is the simplified workflow; Manual Project remains the editor and advanced correction mode.

Automatic sketch interpretation is planned but not implemented.

## Stable production

`main` is the stable production branch and must not be modified without explicit approval. At this point it points to the initial Napkin3D mobile MVP commit, the same commit currently checked out on `lab`.

## Current branch

`lab`. This block changes only the scanner/model/editor/export surfaces and their documentation/tests. `main` was not modified.

## Last completed block

Automatic Scanner Stage A and Stage B: explicit circular through-holes are now part of the parametric model, and the local scanner can detect a simple rectangle plus circular features, ask for unresolved measurements, confirm the result, and open the existing 3D/manual workflow. Vercel builds still use `/` and GitHub Pages builds retain `/napkin3d/`.

## What works

- The repository builds with strict TypeScript checking.
- The unit test suite passes: 2 test files and 8 tests.
- ESLint passes.
- The existing application provides the Manual Project flow: project and part creation, photo import, calibration, manual geometry editing, local autosave, 2D/3D modes, and export controls.
- HOME presents exactly two primary choices: Proyecto Automático and Proyecto Manual.
- Automatic Project opens a placeholder with NUEVA PIEZA, HACER FOTO, and ELEGIR FOTO, plus a return action.
- Manual Project opens the existing project/editor workflow and can return to HOME without deleting or resetting saved data.
- The parametric model in `src/model.ts` remains the source of truth; SVG and STL are derived exports.
- The same source supports GitHub Pages production at `/napkin3d/` and Vercel previews at their deployment root.
- Automatic processing runs locally with no external API, AI service, backend, authentication, or recurring operating cost.
- Explicit `Hole` entities subtract material from a linked rectangle in the 2D editor, 3D viewer, SVG path, and STL output.
- Automatic output cannot be confirmed until scale, hole diameters, and thickness are resolved.

These statements are based on the current source and automated checks. Real-device behavior has not been reverified in this block.

## Known bugs

- SVG export has been reported by the user as not working. It is not fixed in this block; the existing unit test only verifies SVG string generation, not the end-to-end browser download.
- The scanner is intentionally limited to simple deterministic raster fixtures: one axis-aligned rectangular contour and circular features. General perspective correction, arbitrary contours, and robust real-world photo interpretation are not implemented.
- Real-device camera, downloads, and installation have not been verified in this block. Browser E2E verified storage persistence, touch gestures, downloads, and the existing Manual workflow.
- The production build reports a chunk-size warning for a generated chunk larger than 500 kB.

## Current work

This development block is complete for the approved scanner milestone. Stage A added explicit subtractive holes and v1-to-v2 persistence migration. Stage B added local raster preprocessing, deterministic rectangle/circle detection, uncertainty questions, confirmation, and creation of editable parametric geometry. No external service or dependency was added.

## Decisions pending

- Decide the implementation boundary and interpretation technology for Automatic Project before starting automatic sketch interpretation. Options include a constrained browser-local flow, an external service, or postponing interpretation while building only the correction workflow. This affects architecture, privacy, product behavior, and dependencies.

## Do not touch

- Do not modify `main` without explicit approval.
- Do not refactor the existing Manual Project unnecessarily.
- Do not expand the Automatic Project shell into interpretation or generation without an explicit product decision.
- Do not expand the scanner beyond its supported rectangular contour/circular feature milestone without a new validation block.
- Do not fix SVG export yet.
- Do not treat automatic interpretation as implemented.
- Do not reconstruct the authoritative model from SVG or STL.

## Next recommended action

Test the LAB preview on a real phone with a simple front-facing rectangular sketch and one circular hole. Keep `main` as the only GitHub Pages production source. Do not begin the next Napkin3D development block until separately instructed.

## Last verification

On `lab`, after this development block:

- `npm test`: passed, 3 files and 14 tests.
- `npm run lint`: passed.
- `npm run build`: passed; Vite emitted only the existing chunk-size warning.
- `npm run test:e2e` with a fresh server: passed, 3 mobile browser tests. This verified HOME, Manual loading, existing touch editing, reload persistence, local scanner detection, unresolved-measurement gating, confirmation, 3D opening, source-photo retention, and manual hole editing.
- `git diff --check`: passed.
- `npm run build` with default environment: passed; generated asset URLs use `/napkin3d/` for GitHub Pages.
- `VERCEL=1 npm run build`: passed; generated asset URLs use `/` for a Vercel deployment root.
- `npx playwright test e2e/workflow.spec.ts -g "automatic scanner"`: passed, 1 test. This verified local image processing, unresolved-measurement gating, confirmation, 3D opening, and manual hole diameter editing.
- Real-device smoke testing: not run.

Deployment architecture: `main` -> GitHub Pages -> `https://gommez.github.io/napkin3d/`; `lab` -> Vercel Preview -> `https://napkin3d-2xjcoomoz-gommez.vercel.app`. Automatic GitHub-to-Vercel deployment remains unconfigured; this preview was deployed manually from `lab`.

The first E2E attempt exposed only a test navigation assumption after reload; the test was corrected to re-enter Manual and then passed. No product regression was found.

## Updated

2026-09-18