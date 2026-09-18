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
- Real-device acceptance previously found that both Automatic Scanner image actions did nothing; this block replaces unreliable hidden-input programmatic activation with direct native label activation.
- DirectEditView is automated-test verified but has not yet passed real-device acceptance on iPhone or Android.

## Current work

This block adds DirectEditView as the primary 2D editing experience. It uses the existing Part model, SVG orthographic handles, live dimensions, long-press numeric editing, hole constraints, contextual thickness editing, and immediate 3D regeneration through the existing Viewer. The original Editor remains available through Editor avanzado. No scanner detection, export architecture, Vercel, production, or main configuration was changed.

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

Test the LAB preview on a real phone with a rectangular part and one circular hole: drag body sides, long-press dimensions, move/resize the hole, and edit thickness. Decide after that acceptance test whether the legacy Editor should remain exposed as fallback. Keep `main` as the only GitHub Pages production source.

## Last verification

On `lab`, after this development block:

- `npm test`: passed, 3 files and 16 tests.
- `npm run lint`: passed.
- `npm run build`: passed; Vite emitted only the existing chunk-size warning.
- `npm run test:e2e` with a fresh server: passed, 5 mobile browser tests. This verified legacy Manual fallback, local scanner detection, DirectEditView body/hole/thickness interaction, long-press numeric editing, reload persistence, and native photo inputs.
- `git diff --check`: passed.
- `npm run build` with default environment: passed; generated asset URLs use `/napkin3d/` for GitHub Pages.
- `VERCEL=1 npm run build`: passed; generated asset URLs use `/` for a Vercel deployment root.
- `npx playwright test e2e/workflow.spec.ts -g "automatic scanner"`: passed, 1 test. This verified local image processing, unresolved-measurement gating, confirmation, 3D opening, and manual hole diameter editing.
- `npx playwright test e2e/workflow.spec.ts -g "automatic"`: passed, 2 tests. This verified separate camera/gallery input attributes, native filechooser activation, cancellation, and repeated image selection.
- Real-device smoke testing: not run.

Deployment architecture: `main` -> GitHub Pages -> `https://gommez.github.io/napkin3d/`; `lab` -> Vercel Preview -> `https://napkin3d-2xjcoomoz-gommez.vercel.app`. Automatic GitHub-to-Vercel deployment remains unconfigured; this preview was deployed manually from `lab`.

The first E2E attempt exposed only a test navigation assumption after reload; the test was corrected to re-enter Manual and then passed. No product regression was found.

## Updated

2026-09-18
## LAB diagnostic block — 2026-09-18

This entry supersedes earlier contradictory claims that automatic interpretation
is wholly absent or that OCR implementation has been selected. The existing
assisted raster geometry scanner is implemented; OCR and text association are
not. Existing model/holes, deployment boundaries and manual editor decisions
remain unchanged.

- Started on `lab`, latest commit `a198d49` (`chore: trigger Vercel preview`).
  There was already an uncommitted native camera/gallery input change in
  `src/AutomaticScanner.tsx`; it was preserved.
- Added a temporary collapsible LAB diagnostic panel in AutomaticScanner,
  including geometry failures, original photo overlay, ink component boxes,
  preprocessing parameters, explicit absent OCR/association stages, manual
  answers, unresolved properties and the exact Part prepared for confirmation.
- The scanner still performs the same geometry calculations. No OCR dependency,
  recognition fix, association heuristic, thickness inference, model schema
  change, touch editor change, CAD feature or deployment was introduced.
- Text is not lost downstream: it is never recognized. Intermediate ink
  components previously disappeared after geometric filtering; the optional
  diagnostic callback now exposes all components including <4-pixel rejects.
- Diagnostic data is local and ephemeral. Full original photo remains in memory
  during review. Large/noisy photos can yield many component boxes and a large
  JSON report; this temporary inspector is not a text detector.
- Instructions and detailed findings: `docs/SCANNER_DIAGNOSTICS.md`.
- TEST-001 photo and real-device validation were not available/performed.
  Synthetic fixtures verify instrumentation only, not real OCR.

### Decisions pending after diagnostics

Choose an OCR/text-localization approach only after reviewing TEST-001 evidence.
No technology choice or new association policy has been made. A distant number
must not yet be inferred as thickness. The next block needs explicit approval
for recognition work; this block stops at diagnostics.

### Diagnostic block verification

- `npm test`: passed, 4 files / 19 tests.
- `npm run lint`: passed.
- `npm run build`: passed; existing >500 kB chunk warning remains.
- `CI=1 npm run test:e2e`: passed, 5 mobile Chromium tests, including
  diagnostic overlay/JSON, unresolved inputs, prepared model and existing
  photo import, touch editing, calibration, undo/redo, persistence and exports.
  First sandbox attempt failed to bind port 4173 (EPERM); authorized execution
  outside the sandbox passed. No browser/dependency installation was needed.
- `git diff --check`: passed.
- No commit, push, merge, main changes or production deployment.

## Investigación OCR local — 2026-09-18

- Investigación documental solamente sobre `lab`, commit `a198d49`; preservados
  los cambios sin commit del diagnóstico. No se modificó el pipeline ni se
  instalaron dependencias/modelos. Informe: `docs/OCR_SELECTION.md`.
