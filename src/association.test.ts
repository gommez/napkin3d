import { describe, expect, it } from "vitest";
import {
  annotationsFromOcr,
  associateAnnotations,
  associationFromScanAndOcr,
  featuresFromScan,
  generateCandidates,
  normalizeBox,
  type Annotation,
  type GeometryFeature,
} from "./association";
import { partFromScan, resolveScan, type ScanResult } from "./scanner";
import type { TextDetection } from "./ocr";

const scan: ScanResult = {
  imageWidth: 600,
  imageHeight: 400,
  outer: { x: 100, y: 100, width: 400, height: 300, state: "DETECTED" },
  holes: [],
};

function detection(id: string, text: string, bbox: { x: number; y: number; width: number; height: number }, score = 0.8): TextDetection {
  return {
    id,
    text,
    bbox,
    score,
    polygon: [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      { x: bbox.x, y: bbox.y + bbox.height },
    ],
  };
}

function annotation(id: string, text: string, bbox: { x: number; y: number; width: number; height: number }): Annotation {
  return annotationsFromOcr([detection(id, text, bbox)])[0];
}

describe("ASOCIACIÓN V0 geometry features and annotations", () => {
  it("normalizes raster feature coordinates to original image pixels", () => {
    expect(
      normalizeBox(
        { x: 10, y: 20, width: 30, height: 40 },
        { rasterWidth: 100, rasterHeight: 80, originalWidth: 1000, originalHeight: 400 },
      ),
    ).toEqual({ x: 100, y: 100, width: 300, height: 200 });
  });

  it("creates extensible features from the current rectangular adapter", () => {
    const features = featuresFromScan({
      ...scan,
      holes: [{ id: "hole-a", x: 300, y: 250, diameter: 40, state: "DETECTED" }],
    });
    expect(features.map((feature) => feature.id)).toEqual([
      "outer-width",
      "outer-height",
      "hole-a-diameter",
    ]);
    expect(features[0]).toMatchObject({
      kind: "linear-dimension",
      subjectKind: "outer-contour",
      property: "width",
      axis: "horizontal",
    });
    expect(features[2]).toMatchObject({
      kind: "diameter",
      subjectKind: "circle",
      property: "diameter",
      axis: "radial",
    });
  });

  it("preserves OCR raw text and syntax classification on annotations", () => {
    const [ocr] = annotationsFromOcr([
      detection("ocr-ambiguous", "5O", { x: 1, y: 2, width: 3, height: 4 }),
    ]);
    expect(ocr.rawText).toBe("5O");
    expect(ocr.classification).toBe("ambiguous");
  });

  it("generates semantic and spatial evidence without depending on absolute resolution", () => {
    const result = associationFromScanAndOcr(
      scan,
      [
        detection("w", "50", { x: 240, y: 60, width: 35, height: 24 }),
        detection("h", "30", { x: 50, y: 230, width: 35, height: 24 }),
      ],
    );
    expect(result.dimensions["outer-width"]).toMatchObject({
      valueMm: 50,
      origin: "EXPLICIT",
      annotationId: "w",
      rawText: "50",
    });
    expect(result.dimensions["outer-height"]).toMatchObject({
      valueMm: 30,
      origin: "EXPLICIT",
      annotationId: "h",
      rawText: "30",
    });
    expect(result.candidates.find((candidate) => candidate.id === "w->outer-width")?.evidences).toContainEqual(
      expect.objectContaining({ type: "spatial", status: "supporting", relation: "above outer contour" }),
    );

    const doubled = associationFromScanAndOcr(
      { ...scan, imageWidth: 1200, imageHeight: 800, outer: { ...scan.outer, x: 200, y: 200, width: 800, height: 600 } },
      [
        detection("w", "50", { x: 480, y: 120, width: 70, height: 48 }),
        detection("h", "30", { x: 100, y: 460, width: 70, height: 48 }),
      ],
    );
    expect(doubled.dimensions["outer-width"]?.valueMm).toBe(50);
    expect(doubled.dimensions["outer-height"]?.valueMm).toBe(30);
  });

  it("case A auto-assigns 50 above and 30 left to independent explicit dimensions", () => {
    const association = associationFromScanAndOcr(scan, [
      detection("width-annotation", "50", { x: 245, y: 58, width: 34, height: 22 }),
      detection("height-annotation", "30", { x: 54, y: 236, width: 34, height: 22 }),
    ]);
    const resolved = resolveScan(scan, { thicknessMm: 5, holeDiametersMm: {} }, association);
    expect(resolved.dimensions.outerWidth).toMatchObject({ valueMm: 50, state: "AUTO_ASSIGNED" });
    expect(resolved.dimensions.outerHeight).toMatchObject({ valueMm: 30, state: "AUTO_ASSIGNED" });
    expect(resolved.ready).toBe(true);
    const part = partFromScan(scan, { thicknessMm: 5, holeDiametersMm: {} }, association);
    expect(part.entities[0]).toMatchObject({ type: "rectangle", width: 50, height: 30 });
  });

  it("case B keeps a contradictory value raw and requires confirmation instead of rewriting it", () => {
    const result = associationFromScanAndOcr(scan, [
      detection("width", "50", { x: 245, y: 58, width: 34, height: 22 }),
      detection("height", "900", { x: 54, y: 236, width: 52, height: 22 }),
    ]);
    const heightCandidate = result.candidates.find((candidate) => candidate.id === "height->outer-height")!;
    expect(heightCandidate.rawText).toBe("900");
    expect(heightCandidate.valueMm).toBe(900);
    expect(heightCandidate.status).toBe("NEEDS_CONFIRMATION");
    expect(heightCandidate.evidences).toContainEqual(expect.objectContaining({ type: "geometry", status: "conflicting" }));
    expect(result.dimensions["outer-height"]).toBeUndefined();
  });

  it("case C derives a provisional height trace when only width is explicit", () => {
    const result = associationFromScanAndOcr(scan, [
      detection("width", "50", { x: 245, y: 58, width: 34, height: 22 }),
    ]);
    const resolved = resolveScan(scan, { thicknessMm: 5, holeDiametersMm: {} }, result);
    expect(resolved.dimensions.outerWidth).toMatchObject({ valueMm: 50, origin: "EXPLICIT" });
    expect(resolved.dimensions.outerHeight).toMatchObject({ valueMm: 37.5, origin: "DERIVED", state: "NEEDS_CONFIRMATION" });
  });

  it("case D marks competing plausible numbers for the same dimension as needing confirmation", () => {
    const result = associationFromScanAndOcr(scan, [
      detection("width-a", "50", { x: 225, y: 58, width: 34, height: 22 }),
      detection("width-b", "55", { x: 310, y: 58, width: 34, height: 22 }),
      detection("height", "30", { x: 54, y: 236, width: 34, height: 22 }),
    ]);
    const width = result.hypotheses.find((item) => item.featureId === "outer-width")!;
    expect(width.status).toBe("NEEDS_CONFIRMATION");
    expect(width.candidates.map((candidate) => candidate.rawText)).toEqual(["50", "55"]);
    expect(result.dimensions["outer-width"]).toBeUndefined();
  });

  it("case E leaves a far number unresolved", () => {
    const result = associationFromScanAndOcr(scan, [
      detection("far", "50", { x: 700, y: 0, width: 34, height: 22 }),
    ]);
    expect(result.hypotheses.find((item) => item.featureId === "outer-width")?.status).toBe("UNRESOLVED");
    expect(result.hypotheses.find((item) => item.featureId === "outer-height")?.status).toBe("UNRESOLVED");
    expect(result.dimensions["outer-width"]).toBeUndefined();
  });

  it("accepts non-rectangle linear features through the same association engine", () => {
    const feature: GeometryFeature = {
      id: "segment-length",
      kind: "linear-dimension",
      subjectId: "segment-a",
      subjectKind: "segment",
      property: "length",
      axis: "horizontal",
      bbox: { x: 100, y: 200, width: 250, height: 1 },
      measuredPixels: 250,
    };
    const result = associateAnnotations([feature], [
      annotation("segment-text", "25.5", { x: 190, y: 160, width: 48, height: 20 }),
    ]);
    expect(result.hypotheses[0]).toMatchObject({
      featureId: "segment-length",
      status: "AUTO_ASSIGNED",
    });
    expect(result.dimensions["segment-length"]).toMatchObject({
      valueMm: 25.5,
      origin: "EXPLICIT",
    });
  });

  it("does not let OCR score alone assign a spatially unrelated annotation", () => {
    const features = featuresFromScan(scan);
    const candidates = generateCandidates(features, [
      annotation("far", "50", { x: 700, y: 0, width: 34, height: 22 }),
    ]);
    expect(candidates.find((candidate) => candidate.featureId === "outer-width")?.evidences).toContainEqual(
      expect.objectContaining({ type: "ocr", status: "accepted" }),
    );
    expect(candidates.find((candidate) => candidate.featureId === "outer-width")?.status).toBe("UNRESOLVED");
  });
});
