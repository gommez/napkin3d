import { useState } from "react";
import type { OcrDiagnostics } from "./ocr";
import { recognizeRegions, type RegionReport } from "./ocrRegions";

export default function RegionDiagnostics({
  original,
  baseline,
}: {
  original: string;
  baseline?: OcrDiagnostics;
}) {
  const [report, setReport] = useState<RegionReport>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    if (!baseline || loading) return;
    setLoading(true);
    setError("");
    try {
      const image = new Image();
      image.src = original;
      await image.decode();
      await recognizeRegions(image, baseline, setReport);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <section>
      <h3>TEST-002 · OCR POR REGIONES</h3>
      <button
        disabled={baseline?.status !== "READY" || loading}
        onClick={() => void run()}
      >
        {loading ? "Procesando TEST-002…" : "Ejecutar TEST-002"}
      </button>
      <p>
        Comparación diagnóstica; ninguna variante se selecciona como medida.
        Coordenadas en píxeles de la foto original. Score interno, no
        probabilidad de acierto.
      </p>
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <p>
            Estado: {report.status}. Regiones: {report.regions.length}.{" "}
            {baseline?.detections.length === 0 &&
              "Baseline sin regiones: no hay crops que evaluar."}
          </p>
          <p>
            Baseline: {report.timings.baselineMs.toFixed(0)} ms · inicialización
            regional: {report.timings.initializationMs.toFixed(0)} ms · crops:{" "}
            {report.timings.cropsMs.toFixed(0)} ms · preprocessing:{" "}
            {report.timings.preprocessingMs.toFixed(0)} ms · OCR variantes:{" "}
            {report.timings.variantsOcrMs.toFixed(0)} ms · total TEST-002:{" "}
            {report.timings.totalMs.toFixed(0)} ms.
          </p>
          {report.error && <p role="alert">{report.error}</p>}
          {report.regions.map((region, i) => (
            <details key={region.id}>
              <summary>REGIÓN OCR #{i + 1}</summary>
              <img
                src={region.preview}
                alt={`Crop original región ${i + 1}`}
                style={{ maxWidth: "100%" }}
              />
              <p>
                Posición baseline: {JSON.stringify(region.baseline.bbox)}. Crop
                con margen: {JSON.stringify(region.crop)}.
              </p>
              <p>
                BASELINE texto: {region.baseline.text} · score:{" "}
                {region.baseline.score} · {region.baseline.classification}
              </p>
              {region.variants.map((v) => (
                <div key={v.name}>
                  <h4>{v.name}</h4>
                  <p>
                    {v.width} × {v.height} px · parámetros:{" "}
                    {JSON.stringify(v.params)} · preprocessing:{" "}
                    {v.preprocessingMs.toFixed(0)} ms · OCR:{" "}
                    {v.ocrMs.toFixed(0)} ms
                  </p>
                  {v.error && <p role="alert">{v.error}</p>}
                  {!v.error && v.candidates.length === 0 && (
                    <p>Sin detecciones</p>
                  )}
                  {v.candidates.map((c) => (
                    <p key={c.id}>
                      Texto:{" "}
                      <span style={{ whiteSpace: "pre-wrap" }}>{c.text}</span> ·
                      score: {c.score} · {c.classification} · posición original:{" "}
                      {JSON.stringify(c.bbox)}
                    </p>
                  ))}
                </div>
              ))}
            </details>
          ))}
          <details>
            <summary>JSON TEST-002 completo</summary>
            <pre
              data-testid="ocr-regions-json"
              style={{
                overflow: "auto",
                maxHeight: "28rem",
                maxWidth: "100%",
                fontSize: 12,
                textAlign: "left",
              }}
            >
              {JSON.stringify(report, null, 2)}
            </pre>
          </details>
        </>
      )}
    </section>
  );
}
