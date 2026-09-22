# Architecture

- `App.tsx`: project hierarchy, mode selection, ordered IndexedDB autosave, exports.
- `model.ts`: discriminated entity union and pure geometry helpers, in mm.
- `Editor.tsx`: SVG viewport as a rendering surface, Pointer Events for drawing/manipulation, numeric properties, photo calibration and local snapshot history.
- `Viewer.tsx`: lazy-loaded Three.js renderer, OrbitControls, camera presets and display styles. GPU resources are released on unmount.
- `export.ts`: pure model-to-SVG and model-to-Three.js/STL adapters. Future serializers should consume Part directly.
- `storage.ts`: idb wrapper, one atomic versioned workspace document in IndexedDB. Save failures are visible. Project edits are serialized to avoid out-of-order writes.
- `scanner.ts` and `AutomaticScanner.tsx`: deterministic browser-local preprocessing and assisted interpretation for one rectangular contour and circular holes. The scanner resolves uncertainty through explicit OCR-derived or user-confirmed measurements before creating a `Part`.
- `association.ts`: pure, transient evidence engine that maps detected geometry features and OCR annotations into candidate dimensional constraints. V0 functionally supports only outer rectangle width/height, but the core accepts generic features so later adapters can add circles, segments, polygon edges and contour dimensions without replacing the engine.
- `geometryPreprocessing.ts`: generic local `InkMap` generation for geometry. It keeps the current global Otsu pipeline as A and compares it with V1 local illumination normalization; the detector remains shape-specific only in its existing adapter.
- `public/`: manifest, icon and network-first service worker. Visited assets are cached for offline reuse; open the 3D viewer online once before relying on it offline. No first-load offline guarantee.

Photo pixel coordinates become model coordinates through mmPerPixel, anchored at the 2D origin. SVG coordinates are +Y down; Three.js flips Y and extrudes along +Z. Solids are centred as a group before applying explicit part orientation. Camera movement is ephemeral and never persisted as geometry.

Automatic interpretation now follows:

```text
Image
→ detected geometry/features
→ OCR annotations
→ evidence-based association
→ resolved geometric constraints
→ parametric model
```

Explicit dimensions override sketch proportions. When width and height are both
read from annotations, they become independent constraints; a single global
pixel/mm scale must not silently change one explicit value to match the drawn
ratio. Pixel proportions remain useful as secondary evidence and for provisional
derived values.

Geometry preprocessing preserves the original photo and stays separate from OCR.
Its output is an `InkMap`, not a rectangle: future contour adapters can consume
the same representation for closed polygons, curves and arbitrary silhouettes.
ClosedContour V0 remains a later block.

Deployment: Vite base `/napkin3d/`, GitHub Actions validates and uploads `dist`, then deploys with Pages OIDC. Enable Settings → Pages → Source: GitHub Actions. There is no server route dependency.

Parametric subtraction: `Hole` is an explicit entity with an `outerId`; it is
not inferred from order, color, naming, or nesting. `export.ts` builds each
rectangle as one `THREE.Shape` with linked circular `Shape.holes`, so the 3D
viewer and STL exporter consume the same physical geometry without a general
CSG dependency. Legacy `Circle` entities remain additive during v1-to-v2
migration.

MVP tradeoffs: one document per device, bounded undo history, no general CAD
topology, independent overlapping meshes, a tessellated circle in STL, and a
deterministic scanner limited to simple axis-aligned raster contours. Very
large projects will need granular persistence and virtualized lists later.
