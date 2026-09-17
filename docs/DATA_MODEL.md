# Data model (version 1)

IndexedDB database `napkin3d`, version 1, object store `documents`, key `workspace`:

```text
Document { version: 1, projects: Project[] }
Project { id, name, folders: Folder[], parts: Part[], createdAt, updatedAt }
Folder { id, name }
Part { id, name, folderId, sourceImage?, entities[], depth,
       orientation: [xDegrees, yDegrees, zDegrees], createdAt, updatedAt }
Photo { data: JPEG data URL, width: pixels, height: pixels,
        mmPerPixel, opacity: 0..1 }
Entity = Line | Rectangle | Circle
Line { id, type: 'line', x1, y1, x2, y2 }
Rectangle { id, type: 'rectangle', x, y, width, height }
Circle { id, type: 'circle', x, y, diameter }
```

All geometry coordinates and extrusion depth are mm. Rectangle x/y is its upper-left corner; circle x/y is its centre. Dimensions and depth are positive. IDs are UUIDs, dates ISO timestamps. Every part belongs to a folder in its project. Geometry, source image and calibration persist together; viewport, selection, camera and undo history do not persist.

Extend the discriminated entity union for new geometry. Introduce explicit migrations before changing persisted schemas. Never reconstruct the authoritative model from SVG or STL.
