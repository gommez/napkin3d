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
  | (Base & { type: "circle"; x: number; y: number; diameter: number })
  | (Base & {
      type: "hole";
      x: number;
      y: number;
      diameter: number;
      outerId: string;
    });
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
export type Document = { version: 2; projects: Project[] };
export type LegacyDocument = { version: 1; projects: Project[] };
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
export type RectangleSide = "left" | "right" | "top" | "bottom";
export type DimensionAxis = "width" | "height";
export const MIN_DIMENSION = 0.1;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampHoleToRectangle(
  hole: Extract<Entity, { type: "hole" }>,
  rectangle: Extract<Entity, { type: "rectangle" }>,
): Extract<Entity, { type: "hole" }> {
  const radius = Math.min(hole.diameter / 2, rectangle.width / 2, rectangle.height / 2);
  return {
    ...hole,
    diameter: Math.max(MIN_DIMENSION, radius * 2),
    x: clamp(hole.x, rectangle.x + radius, rectangle.x + rectangle.width - radius),
    y: clamp(hole.y, rectangle.y + radius, rectangle.y + rectangle.height - radius),
  };
}

export function resizeRectangle(
  rectangle: Extract<Entity, { type: "rectangle" }>,
  side: RectangleSide,
  coordinate: number,
) {
  if (side === "right")
    return { ...rectangle, width: Math.max(MIN_DIMENSION, coordinate - rectangle.x) };
  if (side === "left") {
    const right = rectangle.x + rectangle.width;
    const x = Math.min(coordinate, right - MIN_DIMENSION);
    return { ...rectangle, x, width: right - x };
  }
  if (side === "bottom")
    return { ...rectangle, height: Math.max(MIN_DIMENSION, coordinate - rectangle.y) };
  const bottom = rectangle.y + rectangle.height;
  const y = Math.min(coordinate, bottom - MIN_DIMENSION);
  return { ...rectangle, y, height: bottom - y };
}

export function updateRectangle(
  part: Part,
  rectangleId: string,
  side: RectangleSide,
  coordinate: number,
) {
  const rectangle = part.entities.find(
    (entity): entity is Extract<Entity, { type: "rectangle" }> =>
      entity.id === rectangleId && entity.type === "rectangle",
  );
  if (!rectangle) return part;
  const nextRectangle = resizeRectangle(rectangle, side, coordinate);
  return {
    ...part,
    entities: part.entities.map((entity) => {
      if (entity.id === rectangleId) return nextRectangle;
      if (entity.type !== "hole" || entity.outerId !== rectangleId) return entity;
      return clampHoleToRectangle(entity, nextRectangle);
    }),
  };
}

export function updateHole(
  part: Part,
  holeId: string,
  change: Partial<Pick<Extract<Entity, { type: "hole" }>, "x" | "y" | "diameter">>,
) {
  const hole = part.entities.find(
    (entity): entity is Extract<Entity, { type: "hole" }> =>
      entity.id === holeId && entity.type === "hole",
  );
  if (!hole) return part;
  const rectangle = part.entities.find(
    (entity): entity is Extract<Entity, { type: "rectangle" }> =>
      entity.id === hole.outerId && entity.type === "rectangle",
  );
  if (!rectangle) return part;
  const nextHole = clampHoleToRectangle(
    { ...hole, ...change, diameter: Math.max(MIN_DIMENSION, change.diameter ?? hole.diameter) },
    rectangle,
  );
  return {
    ...part,
    entities: part.entities.map((entity) =>
      entity.id === holeId ? nextHole : entity,
    ),
  };
}

export function updateDepth(part: Part, depth: number) {
  return { ...part, depth: Math.max(MIN_DIMENSION, depth) };
}
export function anchors(e: Entity): Point[] {
  if (e.type === "line")
    return [
      { x: e.x1, y: e.y1 },
      { x: e.x2, y: e.y2 },
    ];
  if (e.type === "circle" || e.type === "hole") return [{ x: e.x, y: e.y }];
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
    e.type === "circle" || e.type === "hole"
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
