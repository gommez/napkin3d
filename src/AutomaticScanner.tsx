import { useMemo, useRef, useState } from "react";
import {
  partFromScan,
  resolveScan,
  scanRaster,
  type ScanAnswers,
  type ScanResult,
} from "./scanner";
import ScanDiagnostics, { type ScanCapture } from "./ScanDiagnostics";
import type { Part, Photo } from "./model";
import { recognizePhoto } from "./ocr";

export default function AutomaticScanner({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: (part: Part, photo: Photo) => void;
}) {
  const request = useRef(0);
  const [capture, setCapture] = useState<ScanCapture>();
  const [image, setImage] = useState<string>();
  const [scan, setScan] = useState<ScanResult>();
  const [answers, setAnswers] = useState<ScanAnswers>({
    holeDiametersMm: {},
  });
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const resolution = scan ? resolveScan(scan, answers) : undefined;

  const preparedPart = useMemo(() => scan && resolveScan(scan, answers).ready ? partFromScan(scan, answers) : undefined, [scan, answers]);
  const diagnostics = capture && <ScanDiagnostics capture={capture} scan={scan} answers={answers} part={preparedPart} error={error} />;

  async function process(file?: File) {
    if (!file) return;
    const requestId = ++request.current;
    setScan(undefined);
    setCapture(undefined);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const photo = new Image();
      photo.src = url;
      await photo.decode();
      const scale = Math.min(1, 1000 / Math.max(photo.width, photo.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(8, Math.round(photo.width * scale));
      canvas.height = Math.max(8, Math.round(photo.height * scale));
      canvas.getContext("2d")!.drawImage(photo, 0, 0, canvas.width, canvas.height);
      const original = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("No se pudo leer la fotografía original."));
        reader.readAsDataURL(file);
      });
      if (requestId !== request.current) return;
      const nextCapture: ScanCapture = { original, originalWidth: photo.width, originalHeight: photo.height, width: canvas.width, height: canvas.height };
      setCapture(nextCapture);
      void recognizePhoto(canvas, { width: photo.width, height: photo.height }).then((ocr) => setCapture((current) => current && requestId === request.current ? { ...current, ocr } : current));
      const result = scanRaster(
        canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height)
          .data,
        canvas.width,
        canvas.height,
        (raster) => setCapture({ ...nextCapture, raster }),
      );
      setImage(canvas.toDataURL("image/jpeg", 0.85));
      setScan(result);
      setAnswers({ holeDiametersMm: {} });
      setConfirmed(false);
      setError("");

    } catch (e) {
      setError((e as Error).message || "No entiendo completamente este contorno.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function updateAnswers(next: Partial<ScanAnswers>) {
    setAnswers((current) => ({ ...current, ...next }));
  }

  if (!scan) {
    return (
      <main className="entry-screen automatic-screen">
        <button className="back-button" onClick={onBack}>
          ← Inicio
        </button>
        <h2>NUEVA PIEZA</h2>
        <div className="entry-actions">
          <label className="entry-choice entry-choice-primary" htmlFor="automatic-camera-input">
            <strong>HACER FOTO</strong>
            <input
              id="automatic-camera-input"
              className="native-file-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                void process(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <label className="entry-choice" htmlFor="automatic-gallery-input">
            <strong>ELEGIR FOTO</strong>
            <input
              id="automatic-gallery-input"
              className="native-file-input"
              type="file"
              accept="image/*"
              onChange={(e) => {
                void process(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {diagnostics}
        {error && <p className="notice" role="alert">{error}</p>}
      </main>
    );
  }

  if (confirmed) {
    return (
      <main className="entry-screen automatic-screen">
        <button className="back-button" onClick={() => setConfirmed(false)}>
          ← Revisar
        </button>
        <h2>CONFIRMA TU PIEZA</h2>
        {diagnostics}
        <div className="scan-summary">
          <strong>
            {resolution!.outer.width * resolution!.scaleMmPerPixel!} × {resolution!.outer.height * resolution!.scaleMmPerPixel!} mm
          </strong>
          <span>Grosor: {resolution!.thicknessMm} mm</span>
          <span>{resolution!.holes.length} agujero(s)</span>
          {resolution!.holes.map((hole) => (
            <span key={hole.id}>Agujero: {hole.diameterMm} mm</span>
          ))}
        </div>
        <button
          className="entry-choice entry-choice-primary"
          onClick={() => {
            const part = preparedPart!;
            const sourceImage = {
              data: image!,
              width: scan.imageWidth,
              height: scan.imageHeight,
              mmPerPixel: resolution!.scaleMmPerPixel!,
              opacity: 0.55,
            };
            onComplete(part, sourceImage);
          }}
        >
          <strong>CONFIRMAR PIEZA</strong>
          <span>Abrir en 3D</span>
        </button>
      </main>
    );
  }

  return (
    <main className="entry-screen automatic-screen scanner-review">
      <button className="back-button" onClick={onBack}>
        ← Inicio
      </button>
      <h2>REVISA EL BOCETO</h2>
      {diagnostics}
      {image && <img className="scan-photo" src={image} alt="Foto del boceto" />}
      <svg
        className="scan-preview"
        viewBox={`0 0 ${scan.imageWidth} ${scan.imageHeight}`}
        role="img"
        aria-label="Geometría reconstruida"
      >
        <rect
          x={scan.outer.x}
          y={scan.outer.y}
          width={scan.outer.width}
          height={scan.outer.height}
          fill="none"
          stroke="#163d38"
          strokeWidth={Math.max(1, scan.outer.width / 100)}
        />
        {scan.holes.map((hole) => (
          <g key={hole.id}>
            <circle
              cx={hole.x}
              cy={hole.y}
              r={hole.diameter / 2}
              fill="none"
              stroke="#e27525"
              strokeWidth={Math.max(1, scan.outer.width / 140)}
              strokeDasharray="5 3"
            />
            <path
              d={`M ${hole.x - hole.diameter / 3} ${hole.y} H ${hole.x + hole.diameter / 3} M ${hole.x} ${hole.y - hole.diameter / 3} V ${hole.y + hole.diameter / 3}`}
              stroke="#e27525"
              strokeWidth={Math.max(1, scan.outer.width / 140)}
            />
          </g>
        ))}
      </svg>
      <p className="hint">Contorno exterior detectado. Los círculos marcados necesitan confirmación.</p>
      <div className="scan-fields">
        <label>
          Ancho exterior (mm)
          <input
            type="number"
            min="0.1"
            step="any"
            inputMode="decimal"
            value={answers.referenceWidthMm ?? ""}
            onChange={(e) => updateAnswers({ referenceWidthMm: e.target.valueAsNumber })}
          />
        </label>
        {scan.holes.map((hole, index) => (
          <label key={hole.id}>
            Diámetro del agujero {index + 1} (mm)
            <input
              type="number"
              min="0.1"
              step="any"
              inputMode="decimal"
              value={answers.holeDiametersMm[hole.id] ?? ""}
              onChange={(e) =>
                updateAnswers({
                  holeDiametersMm: {
                    ...answers.holeDiametersMm,
                    [hole.id]: e.target.valueAsNumber,
                  },
                })
              }
            />
          </label>
        ))}
        <label>
          ¿Qué grosor tendrá la pieza? (mm)
          <input
            type="number"
            min="0.1"
            step="any"
            inputMode="decimal"
            value={answers.thicknessMm ?? ""}
            onChange={(e) => updateAnswers({ thicknessMm: e.target.valueAsNumber })}
          />
        </label>
      </div>
      {!resolution?.ready && (
        <p className="notice">Completa las medidas pendientes antes de confirmar.</p>
      )}
      <button
        className="entry-choice entry-choice-primary"
        disabled={!resolution?.ready}
        onClick={() => setConfirmed(true)}
      >
        <strong>CONTINUAR</strong>
        <span>Revisar medidas</span>
      </button>
    </main>
  );
}
