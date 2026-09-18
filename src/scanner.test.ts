import { describe, expect, it } from "vitest";
import { partFromScan, resolveScan, scanRaster } from "./scanner";

function fixture() {
  const width = 100;
  const height = 80;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const pixel = (x: number, y: number, value = 0) => {
    const offset = (y * width + x) * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  };
  for (let x = 10; x <= 90; x++) {
    pixel(x, 10);
    pixel(x, 70);
  }
  for (let y = 10; y <= 70; y++) {
    pixel(10, y);
    pixel(90, y);
  }
  for (let y = 32; y <= 48; y++)
    for (let x = 42; x <= 58; x++)
      if (Math.hypot(x - 50, y - 40) <= 8) pixel(x, y);
  return { data, width, height };
}

describe("local assisted scanner", () => {
  it("detects one rectangular contour and one circular feature deterministically", () => {
    const scan = scanRaster(...Object.values(fixture()) as [Uint8ClampedArray, number, number]);
    expect(scan.outer).toMatchObject({ x: 10, y: 10, width: 80, height: 60 });
    expect(scan.holes).toHaveLength(1);
    expect(scan.holes[0]).toMatchObject({ x: 50, y: 40, state: "DETECTED" });
  });

  it("does not become ready while scale or thickness is unresolved", () => {
    const scan = scanRaster(...Object.values(fixture()) as [Uint8ClampedArray, number, number]);
    const missingScale = resolveScan(scan, { holeDiametersMm: {}});
    expect(missingScale.ready).toBe(false);
    const missingThickness = resolveScan(scan, {
      referenceWidthMm: 80,
      holeDiametersMm: {},
    });
    expect(missingThickness.ready).toBe(false);
  });

  it("requires hole confirmation and builds confirmed parametric geometry", () => {
    const scan = scanRaster(...Object.values(fixture()) as [Uint8ClampedArray, number, number]);
    const unresolvedHole = resolveScan(scan, {
      referenceWidthMm: 80,
      thicknessMm: 5,
      holeDiametersMm: {},
    });
    expect(unresolvedHole.ready).toBe(false);
    expect(unresolvedHole.holes[0].state).toBe("NEEDS_CONFIRMATION");
    const answers = {
      referenceWidthMm: 80,
      thicknessMm: 5,
      holeDiametersMm: { [scan.holes[0].id]: 10 },
    };
    const resolved = resolveScan(scan, answers);
    expect(resolved.ready).toBe(true);
    const part = partFromScan(scan, answers, "Scanned bracket");
    expect(part.depth).toBe(5);
    expect(part.entities).toHaveLength(2);
    expect(part.entities[0]).toMatchObject({ type: "rectangle", width: 80, height: 60 });
    expect(part.entities[1]).toMatchObject({ type: "hole", x: 40, y: 30, diameter: 10, outerId: part.entities[0].id });
  });
});

describe("temporary diagnostic instrumentation (synthetic pixels, not OCR evidence)", () => {
  it("preserves scan output and reports component positions, preprocessing and absent OCR", () => {
    const { data, width, height } = fixture();
    data[0] = data[1] = data[2] = 0;
    let trace: import("./scanner").RasterDiagnostics | undefined;
    const observed = scanRaster(data, width, height, value => { trace = value; });
    expect(observed).toEqual(scanRaster(data, width, height));
    expect(trace?.preprocessing).toEqual({ grayMin: 0, grayMax: 255, threshold: 0, connectivity: 8, minimumPixels: 4 });
    expect(trace?.components).toContainEqual({ id: "component-1", pixels: 1, minX: 0, minY: 0, maxX: 0, maxY: 0, retained: false });
    expect(trace?.components[1]).toMatchObject({ minX: 10, minY: 10, maxX: 90, maxY: 70, retained: true });
    expect(trace?.ocr).toEqual({ status: "NOT_IMPLEMENTED", textRegions: [], recognizedText: [] });
    expect(trace?.association).toEqual({ status: "NOT_IMPLEMENTED", matches: [] });
  });

  it("reports evidence even when geometry detection fails", () => {
    let trace: import("./scanner").RasterDiagnostics | undefined;
    expect(() => scanRaster(new Uint8ClampedArray(100 * 80 * 4).fill(255), 100, 80, value => { trace = value; })).toThrow();
    expect(trace?.components).toEqual([]);
  });
});
