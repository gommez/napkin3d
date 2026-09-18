import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { bounds, type Entity, type Part } from "./model";

function holeFitsRectangle(hole: Extract<Entity, { type: "hole" }>, outer: Extract<Entity, { type: "rectangle" }>) {
  const radius = hole.diameter / 2;
  return (
    hole.x - radius >= outer.x &&
    hole.x + radius <= outer.x + outer.width &&
    hole.y - radius >= outer.y &&
    hole.y + radius <= outer.y + outer.height
  );
}

function rectangleShape(
  outer: Extract<Entity, { type: "rectangle" }>,
  holes: Extract<Entity, { type: "hole" }>[],
) {
  const shape = new THREE.Shape();
  shape.moveTo(outer.x, -outer.y);
  shape.lineTo(outer.x + outer.width, -outer.y);
  shape.lineTo(outer.x + outer.width, -outer.y - outer.height);
  shape.lineTo(outer.x, -outer.y - outer.height);
  shape.closePath();
  for (const hole of holes) {
    const path = new THREE.Path();
    path.absarc(hole.x, -hole.y, hole.diameter / 2, 0, Math.PI * 2, false);
    shape.holes.push(path);
  }
  return shape;
}

export function buildPart(part: Part): THREE.Group {
  const group = new THREE.Group();
  const holes = part.entities.filter(
    (e): e is Extract<Entity, { type: "hole" }> => e.type === "hole",
  );
  for (const e of part.entities) {
    if (e.type === "line" || e.type === "hole") continue;
    const s =
      e.type === "rectangle"
        ? rectangleShape(
            e,
            holes.filter((hole) => hole.outerId === e.id && holeFitsRectangle(hole, e)),
          )
        : new THREE.Shape();
    if (e.type === "circle") {
      s.absarc(e.x, -e.y, e.diameter / 2, 0, Math.PI * 2, false);
    }
    const geometry = new THREE.ExtrudeGeometry(s, {
      depth: part.depth,
      bevelEnabled: false,
      curveSegments: 64,
    });
    group.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0x33b89d,
          roughness: 0.5,
          metalness: 0.1,
        }),
      ),
    );
  }
  const b = new THREE.Box3().setFromObject(group);
  if (!b.isEmpty()) {
    const center = b.getCenter(new THREE.Vector3());
    for (const child of group.children) child.position.sub(center);
  }
  group.rotation.set(
    ...(part.orientation.map((v) => (v * Math.PI) / 180) as [
      number,
      number,
      number,
    ]),
  );
  group.updateMatrixWorld(true);
  return group;
}
export function disposePart(group: THREE.Group) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
export function exportSVG(part: Part): string {
  const b = bounds(part.entities);
  const holes = part.entities.filter(
    (e): e is Extract<Entity, { type: "hole" }> => e.type === "hole",
  );
  const content = part.entities
    .filter((e) => e.type !== "hole")
    .map((e) => {
      if (e.type === "rectangle") {
        const outerHoles = holes.filter(
          (hole) => hole.outerId === e.id && holeFitsRectangle(hole, e),
        );
        if (!outerHoles.length)
          return `<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}"/>`;
        const holePaths = outerHoles
          .map((hole) => {
            const r = hole.diameter / 2;
            return `M ${hole.x - r} ${hole.y} A ${r} ${r} 0 1 0 ${hole.x + r} ${hole.y} A ${r} ${r} 0 1 0 ${hole.x - r} ${hole.y} Z`;
          })
          .join(" ");
        return `<path fill-rule="evenodd" d="M ${e.x} ${e.y} H ${e.x + e.width} V ${e.y + e.height} H ${e.x} Z ${holePaths}"/>`;
      }
      if (e.type === "circle")
        return `<circle cx="${e.x}" cy="${e.y}" r="${e.diameter / 2}"/>`;
      return `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="black" stroke-width="0.1"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(b.width, 0.001)}mm" height="${Math.max(b.height, 0.001)}mm" viewBox="${b.x} ${b.y} ${Math.max(b.width, 0.001)} ${Math.max(b.height, 0.001)}">${content}</svg>`;
}
export function exportSTL(part: Part): string {
  const group = buildPart(part);
  const result = new STLExporter().parse(group);
  disposePart(group);
  return result;
}
export function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
// Future formats implement a serializer from Part; exported files are never the source of truth.
