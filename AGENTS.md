# napkin3d working rules

Objective: turn a photographed sketch into manually traced, editable millimetre geometry and an extruded printable model. Prioritize a complete, usable phone workflow over CAD sophistication.

- Client-only React + TypeScript + Vite. Three.js renders and exports solids; IndexedDB stores local projects. No backend or accounts.
- The typed parametric model in `src/model.ts` is the source of truth. Every entity has a stable unique ID. SVG/STL are derived exports, never editable storage formats.
- Design for iPhone/Android first: large touch targets, Pointer Events, simple PROJECT / 2D / 3D modes. Desktop also works.
- Keep modules small and dependencies purposeful. Independent rectangles/circles extrude separately; no implied boolean union or holes.
- Dimensions are mm. Camera orbit must never change part orientation. Part orientation affects STL only.
- Test geometry calculations, export dimensions/orientation and persistence. Run `npm test`, `npm run lint`, and `npm run build` before finishing changes. Build includes strict TypeScript checking. Run `npm run test:e2e` for the production mobile browser workflow (first install Chromium with `npx playwright install --with-deps chromium`).
- Development: `npm ci`, `npm run dev`. Production smoke check: `npm run build`, `npm run preview`, visit `/napkin3d/`.
- For interaction changes, smoke-test photo import, draw/select/move/resize, numeric editing, calibration, undo/redo, reload persistence and export at a mobile viewport. Report real-device checks separately from automated checks.
- Explicitly deferred: CV, OCR, AI sketch interpretation, constraint solver, boolean CAD, arbitrary closed line profiles, holes, STEP, DXF, 3MF, OBJ, PDF, cloud sync and collaboration.
