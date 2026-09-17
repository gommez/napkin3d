import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { bounds, type Part } from "./model";
export function buildPart(part: Part): THREE.Group {
  const group = new THREE.Group();
  for (const e of part.entities) {
    if (e.type === "line") continue;
    const s = new THREE.Shape();
    if (e.type === "rectangle") {
      s.moveTo(e.x, -e.y);
      s.lineTo(e.x + e.width, -e.y);
      s.lineTo(e.x + e.width, -e.y - e.height);
      s.lineTo(e.x, -e.y - e.height);
      s.closePath();
    } else {
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(b.width, 0.001)}mm" height="${Math.max(b.height, 0.001)}mm" viewBox="${b.x} ${b.y} ${Math.max(b.width, 0.001)} ${Math.max(b.height, 0.001)}">${part.entities.map((e) => (e.type === "rectangle" ? `<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}"/>` : e.type === "circle" ? `<circle cx="${e.x}" cy="${e.y}" r="${e.diameter / 2}"/>` : `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="black" stroke-width="0.1"/>`)).join("")}</svg>`;
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
