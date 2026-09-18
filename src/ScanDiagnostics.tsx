import type { Part } from "./model";
import { resolveScan, type RasterDiagnostics, type ScanAnswers, type ScanResult } from "./scanner";
import type { OcrDiagnostics } from "./ocr";

export type ScanCapture = {
  original: string;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  raster?: RasterDiagnostics;
  ocr?: OcrDiagnostics;
};

export function diagnosticValues(scan: ScanResult | undefined, answers: ScanAnswers) {
  if (!scan) return { unresolved: ["geometry", "referenceWidthMm", "thicknessMm"], resolution: null };
  const resolution = resolveScan(scan, answers);
  return {
    resolution,
    unresolved: [
      ...(!resolution.scaleMmPerPixel ? ["referenceWidthMm", "scaleMmPerPixel", "outer.heightMm (derived)"] : []),
      ...resolution.holes.filter(h => !h.diameterMm).map(h => `${h.id}.diameterMm`),
      ...(!resolution.thicknessMm ? ["thicknessMm"] : []),
    ],
  };
}

export default function ScanDiagnostics({ capture, scan, answers, part, error }: {
  capture: ScanCapture; scan?: ScanResult; answers: ScanAnswers; part?: Part; error: string;
}) {
  const values = diagnosticValues(scan, answers);
  const report = {
    image: { originalWidth: capture.originalWidth, originalHeight: capture.originalHeight, rasterWidth: capture.width, rasterHeight: capture.height },
    coordinates: { geometryUnits: "raster pixels", ocrUnits: "original-image-pixels", origin: "top-left", originalXFactor: capture.originalWidth / capture.width, originalYFactor: capture.originalHeight / capture.height, componentBounds: "min/max inclusive" },
    preprocessing: capture.raster?.preprocessing,
    detections: capture.raster?.components,
    ocr: capture.ocr ?? { status: "NOT_RUN" },
    association: "NOT_IMPLEMENTED",
    geometry: scan ?? null,
    userAnswers: answers,
    ...values,
    modelStatus: part ? "Prepared; this exact Part is sent on CONFIRMAR PIEZA" : "Blocked; no Part sent",
    parametricModel: part ?? null,
    error: error || null,
  };
  return <details className="scan-diagnostics">
    <summary>LAB · Diagnóstico temporal</summary>
    <p>Imagen → preprocessing → geometría y OCR local independientes → detecciones + posiciones → asociación: <strong>NOT_IMPLEMENTED</strong>.</p>
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
    <h3>OCR DETECTADO</h3>
    {capture.ocr?.status === "ERROR" && <p className="notice">OCR no inicializado: {capture.ocr.error}</p>}
    {capture.ocr?.status === "READY" && <table><thead><tr><th>texto</th><th>x</th><th>y</th><th>width</th><th>height</th><th>score interno</th></tr></thead><tbody>{capture.ocr.detections.map((d) => <tr key={d.id}><td>{d.text}</td><td>{d.bbox.x.toFixed(1)}</td><td>{d.bbox.y.toFixed(1)}</td><td>{d.bbox.width.toFixed(1)}</td><td>{d.bbox.height.toFixed(1)}</td><td>{d.score.toFixed(4)}</td></tr>)}</tbody></table>}
    {capture.ocr && <p>OCR: inicialización {capture.ocr.timings.initializationMs.toFixed(0)} ms · detección {capture.ocr.timings.detectionMs.toFixed(0)} ms · reconocimiento {capture.ocr.timings.recognitionMs.toFixed(0)} ms · total {capture.ocr.timings.totalMs.toFixed(0)} ms.</p>}
    <p>ASOCIACIÓN: <strong>NOT_IMPLEMENTED</strong>. El texto no modifica geometría, medidas ni modelo paramétrico.</p>
    <p>Medidas: ancho, diámetros y grosor proceden exclusivamente de respuestas manuales. Altura y centros se derivan de píxeles y escala. No se lee la cota vertical.</p>
    <p>Pendientes: {values.unresolved.join(", ") || "ninguno"}. Modelo {part ? "preparado para confirmar" : "bloqueado"}.</p>
    <pre data-testid="scan-diagnostic-json" style={{ overflow: "auto", maxHeight: "28rem", maxWidth: "100%", fontSize: "12px", textAlign: "left" }}>{JSON.stringify(report, null, 2)}</pre>
  </details>;
}
