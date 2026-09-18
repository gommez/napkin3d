# Data model (version 2)

IndexedDB database `napkin3d`, version 1, object store `documents`, key `workspace`:

```text
Document { version: 2, projects: Project[] }
Project { id, name, folders: Folder[], parts: Part[], createdAt, updatedAt }
Folder { id, name }
Part { id, name, folderId, sourceImage?, entities[], depth,
       orientation: [xDegrees, yDegrees, zDegrees], createdAt, updatedAt }
Photo { data: JPEG data URL, width: pixels, height: pixels,
        mmPerPixel, opacity: 0..1 }
Entity = Line | Rectangle | Circle | Hole
Line { id, type: 'line', x1, y1, x2, y2 }
Rectangle { id, type: 'rectangle', x, y, width, height }
Circle { id, type: 'circle', x, y, diameter }
Hole { id, type: 'hole', x, y, diameter, outerId }
```

All geometry coordinates and extrusion depth are mm. Rectangle x/y is its upper-left corner; circle x/y is its centre. Dimensions and depth are positive. IDs are UUIDs, dates ISO timestamps. Every part belongs to a folder in its project. Geometry, source image and calibration persist together; viewport, selection, camera and undo history do not persist.

`Circle` remains an additive solid for backward compatibility. `Hole` is an
explicit subtractive circular through-hole linked to one rectangle by
`outerId`; it is preserved by persistence, editing, 2D rendering, 3D rendering
and export. Version 1 documents migrate to version 2 without changing legacy
circles. Extend the discriminated entity union for new geometry and introduce
explicit migrations before changing persisted schemas. Never reconstruct the
authoritative model from SVG or STL.
