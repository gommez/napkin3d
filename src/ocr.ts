import type { OcrResultItem } from "@paddleocr/paddleocr-js";

export type TextDetection = {
  id: string;
  text: string;
  polygon: { x: number; y: number }[];
  bbox: { x: number; y: number; width: number; height: number };
  score: number;
};

export type OcrDiagnostics = {
  status: "READY" | "ERROR";
  engine: "@paddleocr/paddleocr-js";
  version: "0.4.2";
  detections: TextDetection[];
  timings: {
    initializationMs: number;
    detectionMs: number;
    recognitionMs: number;
    totalMs: number;
  };
  runtime?: {
    backend: string;
    detectionProvider: string;
    recognitionProvider: string;
    webgpuAvailable: boolean;
  };
  error?: string;
  coordinateSpace: "original-image-pixels";
};

function bbox(polygon: { x: number; y: number }[]) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function toDetection(item: OcrResultItem, index: number): TextDetection {
  const polygon = item.poly.map(([x, y]) => ({ x, y }));
  return {
    id: `ocr-${index + 1}`,
    text: item.text,
    polygon,
    bbox: bbox(polygon),
    score: item.score,
  };
}

export async function recognizePhoto(
  source: HTMLCanvasElement | HTMLImageElement,
  originalSize?: { width: number; height: number },
): Promise<OcrDiagnostics> {
  const totalStart = performance.now();
  try {
    const worker = await createOcrWorker();
    const summary = worker.getInitializationSummary();
    const initializationMs =
      summary?.elapsedMs ?? performance.now() - totalStart;
    const result = (await worker.predict(source))[0];
    const scaleX =
      (originalSize?.width ?? result.image.width) / result.image.width;
    const scaleY =
      (originalSize?.height ?? result.image.height) / result.image.height;
    const detections = result.items.map(toDetection).map((item) => {
      const polygon = item.polygon.map((point) => ({
        x: point.x * scaleX,
        y: point.y * scaleY,
      }));
      return { ...item, polygon, bbox: bbox(polygon) };
    });
    const diagnostics: OcrDiagnostics = {
      status: "READY",
      engine: "@paddleocr/paddleocr-js",
      version: "0.4.2",
      detections,
      timings: {
        initializationMs,
        detectionMs: result.metrics.detMs,
        recognitionMs: result.metrics.recMs,
        totalMs: performance.now() - totalStart,
      },
      runtime: {
        backend: result.runtime.requestedBackend,
        detectionProvider: result.runtime.detProvider,
        recognitionProvider: result.runtime.recProvider,
        webgpuAvailable: result.runtime.webgpuAvailable,
      },
      coordinateSpace: "original-image-pixels",
    };
    await worker.dispose();
    return diagnostics;
  } catch (error) {
    return {
      status: "ERROR",
      engine: "@paddleocr/paddleocr-js",
      version: "0.4.2",
      detections: [],
      timings: {
        initializationMs: 0,
        detectionMs: 0,
        recognitionMs: 0,
        totalMs: performance.now() - totalStart,
      },
      error: error instanceof Error ? error.message : String(error),
      coordinateSpace: "original-image-pixels",
    };
  }
}

export async function createOcrWorker() {
  const { PaddleOCR } = await import("@paddleocr/paddleocr-js");
  return PaddleOCR.create({
    textDetectionModelName: "PP-OCRv6_tiny_det",
    textDetectionModelAsset: {
      url: `${import.meta.env.BASE_URL}ocr/models/PP-OCRv6_tiny_det.tar`,
    },
    textRecognitionModelName: "PP-OCRv6_tiny_rec",
    textRecognitionModelAsset: {
      url: `${import.meta.env.BASE_URL}ocr/models/PP-OCRv6_tiny_rec.tar`,
    },
    ortOptions: {
      backend: "wasm",
      wasmPaths: `${import.meta.env.BASE_URL}ocr/ort/`,
      numThreads: 1,
      simd: true,
    },
    textRecScoreThresh: 0,
    initialize: true,
  });
}
