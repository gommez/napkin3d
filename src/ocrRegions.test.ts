import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  classifyDimension,
  cropBounds,
  experiments,
  mapDetection,
  preprocess,
} from "./ocrRegions";
import ScanDiagnostics from "./ScanDiagnostics";
import type { OcrDiagnostics } from "./ocr";
import { partFromScan, type ScanResult } from "./scanner";

describe("TEST-002 deterministic image operations", () => {
  it("expands outward with a minimum margin and clips at image edges", () => {
    expect(
      cropBounds({ x: 2.5, y: 3, width: 20, height: 10 }, 100, 80),
    ).toEqual({ x: 0, y: 0, width: 31, height: 21 });
    expect(
      cropBounds({ x: 75, y: 60, width: 25, height: 20 }, 100, 80),
    ).toEqual({ x: 67, y: 52, width: 33, height: 28 });
    expect(
      cropBounds({ x: 100, y: 100, width: 120, height: 80 }, 400, 400),
    ).toEqual({ x: 80, y: 80, width: 160, height: 120 });
  });
  it("maps all corners of a scaled crop back to original pixels without changing raw OCR", () => {
    const item = {
      id: "a",
      text: "5O",
      score: 0.6,
      bbox: { x: 0, y: 0, width: 0, height: 0 },
      polygon: [
        { x: 4, y: 6 },
        { x: 36, y: 2 },
        { x: 40, y: 18 },
        { x: 8, y: 20 },
      ],
    };
    const mapped = mapDetection(
      item,
      { x: 101, y: 203, width: 20, height: 10 },
      40,
      20,
    );
    expect(mapped.polygon).toEqual([
      { x: 103, y: 206 },
      { x: 119, y: 204 },
      { x: 121, y: 212 },
      { x: 105, y: 213 },
    ]);
    expect(mapped.bbox).toEqual({ x: 103, y: 204, width: 18, height: 9 });
    expect(mapped.text).toBe("5O");
    expect(item.polygon[0]).toEqual({ x: 4, y: 6 });
  });
  it("stretches grayscale, thresholds deterministically and preserves input/alpha", () => {
    const input = new Uint8ClampedArray([
      20, 20, 20, 255, 100, 100, 100, 128, 220, 220, 220, 255,
    ]);
    expect([...preprocess(input, false)]).toEqual([
      0, 0, 0, 255, 102, 102, 102, 128, 255, 255, 255, 255,
    ]);
    expect([...preprocess(input, true)]).toEqual([
      0, 0, 0, 255, 0, 0, 0, 128, 255, 255, 255, 255,
    ]);
    expect(input[0]).toBe(20);
    expect([
      ...preprocess(new Uint8ClampedArray([255, 255, 255, 255]), true),
    ]).toEqual([255, 255, 255, 255]);
  });
  it("isolates a single parameter change from image variants", () => {
    expect(
      experiments.slice(0, 5).every((v) => Object.keys(v.params).length === 0),
    ).toBe(true);
    expect(experiments[5]).toMatchObject({
      scale: 1,
      mode: "color",
      params: { textDetBoxThresh: 0.3 },
    });
  });
});
it.each(["72", "12.7", "12,7", "Ø8", "R6", "8x12", "8 × 12 mm", " 9 mm "])(
  "classifies %s without numeric conversion",
  (text) => expect(classifyDimension(text)).toBe("dimension-compatible"),
);
it.each(["5O", "", "Ø", "7..2", "S", "12foo"])(
  "marks %s ambiguous without substitutions",
  (text) => expect(classifyDimension(text)).toBe("ambiguous"),
);
it.each(["hello", "bonjour", "y"])("rejects %s as non-dimensional", (text) =>
  expect(classifyDimension(text)).toBe("non-dimension-compatible"),
);
it("keeps Part independent of diagnostic OCR and keeps interpretation visible", () => {
  const scan: ScanResult = {
    imageWidth: 100,
    imageHeight: 80,
    outer: { x: 10, y: 10, width: 80, height: 60, state: "DETECTED" },
    holes: [],
  };
  const answers = { referenceWidthMm: 72, thicknessMm: 6, holeDiametersMm: {} };
  const part = partFromScan(scan, answers),
    before = structuredClone(part);
  const ocr: OcrDiagnostics = {
    status: "READY",
    engine: "@paddleocr/paddleocr-js",
    version: "0.4.2",
    detections: [
      {
        id: "ocr-1",
        text: "999",
        score: 0.9,
        bbox: { x: 1, y: 2, width: 3, height: 4 },
        polygon: [],
      },
    ],
    coordinateSpace: "original-image-pixels",
    timings: {
      initializationMs: 0,
      detectionMs: 1,
      recognitionMs: 2,
      totalMs: 3,
    },
  };
  const html = renderToStaticMarkup(
    createElement(ScanDiagnostics, {
      capture: {
        original: "data:image/png;base64,",
        originalWidth: 100,
        originalHeight: 80,
        width: 100,
        height: 80,
        ocr,
      },
      scan,
      answers,
      part,
      error: "",
    }),
  );
  expect(html).toContain("OCR BASELINE");
  expect(html).toContain("OCR POR REGIONES");
  expect(html).toContain("INTERPRETACIÓN");
  expect(part).toEqual(before);
  expect(part.depth).toBe(6);
});
