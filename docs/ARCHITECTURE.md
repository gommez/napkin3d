# Architecture

- `App.tsx`: project hierarchy, mode selection, ordered IndexedDB autosave, exports.
- `model.ts`: discriminated entity union and pure geometry helpers, in mm.
- `Editor.tsx`: SVG viewport as a rendering surface, Pointer Events for drawing/manipulation, numeric properties, photo calibration and local snapshot history.
- `Viewer.tsx`: lazy-loaded Three.js renderer, OrbitControls, camera presets and display styles. GPU resources are released on unmount.
- `export.ts`: pure model-to-SVG and model-to-Three.js/STL adapters. Future serializers should consume Part directly.
- `storage.ts`: idb wrapper, one atomic versioned workspace document in IndexedDB. Save failures are visible. Project edits are serialized to avoid out-of-order writes.
- `public/`: manifest, icon and network-first service worker. Visited assets are cached for offline reuse; open the 3D viewer online once before relying on it offline. No first-load offline guarantee.

Photo pixel coordinates become model coordinates through mmPerPixel, anchored at the 2D origin. SVG coordinates are +Y down; Three.js flips Y and extrudes along +Z. Solids are centred as a group before applying explicit part orientation. Camera movement is ephemeral and never persisted as geometry.

Deployment: Vite base `/napkin3d/`, GitHub Actions validates and uploads `dist`, then deploys with Pages OIDC. Enable Settings → Pages → Source: GitHub Actions. There is no server route dependency.

MVP tradeoffs: one document per device, bounded undo history, no general CAD topology, independent overlapping meshes, and a tessellated circle in STL. Very large projects will need granular persistence and virtualized lists later.
