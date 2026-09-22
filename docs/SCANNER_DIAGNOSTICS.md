# LAB temporary scanner diagnostics

Current LAB state: geometry instrumentation plus local PaddleOCR baseline,
TEST-002 regional calibration and ASOCIACIÓN V0 for outer rectangle width/height.
The physical iPhone follow-up recognized `50` and `30` with positions, enabling
the first evidence-based association block. TEST-002 regional calibration remains
available as a diagnostic. See `ASSOCIATION_V0.md` for the current association
contract. The geometry detector itself remains unchanged.

## Local TEST-001 procedure

On `lab`, run `npm run dev` and open http://localhost:5173/napkin3d/.
For a production build use `npm run build` then `npm run preview` and open
http://localhost:4173/napkin3d/. No deployment is required or performed.
For phone gallery testing use the forwarded development port or the host's
reachable LAN address. Camera availability depends on browser/secure context.

Choose PROYECTO AUTOMÁTICO → ELEGIR FOTO → select the real TEST-001 photo →
expand LAB · Diagnóstico temporal. Use the same photo with the rectangle,
circular hole, horizontal number, vertical number, hole number/Øn and distant
number. The actual TEST-001 photograph is not supplied in this repository. Its physical
iPhone outcome is recorded in STATUS.md.

Inspect the original image overlay, component coordinates, OCR, interpretation
status, reconstructed geometry, pending inputs and full JSON. Blue/gray boxes mark ink
components, **not text detections**; magenta polygons are baseline OCR detections. Connected strokes can combine letters,
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
5. OCR is a separate local PaddleOCR stage. Its detections are kept as raw text,
   polygon, derived bbox, score and original-image coordinates.
6. ASOCIACIÓN V0 converts detected geometry into transient features, OCR output
   into annotations, and evaluates candidates through semantic, spatial,
   geometry and OCR evidence. Functionally, only outer width/height can be
   auto-assigned today. TEST-002 regional OCR keeps its own diagnostic result and
   still does not become geometry by itself.
7. `resolveScan` combines explicit association dimensions and user answers.
   Width and height can have independent origins. If both are explicit, no single
   scale rewrites one to match the sketch. Derived values are labelled as
   `DERIVED`; user entries are `USER_CONFIRMED`. Hole centres still use the
   resolved X/Y scales, while hole diameters and thickness require confirmation.
   The read-only diagnostic displays that same prepared Part, including IDs.

JPEG quality 0.85 is used for the photo attached to the part, after the canvas
pixels were scanned; it is not an OCR preprocessing step. No deskewing or perspective correction is present. TEST-002 separately crops
baseline text regions from the original image for local OCR variants.

## Validation boundary / next decision

Synthetic unit fixtures verify trace preservation, rejected components,
geometry failure visibility, association evidence and unresolved/model values.
Mobile Chromium E2E checks diagnostic UI and existing workflows. Automated tests
still do not prove broad handwritten OCR quality.

Next: physically verify ASOCIACIÓN V0 on iPhone with the known `50 × 30` sketch:
check that `50` maps to outer width, `30` maps to outer height, only thickness is
requested, and no distant number becomes thickness. Distant-number-to-thickness
inference remains deferred.
