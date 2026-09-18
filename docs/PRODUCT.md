# Product

napkin3d helps a person with a rough sketch make a dimensioned geometric part on a phone.

## Automatic mode principles

Automatic Mode has zero recurring operating cost. Image processing runs locally
in the browser with no external AI, API, cloud vision, OCR service, backend, or
API key. Recognition may be uncertain: Napkin3D automates what it knows, asks
when it is uncertain, and never invents geometry. A part cannot become ready
for export while required scale, hole dimensions, or thickness remain
unresolved. The internal parametric model remains the source of truth.

Automatic Mode currently supports the first assisted scanner milestone: one
rectangular outer contour, zero or more explicit circular through-holes, a user
reference width, confirmed hole diameters, and user-supplied thickness. The
result is opened in the existing editable 3D/manual workflow.

## First workflow

1. Create a project and part (the default folder is “Parts”).
2. Use Camera or Add photo. Images stay on this device and are resized to at most 2000 pixels per side.
3. Choose Calibrate, tap two known points, enter their distance in mm, and apply. Fit the view if needed.
4. Drag to draw rectangles, circles (centre to radius), or guide lines. Select to move; white handles resize. Numerical fields set exact mm dimensions. The entity list can select obscured shapes.
5. Switch to 3D, set extrusion depth and orbit the camera. Part orientation controls rotate the exported solid in 90° increments.
6. Download SVG for 2D or STL for 3D. Projects save automatically in this browser.

## Simple behavior

Rectangles are additive outer solids, legacy circles remain independent additive
solids, and explicit circular hole features subtract material from their linked
rectangle through the full extrusion. Overlaps are not fused. Lines never
extrude. STL has no unit metadata; import as mm. Exports exclude the
photograph. SVG uses the original 2D dimensions and even-odd paths for holes;
STL includes the actual through-holes, part orientation and centres the model at
the origin.

Calibration changes the image size in model space, preserving dimensions of existing geometry. Calibrate before tracing. Use mm/image pixel for manual adjustments. Grid lines are 5 mm; optional snapping is 1 mm or nearby endpoints/corners/centres. 2D zoom uses buttons or wheel; pan uses the Pan tool. 3D supports one-finger orbit and two-finger pinch/pan.

Undo/redo is available during the current 2D editing session (up to 50 edits); switching modes resets history. Files remain local, do not sync between devices, and may be lost when browser storage is cleared. Camera capture availability follows the phone/browser's file chooser support.
