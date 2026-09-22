import { describe, expect, it } from "vitest";
import { preprocessGeometry, summarizeInkMap } from "./geometryPreprocessing";
import { scanRaster } from "./scanner";

function image(width: number, height: number, paint: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      const offset = (y * width + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
    }
  }
  return data;
}

function count(values: Uint8Array) {
  return values.reduce((sum, value) => sum + value, 0);
}

describe("PREPROCESSING V1 geometry InkMap", () => {
  it("preserves thin and thick strokes on a uniform background", () => {
    const data = image(120, 80, (x, y) => {
      const stroke = x === 20 || (x >= 60 && x < 66 && y > 20 && y < 60) || (x === 90 && y === 15);
      return stroke ? [25, 45, 180] : [245, 245, 245];
    });
    const maps = preprocessGeometry(data, 120, 80);
    expect(count(maps.v1.binary)).toBeGreaterThan(0);
    expect(count(maps.v1.binary)).toBeGreaterThanOrEqual(count(maps.baseline.binary) * 0.5);
    expect(maps.v1.parameters.illuminationRadius).toBeGreaterThan(0);
    expect(maps.v1.parameters.thresholdMethod).toBe("local-background-otsu");
  });

  it("reduces a smooth lateral shadow without deleting the drawn line", () => {
    const data = image(160, 100, (x, y) => {
      const background = 245 - Math.round((x / 159) * 105);
      const stroke = Math.abs(y - 50) <= 1 && x > 25 && x < 135;
      return stroke ? [20, 35, 120] : [background, background, background];
    });
    const maps = preprocessGeometry(data, 160, 100);
    const baselineForeground = count(maps.baseline.binary);
    const v1Foreground = count(maps.v1.binary);
    expect(v1Foreground).toBeGreaterThan(0);
    expect(v1Foreground).toBeLessThan(baselineForeground);
  });

  it("handles radial vignetting while retaining a thin contour", () => {
    const data = image(140, 100, (x, y) => {
      const distance = Math.hypot((x - 70) / 70, (y - 50) / 50);
      const background = Math.max(90, 240 - Math.round(distance * 65));
      const stroke = x > 25 && x < 115 && Math.abs(y - 50) <= 1;
      return stroke ? [25, 50, 160] : [background, background, background];
    });
    const maps = preprocessGeometry(data, 140, 100);
    expect(count(maps.v1.binary)).toBeGreaterThan(0);
    expect(count(maps.v1.binary)).toBeLessThanOrEqual(count(maps.baseline.binary));
  });

  it("keeps isolated noise observable instead of deleting it in preprocessing", () => {
    const data = image(64, 64, (x, y) => (x === 4 && y === 4 ? [0, 0, 0] : [240, 240, 240]));
    const maps = preprocessGeometry(data, 64, 64);
    const summary = summarizeInkMap(maps.v1, [1]);
    expect(summary.tinyComponentCount).toBe(1);
    expect(count(maps.v1.binary)).toBeGreaterThan(0);
  });

  it("keeps relative behavior when the same drawing is doubled in resolution", () => {
    const small = image(80, 60, (x, y) => {
      const stroke = (x >= 10 && x < 70 && (y === 10 || y === 49)) ||
        (y >= 10 && y < 50 && (x === 10 || x === 69));
      return stroke ? [20, 40, 150] : [240, 240, 240];
    });
    const large = image(160, 120, (x, y) => {
      const sx = Math.floor(x / 2);
      const sy = Math.floor(y / 2);
      const stroke = (sx >= 10 && sx < 70 && (sy === 10 || sy === 49)) ||
        (sy >= 10 && sy < 50 && (sx === 10 || sx === 69));
      return stroke ? [20, 40, 150] : [240, 240, 240];
    });
    const smallMap = preprocessGeometry(small, 80, 60).v1;
    const largeMap = preprocessGeometry(large, 160, 120).v1;
    const smallRatio = count(smallMap.binary) / smallMap.binary.length;
    const largeRatio = count(largeMap.binary) / largeMap.binary.length;
    expect(Math.abs(smallRatio - largeRatio)).toBeLessThan(0.04);
  });

  it("reports A/B maps, components and proposals without changing the A result", () => {
    const width = 100;
    const height = 80;
    const data = image(width, height, (x, y) => {
      const outline = (x === 10 || x === 90) && y >= 10 && y <= 70 || (y === 10 || y === 70) && x >= 10 && x <= 90;
      return outline ? [0, 0, 0] : [255, 255, 255];
    });
    let trace: import("./scanner").RasterDiagnostics | undefined;
    const scan = scanRaster(data, width, height, (next) => { trace = next; });
    expect(scan.outer).toMatchObject({ x: 10, y: 10, width: 80, height: 60 });
    expect(trace?.inkMaps.baseline.mode).toBe("baseline");
    expect(trace?.inkMaps.v1.mode).toBe("v1");
    expect(trace?.componentsV1).toBeDefined();
    expect(trace?.proposals.baseline.outer).toMatchObject({ x: 10, y: 10 });
    expect(trace?.preprocessingAB.comparison).toHaveProperty("foregroundRatioDelta");
  });
});
