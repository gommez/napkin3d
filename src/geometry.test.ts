import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import {
  anchors,
  bounds,
  calibration,
  move,
  newPart,
  snap,
  type Entity,
} from "./model";
import { buildPart, disposePart, exportSTL, exportSVG } from "./export";
const rectangle: Entity = {
  id: "rect",
  type: "rectangle",
  x: 10,
  y: 20,
  width: 30,
  height: 40,
};
describe("parametric geometry", () => {
  it("moves independent entities without changing dimensions", () => {
    expect(move(rectangle, -5, 2)).toEqual({ ...rectangle, x: 5, y: 22 });
    expect(rectangle.x).toBe(10);
    expect(
      move({ id: "l", type: "line", x1: 0, y1: 1, x2: 3, y2: 4 }, 2, 3),
    ).toMatchObject({ x1: 2, y1: 4, x2: 5, y2: 7 });
  });
  it("finds corners, centres and accurate mixed bounds", () => {
    expect(anchors(rectangle)).toContainEqual({ x: 25, y: 40 });
    expect(
      bounds([
        rectangle,
        { id: "c", type: "circle", x: 0, y: 0, diameter: 10 },
      ]),
    ).toEqual({ x: -5, y: -5, width: 45, height: 65 });
  });
  it("prioritizes nearby feature snapping over grid and respects tolerance", () => {
    expect(snap({ x: 10.1, y: 20.1 }, [rectangle], true, true, 1)).toEqual({
      x: 10,
      y: 20,
    });
    expect(snap({ x: 12.3, y: 22.6 }, [rectangle], true, true, 0.1)).toEqual({
      x: 12,
      y: 23,
    });
    expect(snap({ x: 12.3, y: 22.6 }, [], false, false, 1)).toEqual({
      x: 12.3,
      y: 22.6,
    });
  });
  it("calibrates photo pixels to physical mm", () => {
    expect(calibration(200, 50)).toBe(0.25);
    expect(() => calibration(0, 20)).toThrow();
    expect(() => calibration(30, -2)).toThrow();
  });
});
describe("exports and extrusion", () => {
  it("preserves mm dimensions in SVG", () => {
    const part = { ...newPart("f", "test"), entities: [rectangle] };
    const svg = exportSVG(part);
    expect(svg).toContain('width="30mm" height="40mm"');
    expect(svg).toContain('viewBox="10 20 30 40"');
    expect(svg).toContain('<rect x="10" y="20" width="30" height="40"/>');
  });
  it("extrudes a watertight box with correct size and volume", () => {
    const part = { ...newPart("f", "test"), entities: [rectangle], depth: 5 };
    const group = buildPart(part);
    const size = new THREE.Box3()
      .setFromObject(group)
      .getSize(new THREE.Vector3());
    expect(size.toArray()).toEqual([30, 40, 5]);
    const geometry = new STLLoader().parse(exportSTL(part));
    const p = geometry.getAttribute("position");
    let volume = 0;
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i),
        b = new THREE.Vector3().fromBufferAttribute(p, i + 1),
        c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      volume += a.dot(b.cross(c)) / 6;
    }
    expect(Math.abs(volume)).toBeCloseTo(6000);
    geometry.dispose();
    disposePart(group);
  });
  it("applies orientation to STL, ignores lines and keeps shapes separate", () => {
    const part = {
      ...newPart("f", "test"),
      entities: [
        rectangle,
        { id: "c", type: "circle", x: 60, y: 0, diameter: 10 },
        { id: "l", type: "line", x1: 0, y1: 0, x2: 100, y2: 100 },
      ] as Entity[],
      orientation: [90, 0, 0] as [number, number, number],
    };
    const group = buildPart(part);
    expect(group.children).toHaveLength(2);
    const mesh = new STLLoader().parse(
      exportSTL({ ...part, entities: [rectangle] }),
    );
    mesh.computeBoundingBox();
    expect(mesh.boundingBox!.getSize(new THREE.Vector3()).toArray()).toEqual([
      30, 5, 40,
    ]);
    mesh.dispose();
    disposePart(group);
  });
});
