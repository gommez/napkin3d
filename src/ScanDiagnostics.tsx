import RegionDiagnostics from "./RegionDiagnostics";
import type { Part } from "./model";
import { resolveScan, type RasterDiagnostics, type ScanAnswers, type ScanResult } from "./scanner";
import type { OcrDiagnostics } from "./ocr";
import type { AssociationResult } from "./association";

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
  const report = {
    image: { originalWidth: capture.originalWidth, originalHeight: capture.originalHeight, rasterWidth: capture.width, rasterHeight: capture.height },
    coordinates: { geometryUnits: "raster pixels", ocrUnits: "original-image-pixels", origin: "top-left", originalXFactor: capture.originalWidth / capture.width, originalYFactor: capture.originalHeight / capture.height, componentBounds: "min/max inclusive" },
    preprocessing: capture.raster?.preprocessing,
    detections: capture.raster?.components,
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
    <p>Preprocessing: redimensionado a 1000 px como máximo (mínimo 8 por eje), gris 0.299R + 0.587G + 0.114B, normalización min/max, Otsu y componentes de 8 vecinos. Sin corrección de perspectiva. JPEG 0.85 solo para la foto guardada; el detector recibe RGBA del canvas.</p>
    <svg viewBox={`0 0 ${capture.originalWidth} ${capture.originalHeight}`} role="img" aria-label="Diagnóstico sobre fotografía original" style={{ width: "100%" }}>
      <image href={capture.original} width={capture.originalWidth} height={capture.originalHeight} preserveAspectRatio="none" />
      {capture.raster?.components.map(c => <g key={c.id}>
        <rect x={c.minX * capture.originalWidth / capture.width} y={c.minY * capture.originalHeight / capture.height} width={(c.maxX-c.minX+1) * capture.originalWidth / capture.width} height={(c.maxY-c.minY+1) * capture.originalHeight / capture.height} fill="none" stroke={c.retained ? "#007aff" : "#777"} vectorEffect="non-scaling-stroke" />
        <text x={c.minX * capture.originalWidth / capture.width} y={Math.max(10, c.minY * capture.originalHeight / capture.height - 2)} fontSize={Math.max(5, capture.originalWidth / 70)} fill="#0050aa">{c.id}</text>
      </g>)}
      {scan && <rect x={scan.outer.x * capture.originalWidth / capture.width} y={scan.outer.y * capture.originalHeight / capture.height} width={scan.outer.width * capture.originalWidth / capture.width} height={scan.outer.height * capture.originalHeight / capture.height} fill="none" stroke="green" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
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
