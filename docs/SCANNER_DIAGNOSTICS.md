# LAB temporary scanner diagnostics

This block is observation only. No OCR engine or text detector exists in the
current source or dependencies. No recognized strings, numeric tokens, text
bounding boxes, confidence scores or text-to-dimension associations exist.
The geometry report still describes its original raster stages. OCR is now a
separate local PaddleOCR pilot; `NOT_IMPLEMENTED` applies only to association.

## Local TEST-001 procedure

On `lab`, run `npm run dev` and open http://localhost:5173/napkin3d/.
For a production build use `npm run build` then `npm run preview` and open
http://localhost:4173/napkin3d/. No deployment is required or performed.
For phone gallery testing use the forwarded development port or the host's
reachable LAN address. Camera availability depends on browser/secure context.

Choose PROYECTO AUTOMÁTICO → ELEGIR FOTO → select the real TEST-001 photo →
expand LAB · Diagnóstico temporal. Use the same photo with the rectangle,
circular hole, horizontal number, vertical number, hole number/Øn and distant
number. The actual TEST-001 photograph is not supplied in this repository and
has not been tested in this block.

Inspect the original image overlay, component coordinates, OCR and association
status, reconstructed geometry, pending inputs and full JSON. Boxes mark ink
components, **not text detections**. Connected strokes can combine letters,
dimensions and geometry into one component. Labels identify components, not
recognized characters. Compare the distant number's component(s) manually;
there is no thickness heuristic. Enter manual width, hole diameter and depth:
the JSON updates to show the exact prepared Part sent upon confirmation.
Before confirmation it is prepared, not yet stored. Diagnostics also remain
available when no outer contour can be detected. They are ephemeral and do not
change the stored schema. The original photo stays in browser memory only.

## Evidence and pipeline

1. Browser image decoding; canvas resized to maximum side 1000 px, each axis
   at least 8 px. Separate X/Y factors map raster coordinates to original image.
2. Rounded grayscale 0.299R + 0.587G + 0.114B; min/max normalization to 0–255;
   Otsu threshold; dark pixels <= threshold; 8-connected components.
3. All component min/max bounds (inclusive), pixel counts and retention flags
   are now observable. Components smaller than 4 pixels are discarded by the
   existing detector. Previously intermediate components were not returned.
4. Retained components are sorted by bounding area. First bounding box spanning
   at least 20% of each image axis supplies the outer rectangle. Other roughly
   square, smaller components whose centres lie inside become hole candidates.
   This is not robust contour or circle recognition; text could contaminate it.
5. OCR is a separate local PaddleOCR stage. Its detections are kept as text,
   polygon, derived bbox, score and original-image coordinates. Text-to-property
   association remains `NOT_IMPLEMENTED`; OCR never writes model dimensions.
6. `resolveScan` accepts only manual width, hole diameters and thickness.
   Scale = manual width / outer pixel width. Height and hole centres derive
   from that scale. `partFromScan` creates the model only when resolved.
   The read-only diagnostic displays that same prepared Part, including IDs.

JPEG quality 0.85 is used for the photo attached to the part, after the canvas
pixels were scanned; it is not an OCR preprocessing step. No deskewing,
perspective correction, text-region extraction or OCR library is present.

## Validation boundary / next decision

Synthetic unit fixtures verify trace preservation, rejected components,
geometry failure visibility and unresolved/model values. Mobile Chromium E2E
checks diagnostic UI and the existing workflows. Neither proves OCR recognition
of a real photo. No real-device or TEST-001 recognition claim is made.

Next: collect TEST-001 evidence and decide explicitly on a browser-local OCR/text
localization approach before installing anything. Recognition with positional
output must exist and be validated before dimension association is designed.
Distant-number-to-thickness inference remains deferred.
