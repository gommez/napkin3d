import type { TextDetection } from "./ocr";
import { classifyDimension, type Compatibility } from "./ocrRegions";
import type { ScanResult } from "./scanner";

export type Box = { x: number; y: number; width: number; height: number };
export type GeometryFeature = {
  id: string;
  kind: "linear-dimension" | "diameter" | "radius" | "generic";
  subjectId: string;
  subjectKind: "outer-contour" | "circle" | "segment" | "polygon" | "contour";
  property: string;
  axis?: "horizontal" | "vertical" | "radial";
  bbox: Box;
  measuredPixels?: number;
};
export type Annotation = {
  id: string;
  rawText: string;
  bbox: Box;
  polygon: { x: number; y: number }[];
  score: number;
  classification: Compatibility;
};
export type AssociationStatus =
  | "AUTO_ASSIGNED"
  | "NEEDS_CONFIRMATION"
  | "UNRESOLVED";
export type DimensionOrigin = "EXPLICIT" | "DERIVED" | "USER_CONFIRMED";
export type Evidence =
  | {
      type: "semantic";
      status: "compatible" | "future-compatible" | "ambiguous" | "incompatible";
      detail: string;
    }
  | {
      type: "spatial";
      status: "supporting" | "neutral" | "conflicting";
      relation: string;
      normalizedDistance: number;
    }
  | {
      type: "geometry";
      status: "supporting" | "neutral" | "conflicting";
      detail: string;
    }
  | { type: "ocr"; status: "accepted" | "low-score"; detail: string };
export type AssociationCandidate = {
  id: string;
  annotationId: string;
  featureId: string;
  valueMm?: number;
  rawText: string;
  evidences: Evidence[];
  status: AssociationStatus;
};
export type DimensionTrace = {
  valueMm: number;
  origin: DimensionOrigin;
  state: AssociationStatus;
  featureId: string;
  annotationId?: string;
  rawText?: string;
  evidences: Evidence[];
};
export type AssociationHypothesis = {
  featureId: string;
  status: AssociationStatus;
  candidates: AssociationCandidate[];
  selectedCandidateId?: string;
  reason: string;
};
export type AssociationResult = {
  status: "READY";
  coordinateSpace: "original-image-pixels";
  features: GeometryFeature[];
  annotations: Annotation[];
  candidates: AssociationCandidate[];
  hypotheses: AssociationHypothesis[];
  dimensions: Record<string, DimensionTrace | undefined>;
};

type ScaleContext = {
  originalWidth: number;
  originalHeight: number;
  rasterWidth: number;
  rasterHeight: number;
};

export function normalizeBox(
  box: Box,
  context: ScaleContext,
): Box {
  const sx = context.originalWidth / context.rasterWidth;
  const sy = context.originalHeight / context.rasterHeight;
  return {
    x: box.x * sx,
    y: box.y * sy,
    width: box.width * sx,
    height: box.height * sy,
  };
}

export function featuresFromScan(
  scan: ScanResult,
  context: ScaleContext = {
    originalWidth: scan.imageWidth,
    originalHeight: scan.imageHeight,
    rasterWidth: scan.imageWidth,
    rasterHeight: scan.imageHeight,
  },
): GeometryFeature[] {
  const outer = normalizeBox(scan.outer, context);
  return [
    {
      id: "outer-width",
      kind: "linear-dimension",
      subjectId: "outer-contour",
      subjectKind: "outer-contour",
      property: "width",
      axis: "horizontal",
      bbox: outer,
      measuredPixels: outer.width,
    },
    {
      id: "outer-height",
      kind: "linear-dimension",
      subjectId: "outer-contour",
      subjectKind: "outer-contour",
      property: "height",
      axis: "vertical",
      bbox: outer,
      measuredPixels: outer.height,
    },
    ...scan.holes.map((hole) => ({
      id: `${hole.id}-diameter`,
      kind: "diameter" as const,
      subjectId: hole.id,
      subjectKind: "circle" as const,
      property: "diameter",
      axis: "radial" as const,
      bbox: normalizeBox(
        {
          x: hole.x - hole.diameter / 2,
          y: hole.y - hole.diameter / 2,
          width: hole.diameter,
          height: hole.diameter,
        },
        context,
      ),
      measuredPixels: hole.diameter,
    })),
  ];
}

export function annotationsFromOcr(detections: TextDetection[]): Annotation[] {
  return detections.map((detection) => ({
    id: detection.id,
    rawText: detection.text,
    bbox: detection.bbox,
    polygon: detection.polygon,
    score: detection.score,
    classification: classifyDimension(detection.text),
  }));
}

