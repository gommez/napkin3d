import { expect, it } from "vitest";
import { diagnosticValues } from "./ScanDiagnostics";
import { partFromScan, type ScanResult } from "./scanner";

it("tracks missing inputs and model dimensions without inventing text associations", () => {
  const scan: ScanResult = { imageWidth: 100, imageHeight: 80, outer: { x: 10, y: 10, width: 80, height: 60, state: "DETECTED" }, holes: [{ id: "h", x: 50, y: 40, diameter: 16, state: "DETECTED" }] };
  expect(diagnosticValues(scan, { holeDiametersMm: {} }).unresolved).toEqual(["referenceWidthMm", "scaleMmPerPixel", "outer.heightMm (derived)", "h.diameterMm", "thicknessMm"]);
  const answers = { referenceWidthMm: 160, thicknessMm: 5, holeDiametersMm: { h: 10 } };
  const report = diagnosticValues(scan, answers);
  expect(report.unresolved).toEqual([]);
  expect(report.resolution?.scaleMmPerPixel).toBe(2);
  const part = partFromScan(scan, answers);
  expect(part.entities[0]).toMatchObject({ width: 160, height: 120 });
  expect(part.entities[1]).toMatchObject({ x: 80, y: 60, diameter: 10 });
  expect(part.depth).toBe(5);
  expect(diagnosticValues(undefined, answers).resolution).toBeNull();
});
