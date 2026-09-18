import { newPart, type Part } from "./model";

export type DetectionState =
  | "DETECTED"
  | "NEEDS_CONFIRMATION"
  | "USER_CONFIRMED";

type RectPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HolePixels = {
  id: string;
  x: number;
  y: number;
  diameter: number;
};

export type ScanResult = {
  outer: RectPixels & { state: DetectionState };
  holes: (HolePixels & { state: DetectionState })[];
  imageWidth: number;
  imageHeight: number;
};

export type ScanAnswers = {
  referenceWidthMm?: number;
  thicknessMm?: number;
  holeDiametersMm: Record<string, number | undefined>;
};

export type ScanResolution = {
  ready: boolean;
  scaleMmPerPixel?: number;
  outer: RectPixels & { state: DetectionState };
  holes: (HolePixels & {
    diameterMm?: number;
    state: DetectionState;
  })[];
  thicknessMm?: number;
};

type Component = {
  pixels: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function otsuThreshold(values: number[]) {
  const histogram = new Array(256).fill(0) as number[];
  for (const value of values) histogram[value]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < histogram.length; i++) sum += i * histogram[i];
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 128;
  for (let i = 0; i < histogram.length; i++) {
    backgroundWeight += histogram[i];
    if (!backgroundWeight) continue;
    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;
    backgroundSum += i * histogram[i];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance =
      backgroundWeight *
      foregroundWeight *
      (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = i;
    }
  }
  return threshold;
}

function components(data: Uint8ClampedArray, width: number, height: number) {
  const gray = new Array<number>(width * height);
  for (let i = 0; i < gray.length; i++) {
    const offset = i * 4;
    gray[i] = Math.round(
      0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2],
    );
  }
  let min = 255;
  let max = 0;
  for (const value of gray) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const normalized = gray.map((value) =>
    max === min ? value : Math.round(((value - min) * 255) / (max - min)),
  );
  const threshold = otsuThreshold(normalized);
  const dark = normalized.map((value) => value <= threshold);
  const visited = new Uint8Array(dark.length);
  const result: Component[] = [];
  for (let start = 0; start < dark.length; start++) {
    if (!dark[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (queue.length) {
      const index = queue.pop()!;
      const x = index % width;
      const y = Math.floor(index / width);
      pixels++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (dark[next] && !visited[next]) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
    }
    if (pixels >= 4)
      result.push({ pixels, minX, minY, maxX, maxY });
  }
  return result;
}

export function scanRaster(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ScanResult {
  if (width < 8 || height < 8 || data.length < width * height * 4)
    throw new Error("La imagen es demasiado pequeña para interpretar una pieza.");
  const detected = components(data, width, height).sort(
    (a, b) =>
      (b.maxX - b.minX) * (b.maxY - b.minY) -
      (a.maxX - a.minX) * (a.maxY - a.minY),
  );
  const outer = detected.find(
    (component) =>
      component.maxX - component.minX >= width * 0.2 &&
      component.maxY - component.minY >= height * 0.2,
  );
  if (!outer) throw new Error("No entiendo completamente este contorno.");
  const outerWidth = outer.maxX - outer.minX;
  const outerHeight = outer.maxY - outer.minY;
  const holes = detected
    .filter((component) => component !== outer)
    .map((component, index) => {
      const componentWidth = component.maxX - component.minX;
      const componentHeight = component.maxY - component.minY;
      const centerX = (component.minX + component.maxX) / 2;
      const centerY = (component.minY + component.maxY) / 2;
      const circular =
        Math.abs(componentWidth - componentHeight) <=
          Math.max(componentWidth, componentHeight) * 0.25 &&
        componentWidth < outerWidth * 0.5 &&
        componentHeight < outerHeight * 0.5;
      const inside =
        centerX > outer.minX &&
        centerX < outer.maxX &&
        centerY > outer.minY &&
        centerY < outer.maxY;
      return circular && inside
        ? {
            id: `detected-hole-${index + 1}`,
            x: centerX,
            y: centerY,
            diameter: (componentWidth + componentHeight) / 2,
            state: "DETECTED" as const,
          }
        : undefined;
    })
    .filter((hole): hole is NonNullable<typeof hole> => Boolean(hole));
  return {
    outer: {
      x: outer.minX,
      y: outer.minY,
      width: outerWidth,
      height: outerHeight,
      state: "DETECTED",
    },
    holes,
    imageWidth: width,
    imageHeight: height,
  };
}

export function resolveScan(
  scan: ScanResult,
  answers: ScanAnswers,
): ScanResolution {
  const scale =
    answers.referenceWidthMm && answers.referenceWidthMm > 0
      ? answers.referenceWidthMm / scan.outer.width
      : undefined;
  const holes = scan.holes.map((hole) => {
    const diameterMm = answers.holeDiametersMm[hole.id];
    return {
      ...hole,
      diameterMm:
        diameterMm && diameterMm > 0
          ? diameterMm
          : undefined,
      state:
        diameterMm && diameterMm > 0
          ? ("USER_CONFIRMED" as const)
          : ("NEEDS_CONFIRMATION" as const),
    };
  });
  const thicknessMm =
    answers.thicknessMm && answers.thicknessMm > 0
      ? answers.thicknessMm
      : undefined;
  return {
    ready: Boolean(scale && thicknessMm && holes.every((hole) => hole.diameterMm)),
    scaleMmPerPixel: scale,
    outer: {
      ...scan.outer,
      state: scale ? "USER_CONFIRMED" : "NEEDS_CONFIRMATION",
    },
    holes,
    thicknessMm,
  };
}

export function partFromScan(
  scan: ScanResult,
  answers: ScanAnswers,
  name = "Automatic part",
): Part {
  const resolution = resolveScan(scan, answers);
  if (!resolution.ready || !resolution.scaleMmPerPixel || !resolution.thicknessMm)
    throw new Error("La pieza aún necesita información para estar lista.");
  const part = newPart("automatic", name);
  const outerId = crypto.randomUUID();
  const scale = resolution.scaleMmPerPixel;
  part.depth = resolution.thicknessMm;
  part.entities = [
    {
      id: outerId,
      type: "rectangle",
      x: 0,
      y: 0,
      width: scan.outer.width * scale,
      height: scan.outer.height * scale,
    },
    ...resolution.holes.map((hole) => ({
      id: crypto.randomUUID(),
      type: "hole" as const,
      x: (hole.x - scan.outer.x) * scale,
      y: (hole.y - scan.outer.y) * scale,
      diameter: hole.diameterMm!,
      outerId,
    })),
  ];
  return part;
}
