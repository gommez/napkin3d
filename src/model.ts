export type Point = { x: number; y: number };
type Base = { id: string };
export type Entity =
  | (Base & { type: "line"; x1: number; y1: number; x2: number; y2: number })
  | (Base & {
      type: "rectangle";
      x: number;
      y: number;
      width: number;
      height: number;
    })
  | (Base & { type: "circle"; x: number; y: number; diameter: number });
export type Photo = {
  data: string;
  width: number;
  height: number;
  mmPerPixel: number;
  opacity: number;
};
export type Part = {
  id: string;
  name: string;
  folderId: string;
  sourceImage?: Photo;
  entities: Entity[];
  depth: number;
  orientation: [number, number, number];
  createdAt: string;
  updatedAt: string;
};
export type Project = {
  id: string;
  name: string;
  folders: { id: string; name: string }[];
  parts: Part[];
  createdAt: string;
  updatedAt: string;
};
export type Document = { version: 1; projects: Project[] };
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function newPart(folderId: string, name: string): Part {
  return {
    id: uid(),
    name,
    folderId,
    entities: [],
    depth: 5,
    orientation: [0, 0, 0],
    createdAt: now(),
    updatedAt: now(),
  };
}
export function move(e: Entity, dx: number, dy: number): Entity {
  return e.type === "line"
    ? { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy }
    : { ...e, x: e.x + dx, y: e.y + dy };
}
export function anchors(e: Entity): Point[] {
  if (e.type === "line")
    return [
      { x: e.x1, y: e.y1 },
      { x: e.x2, y: e.y2 },
    ];
  if (e.type === "circle") return [{ x: e.x, y: e.y }];
  return [
    { x: e.x, y: e.y },
    { x: e.x + e.width, y: e.y },
    { x: e.x, y: e.y + e.height },
    { x: e.x + e.width, y: e.y + e.height },
    { x: e.x + e.width / 2, y: e.y + e.height / 2 },
  ];
}
export function snap(
  p: Point,
  entities: Entity[],
  grid: boolean,
  features: boolean,
  tolerance: number,
): Point {
  const candidates = features ? entities.flatMap(anchors) : [];
  const closest = candidates
    .filter((a) => Math.hypot(a.x - p.x, a.y - p.y) < tolerance)
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
    )[0];
  return closest ?? (grid ? { x: Math.round(p.x), y: Math.round(p.y) } : p);
}
export function calibration(pixelDistance: number, mm: number) {
  if (
    pixelDistance <= 0 ||
    !Number.isFinite(pixelDistance) ||
    mm <= 0 ||
    !Number.isFinite(mm)
  )
    throw new Error("Use two distinct points and a positive distance.");
  return mm / pixelDistance;
}
export function bounds(entities: Entity[]) {
  const pts = entities.flatMap((e) =>
    e.type === "circle"
      ? [
          { x: e.x - e.diameter / 2, y: e.y - e.diameter / 2 },
          { x: e.x + e.diameter / 2, y: e.y + e.diameter / 2 },
        ]
      : anchors(e),
  );
  return pts.length
    ? {
        x: Math.min(...pts.map((p) => p.x)),
        y: Math.min(...pts.map((p) => p.y)),
        width:
          Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)),
        height:
          Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)),
      }
    : { x: 0, y: 0, width: 100, height: 100 };
}
