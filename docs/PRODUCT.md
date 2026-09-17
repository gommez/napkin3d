# Product

napkin3d helps a person with a rough sketch make a dimensioned geometric part on a phone.

## First workflow

1. Create a project and part (the default folder is “Parts”).
2. Use Camera or Add photo. Images stay on this device and are resized to at most 2000 pixels per side.
3. Choose Calibrate, tap two known points, enter their distance in mm, and apply. Fit the view if needed.
4. Drag to draw rectangles, circles (centre to radius), or guide lines. Select to move; white handles resize. Numerical fields set exact mm dimensions. The entity list can select obscured shapes.
5. Switch to 3D, set extrusion depth and orbit the camera. Part orientation controls rotate the exported solid in 90° increments.
6. Download SVG for 2D or STL for 3D. Projects save automatically in this browser.

## Simple behavior

Each rectangle/circle is an independent solid. Overlaps are not fused and nested shapes do not cut holes. Lines never extrude. Start with one closed shape for reliable slicing; multiple solids require checking in the slicer. STL has no unit metadata; import as mm. Exports exclude the photograph. SVG uses the original 2D dimensions; STL includes part orientation and centres the model at the origin.

Calibration changes the image size in model space, preserving dimensions of existing geometry. Calibrate before tracing. Use mm/image pixel for manual adjustments. Grid lines are 5 mm; optional snapping is 1 mm or nearby endpoints/corners/centres. 2D zoom uses buttons or wheel; pan uses the Pan tool. 3D supports one-finger orbit and two-finger pinch/pan.

Undo/redo is available during the current 2D editing session (up to 50 edits); switching modes resets history. Files remain local, do not sync between devices, and may be lost when browser storage is cleared. Camera capture availability follows the phone/browser's file chooser support.