- Comparados TextDetector nativo, OCRad.js, Tesseract.js, PaddleOCR.js y un
  reconocedor específico. Tesseract.js ofrece cajas pero su FAQ descarta
  manuscrito fiable. PaddleOCR tiene SDK oficial browser (fuente 0.4.2),
  polígonos/texto/score y modelos PP-OCRv6 tiny/small; implica ORT + OpenCV.js.
- Recomendación pendiente: piloto aislado PaddleOCR.js + PP-OCRv6 tiny en
  worker/WASM CPU, assets locales; Tesseract como alternativa si se acepta
  explícitamente el límite de manuscrito. No hay ganador medido en TEST-001.
- Componentes conectados pueden proponer recortes, pero no deben excluir
  puntos/comas pequeños, trazos unidos a cotas o números alejados. Comparar
  imagen global y crops del original; mantener transformaciones hasta píxeles
  originales. La asociación dimensional sigue diferida.
- Peso y latencias son estimaciones documentales, no benchmarks locales.
  Ningún motor fue ejecutado; TEST-001 y móvil real siguen pendientes.
- Cero coste por inferencia es viable; PWA necesita cachear explícitamente
  worker, WASM y modelos del mismo origen. El SW actual no prepara esos assets.

### Decisions pending — selección OCR

Solicitar decisión antes de añadir la dependencia importante: piloto PaddleOCR.js
con PP-OCRv6 tiny (recomendado), o Tesseract.js aceptando impreso como alcance
fiable. Alternativa propia implica dataset/entrenamiento y queda diferida.
No se tomó ni implementó una decisión arquitectónica. Próximo paso: autorización
del piloto y validación separada de OCR/localización en TEST-001.

### Verificación del bloque de investigación

- Solo se añadieron `docs/OCR_SELECTION.md` y esta actualización de `STATUS.md`.
- `npm test`: 19 pruebas / 4 archivos pasan; `npm run lint`: pasa;
  `npm run build`: pasa con el aviso previo de chunk >500 kB;
  `git diff --check`: pasa.
- No se repitió E2E en este bloque documental; los 5 E2E del bloque diagnóstico
  siguen siendo la última verificación móvil automatizada, no pruebas OCR.
- Sin instalación, commit, push, merge ni deployment. STOP antes del piloto.

## Piloto PaddleOCR local — 2026-09-18

- Se mantuvieron todos los cambios previos del diagnóstico y se integró, solo
  en `lab`, `@paddleocr/paddleocr-js` `0.4.2` con modelos PP-OCRv6 tiny.
  ONNX Runtime Web quedó fijado por override a `1.24.3` para coincidir con el
  worker del SDK.
- La importación es dinámica: PaddleOCR no se carga al abrir Napkin3D, solo al
  procesar una foto del Automatic Scanner. El pipeline geométrico sigue siendo
  independiente y recibe el mismo canvas; no se usan connected components como
  detector OCR.
- OCR ejecuta localmente sobre la foto completa en el navegador, con backend
  WASM y un hilo. No hay API, backend, key ni CDN de runtime/modelos en la
  configuración de la aplicación. Se sirven desde `public/ocr/` los dos tar de
  modelos oficiales y los cuatro assets ORT WASM/JSEP requeridos.
- La salida real del SDK es `items[]: { poly, text, score }`. Napkin3D guarda
  además `id`, `bbox`, `coordinateSpace: original-image-pixels`, tiempos,
  backend/proveedor y versión del motor. La transformación escala las esquinas
  del resultado del canvas reducido a las dimensiones originales; no convierte
  a mm ni modifica `Part`.
- El diagnóstico muestra overlay magenta con texto (`[80]`, etc. cuando el
  motor los reconoce), tabla texto/x/y/width/height/score interno y métricas de
  inicialización, detección, reconocimiento y total. No muestra score al
  usuario como porcentaje. `ASOCIACIÓN: NOT_IMPLEMENTED` permanece explícito.
- Se añadió una prueba E2E sintética impresa que verificó detecciones reales,
  polígonos, cajas positivas y coordenadas originales. No demuestra manuscrito
  ni TEST-001 físico. La prueba inicial encontró un asset
  `ort-wasm-simd-threaded.jsep.mjs` faltante; se añadió junto a su WASM local.
- Assets: `public/ocr/models/` 6,318,080 bytes; `public/ocr/ort/` 37,447,368
  bytes (43,765,448 bytes en total). `dist/` queda aproximadamente en 88 MB.
  La build conserva el aviso de
  chunks grandes y el entorno necesita más memoria para completar Vite.

### Verificación del piloto

- `npm test`: 19 pruebas / 4 archivos pasan.
- `npm run lint`: pasa.
- `npm run build`: generado con los assets OCR locales; Vite conserva el aviso
  de chunks >500 kB y advertencias de externalización `fs/path/crypto` desde
  OpenCV.js. La build en este entorno requiere memoria elevada para terminar.
- `CI=1 npm run test:e2e`: 6 pruebas pasan, incluyendo el diagnóstico y el
  E2E sintético de OCR. El test usa Chromium
  y no es evidencia de manuscrito ni de TEST-001 real.
- `git diff --check`: pasa.
- Sin commit, push, merge, despliegue ni cambios en `main`.

### Próximo paso recomendado

Probar TEST-001 impreso y manuscrito en un móvil real, registrar detecciones,
posiciones, tiempos y errores de inicialización, y comprobar arranque offline
con los assets ya servidos localmente. No implementar asociación semántica hasta
revisar esas detecciones.
