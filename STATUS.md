# NAPKIN3D · STATUS

## Current objective

Provide a safe preview deployment for the current `lab` branch while preserving GitHub Pages production on `main`. The application direction remains: HOME leads to Automatic Project or Manual Project. Automatic Project is the future simplified primary workflow; Manual Project remains the current editor and advanced correction mode.

Automatic sketch interpretation is planned but not implemented.

## Stable production

`main` is the stable production branch and must not be modified without explicit approval. At this point it points to the initial Napkin3D mobile MVP commit, the same commit currently checked out on `lab`.

## Current branch

`lab`. This deployment block changes only Vite build configuration and project status documentation. The previous application and test changes remain on `lab`; `main` was not modified.

## Last completed block

Preview deployment preparation: Vercel builds use `/` at the deployment root when `VERCEL=1`; GitHub Pages builds retain `/napkin3d/`. The initial mobile MVP and HOME / AUTOMATIC / MANUAL entry point remain unchanged.

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

These statements are based on the current source and automated checks. Real-device behavior has not been reverified in this block.

## Known bugs

- SVG export has been reported by the user as not working. It is not fixed in this block; the existing unit test only verifies SVG string generation, not the end-to-end browser download.
- Automatic sketch interpretation does not exist yet.
- Real-device camera, downloads, and installation have not been verified in this block. Browser E2E verified storage persistence, touch gestures, downloads, and the existing Manual workflow.
- The production build reports a chunk-size warning for a generated chunk larger than 500 kB.

## Current work

This deployment block prepares the `lab` commit for a Vercel preview. Vercel is a separate preview deployment path; the existing GitHub Pages workflow remains the production path. No image analysis, OCR, vectorization, AI service, automatic 3D generation, or unrelated application change is included.

## Decisions pending

- Decide the implementation boundary and interpretation technology for Automatic Project before starting automatic sketch interpretation. Options include a constrained browser-local flow, an external service, or postponing interpretation while building only the correction workflow. This affects architecture, privacy, product behavior, and dependencies.

## Do not touch

- Do not modify `main` without explicit approval.
- Do not refactor the existing Manual Project unnecessarily.
- Do not expand the Automatic Project shell into interpretation or generation without an explicit product decision.
- Do not fix SVG export yet.
- Do not treat automatic interpretation as implemented.
- Do not reconstruct the authoritative model from SVG or STL.

## Next recommended action

Use the Vercel preview URL to test `lab`. Keep `main` as the only GitHub Pages production source. Do not begin the next Napkin3D development block until separately instructed.

## Last verification

On `lab`, after this development block:

- `npm test`: passed, 2 files and 8 tests.
- `npm run lint`: passed.
- `npm run build`: passed; Vite emitted only the existing chunk-size warning.
- `npm run test:e2e`: passed, 2 mobile browser tests. This verified HOME, Automatic shell, Manual loading, existing touch editing, reload persistence, and return to HOME without losing the project.
- `git diff --check`: passed.
- `npm run build` with default environment: passed; generated asset URLs use `/napkin3d/` for GitHub Pages.
- `VERCEL=1 npm run build`: passed; generated asset URLs use `/` for a Vercel deployment root.
- Real-device smoke testing: not run.

Deployment architecture: `main` -> GitHub Pages -> `https://gommez.github.io/napkin3d/`; `lab` -> Vercel Preview -> separate Vercel deployment URL. The `lab` commit must be pushed before Vercel can build it. Vercel authentication/project connection and the final preview URL are pending until the deployment is created.

The first E2E attempt exposed only a test navigation assumption after reload; the test was corrected to re-enter Manual and then passed. No product regression was found.

## Updated

2026-09-18