import {
  createOcrWorker,
  type OcrDiagnostics,
  type TextDetection,
} from "./ocr";

export type Compatibility =
  "dimension-compatible" | "non-dimension-compatible" | "ambiguous";
export function classifyDimension(text: string): Compatibility {
  const number = String.raw`\d+(?:[.,]\d+)?`;
  const atom = String.raw`(?:Ø|R)?\s*${number}(?:\s*mm)?`;
  if (new RegExp(`^\\s*${atom}(?:\\s*[x×]\\s*${atom})*\\s*$`).test(text))
    return "dimension-compatible";
  if (!text.trim() || /[0-9ØRx×.,]/.test(text) || /^[\sOmSIl]+$/.test(text))
    return "ambiguous";
  return "non-dimension-compatible";
}
export type Box = TextDetection["bbox"];
export function cropBounds(box: Box, width: number, height: number): Box {
  const margin = Math.max(8, Math.ceil(Math.min(box.width, box.height) * 0.25));
  const x = Math.max(0, Math.floor(box.x - margin));
  const y = Math.max(0, Math.floor(box.y - margin));
  return {
    x,
    y,
    width: Math.min(width, Math.ceil(box.x + box.width + margin)) - x,
    height: Math.min(height, Math.ceil(box.y + box.height + margin)) - y,
  };
}
export function mapDetection(
  item: TextDetection,
  crop: Box,
  width: number,
  height: number,
): TextDetection {
  const polygon = item.polygon.map((p) => ({
    x: crop.x + (p.x * crop.width) / width,
    y: crop.y + (p.y * crop.height) / height,
  }));
  const xs = polygon.map((p) => p.x),
    ys = polygon.map((p) => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return {
    ...item,
    polygon,
    bbox: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y },
  };
}
// Fixed contrast stretch and threshold make the experiment reproducible, including flat crops.
export function preprocess(data: Uint8ClampedArray, binary: boolean) {
  const gray = Array.from({ length: data.length / 4 }, (_, i) =>
    Math.round(
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2],
    ),
  );
  let min = 255,
    max = 0;
  for (const value of gray) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const output = new Uint8ClampedArray(data);
  gray.forEach((value, i) => {
    const stretched =
      max === min ? value : Math.round(((value - min) * 255) / (max - min));
    const v = binary ? (stretched < 128 ? 0 : 255) : stretched;
    output[i * 4] = output[i * 4 + 1] = output[i * 4 + 2] = v;
  });
  return output;
}
export const experiments = [
  { name: "original", scale: 1, mode: "color", params: {} },
  { name: "upscale", scale: 2, mode: "color", params: {} },
  { name: "grayscale/contrast", scale: 1, mode: "gray", params: {} },
  { name: "binary", scale: 1, mode: "binary", params: {} },
  { name: "upscale/binary", scale: 2, mode: "binary", params: {} },
  {
    name: "original/box-threshold",
    scale: 1,
    mode: "color",
    params: { textDetBoxThresh: 0.3 },
  },
] as const;
export type Candidate = TextDetection & { classification: Compatibility };
export type Region = {
  id: string;
  baseline: Candidate;
  crop: Box;
  preview: string;
  variants: {
    name: string;
    params: object;
    width: number;
    height: number;
    preprocessingMs: number;
    ocrMs: number;
    detectionMs?: number;
    recognitionMs?: number;
    candidates: Candidate[];
    error?: string;
  }[];
};
export type RegionReport = {
  status: "RUNNING" | "READY" | "ERROR";
  error?: string;
  coordinateSpace: "original-image-pixels";
  association: "NOT_IMPLEMENTED";
  regions: Region[];
  timings: {
    baselineMs: number;
    initializationMs: number;
    cropsMs: number;
    preprocessingMs: number;
    variantsOcrMs: number;
    regionsMs: number;
    totalMs: number;
  };
};
export async function recognizeRegions(
  original: HTMLImageElement,
  baseline: OcrDiagnostics,
  publish: (report: RegionReport) => void,
): Promise<void> {
  const start = performance.now();
  const report: RegionReport = {
    status: "RUNNING",
    coordinateSpace: "original-image-pixels",
    association: "NOT_IMPLEMENTED",
    regions: [],
    timings: {
      baselineMs: baseline.timings.totalMs,
      initializationMs: 0,
      cropsMs: 0,
      preprocessingMs: 0,
      variantsOcrMs: 0,
      regionsMs: 0,
      totalMs: baseline.timings.totalMs,
    },
  };
  const emit = () => {
    report.timings.regionsMs = performance.now() - start;
    report.timings.totalMs =
      report.timings.baselineMs + report.timings.regionsMs;
    publish(structuredClone(report));
  };
  let worker: Awaited<ReturnType<typeof createOcrWorker>> | undefined;
  emit();
  try {
    if (!baseline.detections.length) {
      report.status = "READY";
      return;
    }
    const init = performance.now();
    worker = await createOcrWorker();
    report.timings.initializationMs = performance.now() - init;
    for (const detection of baseline.detections) {
      const cropStart = performance.now();
      const crop = cropBounds(
        detection.bbox,
        original.naturalWidth,
        original.naturalHeight,
      );
      if (crop.width <= 0 || crop.height <= 0)
        throw new Error("Región OCR fuera de la imagen original");
      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        original,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      );
      const region: Region = {
        id: detection.id,
        baseline: {
          ...detection,
          classification: classifyDimension(detection.text),
        },
        crop,
        preview: canvas.toDataURL("image/png"),
        variants: [],
      };
      report.regions.push(region);
      report.timings.cropsMs += performance.now() - cropStart;
      for (const experiment of experiments) {
        const prepStart = performance.now();
        const variant = document.createElement("canvas");
        variant.width = crop.width * experiment.scale;
        variant.height = crop.height * experiment.scale;
        const context = variant.getContext("2d")!;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(canvas, 0, 0, variant.width, variant.height);
        if (experiment.mode !== "color") {
          const pixels = context.getImageData(
            0,
            0,
            variant.width,
            variant.height,
          );
          pixels.data.set(
            preprocess(pixels.data, experiment.mode === "binary"),
          );
          context.putImageData(pixels, 0, 0);
        }
        const entry: Region["variants"][number] = {
          name: experiment.name,
          params: experiment.params,
          width: variant.width,
          height: variant.height,
          preprocessingMs: performance.now() - prepStart,
          ocrMs: 0,
          candidates: [],
        };
        report.timings.preprocessingMs += entry.preprocessingMs;
        const ocrStart = performance.now();
        try {
          const result = (await worker.predict(variant, experiment.params))[0];
          entry.detectionMs = result.metrics.detMs;
          entry.recognitionMs = result.metrics.recMs;
          entry.candidates = result.items.map((item, i) => {
            const mapped = mapDetection(
              {
                id: `${region.id}-${experiment.name}-${i}`,
                text: item.text,
                score: item.score,
                polygon: item.poly.map(([x, y]) => ({ x, y })),
                bbox: crop,
              },
              crop,
              result.image.width,
              result.image.height,
            );
            return { ...mapped, classification: classifyDimension(item.text) };
          });
        } catch (error) {
          entry.error = String(error);
        }
        entry.ocrMs = performance.now() - ocrStart;
        report.timings.variantsOcrMs += entry.ocrMs;
        region.variants.push(entry);
        variant.width = variant.height = 1;
        emit();
      }
      canvas.width = canvas.height = 1;
    }
    report.status = report.regions.some((r) => r.variants.some((v) => v.error))
      ? "ERROR"
      : "READY";
  } catch (error) {
    report.status = "ERROR";
    report.error = String(error);
  } finally {
    try {
      await worker?.dispose();
    } catch (error) {
      report.status = "ERROR";
      report.error = String(error);
    }
    emit();
  }
}
