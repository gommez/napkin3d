import { useMemo } from "react";
import RegionDiagnostics from "./RegionDiagnostics";
import type { Part } from "./model";
import { resolveScan, type RasterDiagnostics, type ScanAnswers, type ScanResult } from "./scanner";
import type { OcrDiagnostics } from "./ocr";
import type { AssociationResult } from "./association";
import { mapChannel } from "./geometryPreprocessing";

export type ScanCapture = {
  original: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  raster?: RasterDiagnostics;
  ocr?: OcrDiagnostics;
};

export function diagnosticValues(scan: ScanResult | undefined, answers: ScanAnswers, association?: AssociationResult) {
  if (!scan) return { unresolved: ["geometry", "referenceWidthMm", "thicknessMm"], resolution: null };
  const resolution = resolveScan(scan, answers, association);
  return {
    resolution,
    unresolved: [
      ...(!resolution.dimensions.outerWidth ? ["outer.widthMm"] : []),
      ...(!resolution.dimensions.outerHeight ? ["outer.heightMm"] : []),
      ...resolution.holes.filter(h => !h.diameterMm).map(h => `${h.id}.diameterMm`),
      ...(!resolution.thicknessMm ? ["thicknessMm"] : []),
    ],
  };
}

export default function ScanDiagnostics({ capture, scan, answers, association, part, error }: {
  capture: ScanCapture; scan?: ScanResult; answers: ScanAnswers; association?: AssociationResult; part?: Part; error: string;
}) {
  const values = diagnosticValues(scan, answers, association);
  const preprocessingImages = useMemo(() => {
    if (!capture.raster) return undefined;
    const { baseline, v1 } = capture.raster.inkMaps;
    return {
      baseline: mapToDataUrl(baseline, "binary"),
      grayscale: mapToDataUrl(v1, "grayscale"),
      illumination: mapToDataUrl(v1, "illumination"),
      corrected: mapToDataUrl(v1, "corrected"),
      v1: mapToDataUrl(v1, "binary"),
    };
  }, [capture.raster]);
  const report = {
    image: { originalWidth: capture.originalWidth, originalHeight: capture.originalHeight, rasterWidth: capture.width, rasterHeight: capture.height },
    coordinates: { geometryUnits: "raster pixels", ocrUnits: "original-image-pixels", origin: "top-left", originalXFactor: capture.originalWidth / capture.width, originalYFactor: capture.originalHeight / capture.height, componentBounds: "min/max inclusive" },
    preprocessing: capture.raster?.preprocessing,
    preprocessingAB: capture.raster?.preprocessingAB,
    detections: capture.raster?.components,
    detectionsV1: capture.raster?.componentsV1,
    geometryProposals: capture.raster?.proposals,
    ocr: capture.ocr ?? { status: "NOT_RUN" },
    association: association ?? { status: scan && capture.ocr?.status === "READY" ? "READY" : "NOT_READY", note: "waiting for geometry and OCR annotations" },
    geometry: scan ?? null,
    userAnswers: answers,
    ...values,
    modelStatus: part ? "Prepared; this exact Part is sent on CONFIRMAR PIEZA" : "Blocked; no Part sent",
    parametricModel: part ?? null,
    error: error || null,
  };
  return <details className="scan-diagnostics">
    <summary>LAB · Diagnóstico temporal</summary>
    <p>Imagen → geometría detectada/features → anotaciones OCR → asociación por evidencias → restricciones geométricas resueltas → modelo paramétrico.</p>
    <p><strong>GEOMETRÍA DETECTADA</strong>: las cajas azules son componentes de tinta; gris: descartado (&lt;4 píxeles). Verde: contorno; naranja: agujeros.</p>
    <p>Preprocessing A: redimensionado a 1000 px como máximo, luminancia, normalización min/max, Otsu y componentes de 8 vecinos. Preprocessing V1: luminancia, fondo local por desenfoque de caja relativo, corrección de iluminación, contraste y threshold conservador. Las dos propuestas se conservan separadas; el detector actual sigue consumiendo A.</p>
    <svg viewBox={`0 0 ${capture.originalWidth} ${capture.originalHeight}`} role="img" aria-label="Diagnóstico sobre fotografía original" style={{ width: "100%" }}>
      <image href={capture.original} width={capture.originalWidth} height={capture.originalHeight} preserveAspectRatio="none" />
      {capture.raster?.components.map(c => <g key={c.id}>
        <rect x={c.minX * capture.originalWidth / capture.width} y={c.minY * capture.originalHeight / capture.height} width={(c.maxX-c.minX+1) * capture.originalWidth / capture.width} height={(c.maxY-c.minY+1) * capture.originalHeight / capture.height} fill="none" stroke={c.retained ? "#007aff" : "#777"} vectorEffect="non-scaling-stroke" />
        <text x={c.minX * capture.originalWidth / capture.width} y={Math.max(10, c.minY * capture.originalHeight / capture.height - 2)} fontSize={Math.max(5, capture.originalWidth / 70)} fill="#0050aa">{c.id}</text>
      </g>)}
      {capture.raster?.componentsV1.map(c => <rect key={`v1-${c.id}`} x={c.minX * capture.originalWidth / capture.width} y={c.minY * capture.originalHeight / capture.height} width={(c.maxX-c.minX+1) * capture.originalWidth / capture.width} height={(c.maxY-c.minY+1) * capture.originalHeight / capture.height} fill="none" stroke="#7b45c6" strokeOpacity="0.45" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />)}
      {scan && <rect x={scan.outer.x * capture.originalWidth / capture.width} y={scan.outer.y * capture.originalHeight / capture.height} width={scan.outer.width * capture.originalWidth / capture.width} height={scan.outer.height * capture.originalHeight / capture.height} fill="none" stroke="green" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      {capture.raster?.proposals.v1.outer && <rect x={capture.raster.proposals.v1.outer.x * capture.originalWidth / capture.width} y={capture.raster.proposals.v1.outer.y * capture.originalHeight / capture.height} width={capture.raster.proposals.v1.outer.width * capture.originalWidth / capture.width} height={capture.raster.proposals.v1.outer.height * capture.originalHeight / capture.height} fill="none" stroke="#7b45c6" strokeWidth="2" strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />}
      {scan?.holes.map(h => <circle key={h.id} cx={h.x * capture.originalWidth / capture.width} cy={h.y * capture.originalHeight / capture.height} r={h.diameter * capture.originalWidth / capture.width / 2} fill="none" stroke="#e27525" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
      {capture.ocr?.detections.map((d) => <g key={d.id}>
        <polygon points={d.polygon.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#d00070" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <text x={d.bbox.x} y={Math.max(10, d.bbox.y - 3)} fill="#d00070" fontSize={Math.max(7, capture.width / 55)}>{d.text}</text>
      </g>)}
    </svg>
    <h3>OCR BASELINE</h3>
    {capture.ocr?.status === "ERROR" && <p className="notice">OCR no inicializado: {capture.ocr.error}</p>}
    {capture.ocr?.status === "READY" && <table><thead><tr><th>texto</th><th>x</th><th>y</th><th>width</th><th>height</th><th>score interno</th></tr></thead><tbody>{capture.ocr.detections.map((d) => <tr key={d.id}><td>{d.text}</td><td>{d.bbox.x.toFixed(1)}</td><td>{d.bbox.y.toFixed(1)}</td><td>{d.bbox.width.toFixed(1)}</td><td>{d.bbox.height.toFixed(1)}</td><td>{d.score.toFixed(4)}</td></tr>)}</tbody></table>}
    {capture.ocr && <p>OCR: inicialización {capture.ocr.timings.initializationMs.toFixed(0)} ms · detección {capture.ocr.timings.detectionMs.toFixed(0)} ms · reconocimiento {capture.ocr.timings.recognitionMs.toFixed(0)} ms · total {capture.ocr.timings.totalMs.toFixed(0)} ms.</p>}
    <h3>PREPROCESSING A/B</h3>
    {capture.raster && <>
      <p>A sigue siendo la entrada funcional del detector. B es una propuesta diagnóstica para reducir gradientes sin descartar trazos pequeños ni cerrar huecos artificialmente.</p>
      <div className="preprocessing-grid">
        {preprocessingImages && <>
          <figure><img src={preprocessingImages.baseline} alt="InkMap A" /><figcaption>InkMap A</figcaption></figure>
          <figure><img src={preprocessingImages.grayscale} alt="grayscale V1" /><figcaption>grayscale V1</figcaption></figure>
          <figure><img src={preprocessingImages.illumination} alt="estimación de iluminación V1" /><figcaption>iluminación estimada</figcaption></figure>
          <figure><img src={preprocessingImages.corrected} alt="corrección de iluminación V1" /><figcaption>corrección V1</figcaption></figure>
          <figure><img src={preprocessingImages.v1} alt="InkMap V1" /><figcaption>InkMap V1</figcaption></figure>
        </>}
      </div>
      <p>Parámetros A: {JSON.stringify(capture.raster.preprocessingAB.baseline.parameters)} · B: {JSON.stringify(capture.raster.preprocessingAB.v1.parameters)}</p>
      <p>Métricas A: foreground {(capture.raster.preprocessingAB.baseline.foregroundRatio * 100).toFixed(2)}% · componentes {capture.raster.preprocessingAB.baseline.componentCount} · pequeños {capture.raster.preprocessingAB.baseline.tinyComponentCount} · mayor {capture.raster.preprocessingAB.baseline.largestComponentPixels}px · preprocessing {capture.raster.preprocessingAB.baseline.preprocessingMs.toFixed(1)} ms.</p>
      <p>Métricas B: foreground {(capture.raster.preprocessingAB.v1.foregroundRatio * 100).toFixed(2)}% · componentes {capture.raster.preprocessingAB.v1.componentCount} · pequeños {capture.raster.preprocessingAB.v1.tinyComponentCount} · mayor {capture.raster.preprocessingAB.v1.largestComponentPixels}px · preprocessing {capture.raster.preprocessingAB.v1.preprocessingMs.toFixed(1)} ms.</p>
      <p>Diferencia B−A: foreground {(capture.raster.preprocessingAB.comparison.foregroundRatioDelta * 100).toFixed(2)} puntos · componentes {capture.raster.preprocessingAB.comparison.componentCountDelta} · pequeños {capture.raster.preprocessingAB.comparison.tinyComponentCountDelta} · mayor {capture.raster.preprocessingAB.comparison.largestComponentDelta}px · total {capture.raster.preprocessingAB.comparison.totalMs.toFixed(1)} ms.</p>
      <p>Componentes A: {capture.raster.components.length} · componentes B: {capture.raster.componentsV1.length}. Las propuestas B se muestran en JSON; todavía no sustituyen la geometría funcional.</p>
    </>}
    <RegionDiagnostics key={capture.original} original={capture.original} baseline={capture.ocr} />
    <h3>INTERPRETACIÓN</h3>
    {!association && <p>ASOCIACIÓN: esperando geometría y OCR baseline.</p>}
    {association && <>
      <p>Las cotas explícitas prevalecen sobre la proporción del croquis. La proporción geométrica solo aporta evidencia secundaria.</p>
      {association.hypotheses.map((hypothesis) => {
        const feature = association.features.find((item) => item.id === hypothesis.featureId);
        return <details key={hypothesis.featureId}>
          <summary>{hypothesis.featureId}: {hypothesis.status}</summary>
          <p>Feature: {feature?.kind} · {feature?.subjectKind} · {feature?.property}</p>
          {hypothesis.candidates.length === 0 && <p>Sin candidatos.</p>}
          {hypothesis.candidates.map((candidate) => {
            const annotation = association.annotations.find((item) => item.id === candidate.annotationId);
            return <div key={candidate.id}>
              <p>Annotation: "{candidate.rawText}" · bbox {JSON.stringify(annotation?.bbox)} · score OCR {annotation?.score}</p>
              <p>Candidate: feature {candidate.featureId}{candidate.valueMm ? ` · value ${candidate.valueMm} mm` : ""}</p>
              <ul>
                {candidate.evidences.map((evidence, index) => <li key={index}>{evidence.type}: {evidence.status} {"detail" in evidence ? evidence.detail : "relation" in evidence ? `${evidence.relation} (${evidence.normalizedDistance.toFixed(3)})` : ""}</li>)}
              </ul>
              <p>Result: {candidate.status}</p>
            </div>;
          })}
        </details>;
      })}
    </>}
    <p>Medidas: ancho/alto pueden proceder de cotas explícitas, confirmación manual o derivación provisional trazable. Agujeros y grosor siguen requiriendo confirmación manual.</p>
    <p>Pendientes: {values.unresolved.join(", ") || "ninguno"}. Modelo {part ? "preparado para confirmar" : "bloqueado"}.</p>
    <pre data-testid="scan-diagnostic-json" style={{ overflow: "auto", maxHeight: "28rem", maxWidth: "100%", fontSize: "12px", textAlign: "left" }}>{JSON.stringify(report, null, 2)}</pre>
  </details>;
}

function mapToDataUrl(map: import("./geometryPreprocessing").InkMap, channel: "grayscale" | "illumination" | "corrected" | "binary") {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const pixels = mapChannel(map, channel);
  const image = context.createImageData(map.width, map.height);
  for (let i = 0; i < pixels.length; i++) {
    const value = channel === "binary" ? (pixels[i] ? 0 : 255) : pixels[i];
    image.data[i * 4] = value;
    image.data[i * 4 + 1] = value;
    image.data[i * 4 + 2] = value;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}
