import { newPart, type Part } from "./model";
import type { AssociationResult, DimensionTrace } from "./association";
import {
  preprocessGeometry,
  summarizeInkMap,
  type InkMap,
  type InkMapSummary,
} from "./geometryPreprocessing";

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
  outerHeightMm?: number;
  thicknessMm?: number;
  holeDiametersMm: Record<string, number | undefined>;
};

export type ScanResolution = {
  ready: boolean;
  scaleMmPerPixel?: number;
  scaleXMmPerPixel?: number;
  scaleYMmPerPixel?: number;
  outer: RectPixels & { state: DetectionState };
  dimensions: {
    outerWidth?: DimensionTrace;
    outerHeight?: DimensionTrace;
  };
  holes: (HolePixels & {
    diameterMm?: number;
    state: DetectionState;
  })[];
  thicknessMm?: number;
};

export type Component = {
  pixels: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type RasterDiagnostics = {
  preprocessing: {
    grayMin: number;
    grayMax: number;
    threshold: number;
    connectivity: 8;
    minimumPixels: 4;
  };
  preprocessingAB: {
    baseline: InkMapSummary;
    v1: InkMapSummary;
    comparison: {
      foregroundRatioDelta: number;
      componentCountDelta: number;
      tinyComponentCountDelta: number;
      largestComponentDelta: number;
      totalMs: number;
    };
  };
  inkMaps: { baseline: InkMap; v1: InkMap };
  components: (Component & { id: string; retained: boolean })[];
  componentsV1: (Component & { id: string; retained: boolean })[];
  proposals: { baseline: GeometryProposal; v1: GeometryProposal };
  ocr: { status: "NOT_IMPLEMENTED"; textRegions: []; recognizedText: [] };
  association: { status: "NOT_IMPLEMENTED"; matches: [] };
};

function componentsFromMap(map: InkMap) {
  const { width, height } = map;
  const dark = map.binary;
  const visited = new Uint8Array(dark.length);
  const result: Component[] = [];
  const all: (Component & { id: string; retained: boolean })[] = [];
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
    all.push({ pixels, minX, minY, maxX, maxY, id: `component-${all.length + 1}`, retained: pixels >= 4 });
    if (pixels >= 4)
      result.push({ pixels, minX, minY, maxX, maxY });
  }
  return { result, all };
}

function range(values: Uint8Array) {
  let min = 255;
  let max = 0;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

function largestComponent(components: Component[]) {
  let largest = 0;
  for (const component of components) largest = Math.max(largest, component.pixels);
  return largest;
}

export type GeometryProposal = {
  outer?: RectPixels & { state: "DETECTED" };
  holes: (HolePixels & { state: "DETECTED" })[];
};

function proposeGeometry(detected: Component[], width: number, height: number): GeometryProposal {
  const sorted = [...detected].sort(
    (a, b) =>
      (b.maxX - b.minX) * (b.maxY - b.minY) -
      (a.maxX - a.minX) * (a.maxY - a.minY),
  );
  const outer = sorted.find(
    (component) =>
      component.maxX - component.minX >= width * 0.2 &&
      component.maxY - component.minY >= height * 0.2,
  );
  if (!outer) return { holes: [] };
  const outerWidth = outer.maxX - outer.minX;
  const outerHeight = outer.maxY - outer.minY;
  const holes = sorted
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
  };
}

export function scanRaster(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  report?: (trace: RasterDiagnostics) => void,
): ScanResult {
  const started = performance.now();
  if (width < 8 || height < 8 || data.length < width * height * 4)
    throw new Error("La imagen es demasiado pequeña para interpretar una pieza.");
  const maps = preprocessGeometry(data, width, height);
  const baselineComponents = componentsFromMap(maps.baseline);
  const v1Components = componentsFromMap(maps.v1);
  const baselineProposal = proposeGeometry(baselineComponents.result, width, height);
  const v1Proposal = proposeGeometry(v1Components.result, width, height);
  const baselineRange = range(maps.baseline.grayscale);
  const baselineSummary = summarizeInkMap(maps.baseline, baselineComponents.all.map((item) => item.pixels));
  const v1Summary = summarizeInkMap(maps.v1, v1Components.all.map((item) => item.pixels));
  report?.({
    preprocessing: {
      grayMin: baselineRange.min,
      grayMax: baselineRange.max,
      threshold: maps.baseline.parameters.threshold,
      connectivity: 8,
      minimumPixels: 4,
    },
    preprocessingAB: {
      baseline: baselineSummary,
      v1: v1Summary,
      comparison: {
        foregroundRatioDelta: v1Summary.foregroundRatio - baselineSummary.foregroundRatio,
        componentCountDelta: v1Components.all.length - baselineComponents.all.length,
        tinyComponentCountDelta:
          v1Components.all.filter((item) => item.pixels < 4).length -
          baselineComponents.all.filter((item) => item.pixels < 4).length,
        largestComponentDelta:
          largestComponent(v1Components.all) - largestComponent(baselineComponents.all),
        totalMs: performance.now() - started,
      },
    },
    inkMaps: maps,
    components: baselineComponents.all,
    componentsV1: v1Components.all,
    proposals: { baseline: baselineProposal, v1: v1Proposal },
    ocr: { status: "NOT_IMPLEMENTED", textRegions: [], recognizedText: [] },
    association: { status: "NOT_IMPLEMENTED", matches: [] },
  });
  const outer = baselineProposal.outer;
  if (!outer) throw new Error("No entiendo completamente este contorno.");
  return {
    outer,
    holes: baselineProposal.holes,
    imageWidth: width,
    imageHeight: height,
  };
}

