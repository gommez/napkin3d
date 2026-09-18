import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import {
  anchors,
  bounds,
  calibration,
  move,
  newPart,
  updateDepth,
  updateHole,
  updateRectangle,
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
  it("resizes a body from one side and clamps linked holes", () => {
    const part = {
      ...newPart("f", "body"),
      entities: [
        { id: "body", type: "rectangle", x: 10, y: 20, width: 80, height: 40 },
        { id: "hole", type: "hole", x: 85, y: 40, diameter: 10, outerId: "body" },
      ] as Entity[],
    };
    const resized = updateRectangle(part, "body", "right", 60);
    expect(resized.entities[0]).toMatchObject({ x: 10, width: 50 });
    expect(resized.entities[1]).toMatchObject({ x: 55, y: 40, diameter: 10 });
    expect(updateRectangle(part, "body", "left", 30).entities[0]).toMatchObject({
      x: 30,
      width: 60,
    });
  });
  it("clamps hole movement and diameter and keeps thickness positive", () => {
    const part = {
      ...newPart("f", "body"),
      depth: 5,
      entities: [
        { id: "body", type: "rectangle", x: 0, y: 0, width: 80, height: 40 },
        { id: "hole", type: "hole", x: 40, y: 20, diameter: 10, outerId: "body" },
      ] as Entity[],
    };
    expect(updateHole(part, "hole", { x: 100, y: -10 }).entities[1]).toMatchObject({
      x: 75,
      y: 5,
      diameter: 10,
    });
    expect(updateHole(part, "hole", { diameter: 200 }).entities[1]).toMatchObject({
      x: 40,
      y: 20,
      diameter: 40,
    });
    expect(updateDepth(part, -1).depth).toBe(0.1);
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
  it("keeps old circles additive while subtracting explicit holes", () => {
    const additive = {
      ...newPart("f", "circle"),
      entities: [
        { id: "c", type: "circle", x: 25, y: 40, diameter: 10 },
      ] as Entity[],
      depth: 5,
    };
    expect(buildPart(additive).children).toHaveLength(1);

    const part = {
      ...newPart("f", "holed"),
      entities: [
        rectangle,
        {
          id: "h",
          type: "hole",
          x: 25,
          y: 40,
          diameter: 10,
          outerId: rectangle.id,
        },
      ] as Entity[],
      depth: 5,
    };
    const group = buildPart(part);
    expect(group.children).toHaveLength(1);
    const geometry = new STLLoader().parse(exportSTL(part));
    const positions = geometry.getAttribute("position");
    let volume = 0;
    for (let i = 0; i < positions.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(positions, i),
        b = new THREE.Vector3().fromBufferAttribute(positions, i + 1),
        c = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
      volume += a.dot(b.cross(c)) / 6;
    }
    expect(Math.abs(volume)).toBeCloseTo(6000 - Math.PI * 25 * 5, 0);
    geometry.dispose();
    disposePart(group);
  });
  it("respects hole diameter and position in the physical mesh", () => {
    const part = {
      ...newPart("f", "holed"),
      entities: [
        rectangle,
        {
          id: "h",
          type: "hole",
          x: 15,
          y: 30,
          diameter: 6,
          outerId: rectangle.id,
        },
      ] as Entity[],
      depth: 5,
    };
    const group = buildPart(part),
      mesh = group.children[0] as THREE.Mesh;
    const centerRay = new THREE.Raycaster(
      new THREE.Vector3(-10, 10, 10),
      new THREE.Vector3(0, 0, -1),
    );
    const solidRay = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 10),
      new THREE.Vector3(0, 0, -1),
    );
    expect(centerRay.intersectObject(mesh)).toHaveLength(0);
    expect(solidRay.intersectObject(mesh).length).toBeGreaterThan(0);
    const svg = exportSVG(part);
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain("12 30");
    expect(svg).toContain("18 30");
    disposePart(group);
  });
});