function parseDimension(text: string) {
  const trimmed = text.trim();
  const number = `([0-9]+(?:[.,][0-9]+)?)`;
  const linear = new RegExp(`^${number}(?:\\s*mm)?$`, "i").exec(trimmed);
  if (linear) return { kind: "linear", valueMm: Number(linear[1].replace(",", ".")) };
  const diameter = new RegExp(`^Ø\\s*${number}(?:\\s*mm)?$`, "i").exec(trimmed);
  if (diameter) return { kind: "diameter", valueMm: Number(diameter[1].replace(",", ".")) };
  const radius = new RegExp(`^R\\s*${number}(?:\\s*mm)?$`, "i").exec(trimmed);
  if (radius) return { kind: "radius", valueMm: Number(radius[1].replace(",", ".")) };
  return undefined;
}

function center(box: Box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function spatialEvidence(annotation: Annotation, feature: GeometryFeature): Evidence {
  const c = center(annotation.bbox);
  const b = feature.bbox;
  if (feature.axis === "horizontal") {
    const normalizer = Math.max(1, b.height, b.width * 0.15);
    const side =
      c.y < b.y ? "above" : c.y > b.y + b.height ? "below" : "inside";
    const distance =
      side === "above"
        ? (b.y - c.y) / normalizer
        : side === "below"
          ? (c.y - (b.y + b.height)) / normalizer
          : 0;
    const aligned = c.x >= b.x - b.width * 0.25 && c.x <= b.x + b.width * 1.25;
    const close = distance <= 0.85;
    return {
      type: "spatial",
      status: side !== "inside" && aligned && close ? "supporting" : "neutral",
      relation: side === "above" ? "above outer contour" : side === "below" ? "below outer contour" : "inside outer contour",
      normalizedDistance: distance,
    };
  }
  if (feature.axis === "vertical") {
    const normalizer = Math.max(1, b.width, b.height * 0.15);
    const side =
      c.x < b.x ? "left" : c.x > b.x + b.width ? "right" : "inside";
    const distance =
      side === "left"
        ? (b.x - c.x) / normalizer
        : side === "right"
          ? (c.x - (b.x + b.width)) / normalizer
          : 0;
    const aligned = c.y >= b.y - b.height * 0.25 && c.y <= b.y + b.height * 1.25;
    const close = distance <= 0.85;
    return {
      type: "spatial",
      status: side !== "inside" && aligned && close ? "supporting" : "neutral",
      relation: side === "left" ? "left of outer contour" : side === "right" ? "right of outer contour" : "inside outer contour",
      normalizedDistance: distance,
    };
  }
  return {
    type: "spatial",
    status: "neutral",
    relation: "no spatial rule for this feature yet",
    normalizedDistance: 0,
  };
}

function semanticEvidence(annotation: Annotation, feature: GeometryFeature): Evidence {
  const parsed = parseDimension(annotation.rawText);
  if (!parsed) {
    return {
      type: "semantic",
      status: annotation.classification === "ambiguous" ? "ambiguous" : "incompatible",
      detail: "not a supported explicit dimension",
    };
  }
  if (parsed.kind === "linear" && feature.kind === "linear-dimension")
    return { type: "semantic", status: "compatible", detail: "linear dimension" };
  if (parsed.kind === "diameter")
    return { type: "semantic", status: "future-compatible", detail: "diameter annotation; feature support deferred" };
  if (parsed.kind === "radius")
    return { type: "semantic", status: "future-compatible", detail: "radius annotation; feature support deferred" };
  return { type: "semantic", status: "incompatible", detail: "dimension kind does not match feature" };
}

function ocrEvidence(annotation: Annotation): Evidence {
  return {
    type: "ocr",
    status: annotation.score >= 0.2 ? "accepted" : "low-score",
    detail: `raw score ${annotation.score}`,
  };
}

function geometryEvidence(
  feature: GeometryFeature,
  selected: Map<string, AssociationCandidate>,
  features: GeometryFeature[],
): Evidence {
  if (feature.id !== "outer-width" && feature.id !== "outer-height")
    return { type: "geometry", status: "neutral", detail: "no geometry coherence rule for this feature yet" };
  const width = selected.get("outer-width");
  const height = selected.get("outer-height");
  const widthFeature = features.find((f) => f.id === "outer-width");
  const heightFeature = features.find((f) => f.id === "outer-height");
  if (!width?.valueMm || !height?.valueMm || !widthFeature?.measuredPixels || !heightFeature?.measuredPixels)
    return { type: "geometry", status: "neutral", detail: "needs both explicit outer dimensions" };
  const sketchRatio = widthFeature.measuredPixels / heightFeature.measuredPixels;
  const dimensionRatio = width.valueMm / height.valueMm;
  const ratioError = Math.abs(Math.log(dimensionRatio / sketchRatio));
  const status =
    ratioError <= Math.log(1.8)
      ? "supporting"
      : ratioError >= Math.log(4)
        ? "conflicting"
        : "neutral";
  return {
    type: "geometry",
    status,
    detail: `sketch ratio ${sketchRatio.toFixed(3)}, dimension ratio ${dimensionRatio.toFixed(3)}`,
  };
}

export function generateCandidates(
  features: GeometryFeature[],
  annotations: Annotation[],
): AssociationCandidate[] {
  const candidates: AssociationCandidate[] = [];
  for (const annotation of annotations) {
    const parsed = parseDimension(annotation.rawText);
    for (const feature of features) {
      const evidences = [
        semanticEvidence(annotation, feature),
        spatialEvidence(annotation, feature),
        ocrEvidence(annotation),
      ];
      const semantic = evidences.find((e) => e.type === "semantic")!;
      const spatial = evidences.find((e) => e.type === "spatial")!;
      const valueMm =
        parsed?.kind === "linear" && feature.kind === "linear-dimension"
          ? parsed.valueMm
          : undefined;
      const status =
        semantic.status === "compatible" && spatial.status === "supporting" && valueMm
          ? "NEEDS_CONFIRMATION"
          : "UNRESOLVED";
      candidates.push({
        id: `${annotation.id}->${feature.id}`,
        annotationId: annotation.id,
        featureId: feature.id,
        valueMm,
        rawText: annotation.rawText,
        evidences,
        status,
      });
    }
  }
  return candidates;
}

export function associateAnnotations(
  features: GeometryFeature[],
  annotations: Annotation[],
): AssociationResult {
  const candidates = generateCandidates(features, annotations);
  const selected = new Map<string, AssociationCandidate>();
  const hypotheses = features.map((feature) => {
    const plausible = candidates.filter(
      (candidate) =>
        candidate.featureId === feature.id &&
        candidate.status === "NEEDS_CONFIRMATION",
    );
    if (plausible.length === 1) {
      selected.set(feature.id, plausible[0]);
      return {
        featureId: feature.id,
        status: "AUTO_ASSIGNED" as const,
        candidates: plausible,
        selectedCandidateId: plausible[0].id,
        reason: "one semantic and spatially supported candidate",
      };
    }
    if (plausible.length > 1)
      return {
        featureId: feature.id,
        status: "NEEDS_CONFIRMATION" as const,
        candidates: plausible,
        reason: "multiple annotations compete for the same feature",
      };
    return {
      featureId: feature.id,
      status: "UNRESOLVED" as const,
      candidates: candidates.filter((candidate) => candidate.featureId === feature.id),
      reason: "no semantic and spatially supported candidate",
    };
  });
  for (const hypothesis of hypotheses) {
    const candidate = selected.get(hypothesis.featureId);
    if (!candidate) continue;
    const geometry = geometryEvidence(
      features.find((feature) => feature.id === hypothesis.featureId)!,
      selected,
      features,
    );
    candidate.evidences.push(geometry);
    if (geometry.status === "conflicting") {
      candidate.status = "NEEDS_CONFIRMATION";
      hypothesis.status = "NEEDS_CONFIRMATION";
      hypothesis.reason = "geometry ratio strongly conflicts with paired dimensions";
    } else {
      candidate.status = "AUTO_ASSIGNED";
    }
  }
  const dimensions: AssociationResult["dimensions"] = {};
  for (const hypothesis of hypotheses) {
    const candidate = candidates.find((item) => item.id === hypothesis.selectedCandidateId);
    if (!candidate?.valueMm || hypothesis.status !== "AUTO_ASSIGNED") continue;
    dimensions[hypothesis.featureId] = {
      valueMm: candidate.valueMm,
      origin: "EXPLICIT",
      state: hypothesis.status,
      featureId: hypothesis.featureId,
      annotationId: candidate.annotationId,
      rawText: candidate.rawText,
      evidences: candidate.evidences,
    };
  }
  return {
    status: "READY",
    coordinateSpace: "original-image-pixels",
    features,
    annotations,
    candidates,
    hypotheses,
    dimensions,
  };
}

export function associationFromScanAndOcr(
  scan: ScanResult,
  detections: TextDetection[],
  context?: ScaleContext,
) {
  return associateAnnotations(
    featuresFromScan(scan, context),
    annotationsFromOcr(detections),
  );
}