export function resolveScan(
  scan: ScanResult,
  answers: ScanAnswers,
  association?: AssociationResult,
): ScanResolution {
  const userWidth =
    answers.referenceWidthMm && answers.referenceWidthMm > 0
      ? answers.referenceWidthMm
      : undefined;
  const userHeight =
    answers.outerHeightMm && answers.outerHeightMm > 0
      ? answers.outerHeightMm
      : undefined;
  const explicitWidth = association?.dimensions["outer-width"];
  const explicitHeight = association?.dimensions["outer-height"];
  const widthTrace =
    userWidth !== undefined
      ? manualTrace(userWidth, "outer-width")
      : explicitWidth;
  const widthScale = widthTrace?.valueMm
    ? widthTrace.valueMm / scan.outer.width
    : undefined;
  const heightTrace =
    userHeight !== undefined
      ? manualTrace(userHeight, "outer-height")
      : explicitHeight ??
        (widthScale
          ? {
              valueMm: scan.outer.height * widthScale,
              origin: "DERIVED" as const,
              state: "NEEDS_CONFIRMATION" as const,
              featureId: "outer-height",
              evidences: [
                {
                  type: "geometry" as const,
                  status: "neutral" as const,
                  detail: "derived from width scale because no explicit height was resolved",
                },
              ],
            }
          : undefined);
  const heightScale = heightTrace?.valueMm
    ? heightTrace.valueMm / scan.outer.height
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
    ready: Boolean(widthTrace?.valueMm && heightTrace?.valueMm && thicknessMm && holes.every((hole) => hole.diameterMm)),
    scaleMmPerPixel: widthScale,
    scaleXMmPerPixel: widthScale,
    scaleYMmPerPixel: heightScale,
    outer: {
      ...scan.outer,
      state: widthTrace?.valueMm && heightTrace?.valueMm ? "USER_CONFIRMED" : "NEEDS_CONFIRMATION",
    },
    dimensions: {
      outerWidth: widthTrace,
      outerHeight: heightTrace,
    },
    holes,
    thicknessMm,
  };
}

function manualTrace(valueMm: number, featureId: "outer-width" | "outer-height"): DimensionTrace {
  return {
    valueMm,
    origin: "USER_CONFIRMED",
    state: "AUTO_ASSIGNED",
    featureId,
    evidences: [
      {
        type: "semantic",
        status: "compatible",
        detail: "entered manually by the user",
      },
    ],
  };
}

export function partFromScan(
  scan: ScanResult,
  answers: ScanAnswers,
  associationOrName?: AssociationResult | string,
  name = "Automatic part",
): Part {
  const association =
    typeof associationOrName === "string" ? undefined : associationOrName;
  const partName =
    typeof associationOrName === "string" ? associationOrName : name;
  const resolution = resolveScan(scan, answers, association);
  if (!resolution.ready || !resolution.scaleXMmPerPixel || !resolution.scaleYMmPerPixel || !resolution.thicknessMm || !resolution.dimensions.outerWidth || !resolution.dimensions.outerHeight)
    throw new Error("La pieza aún necesita información para estar lista.");
  const part = newPart("automatic", partName);
  const outerId = crypto.randomUUID();
  const scaleX = resolution.scaleXMmPerPixel;
  const scaleY = resolution.scaleYMmPerPixel;
  part.depth = resolution.thicknessMm;
  part.entities = [
    {
      id: outerId,
      type: "rectangle",
      x: 0,
      y: 0,
      width: resolution.dimensions.outerWidth.valueMm,
      height: resolution.dimensions.outerHeight.valueMm,
    },
    ...resolution.holes.map((hole) => ({
      id: crypto.randomUUID(),
      type: "hole" as const,
      x: (hole.x - scan.outer.x) * scaleX,
      y: (hole.y - scan.outer.y) * scaleY,
      diameter: hole.diameterMm!,
      outerId,
    })),
  ];
  return part;
}
