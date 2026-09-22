export type InkMapMode = "baseline" | "v1";

export type InkMap = {
  mode: InkMapMode;
  width: number;
  height: number;
  grayscale: Uint8Array;
  illumination?: Uint8Array;
  corrected?: Uint8Array;
  binary: Uint8Array;
  parameters: {
    grayscale: "luma-0.299-0.587-0.114";
    threshold: number;
    illuminationRadius?: number;
    contrastGain?: number;
    thresholdMethod: "otsu" | "local-background-otsu";
  };
  timings: { totalMs: number };
};

export type InkMapMetrics = {
  foregroundPixels: number;
  foregroundRatio: number;
  componentCount: number;
  tinyComponentCount: number;
  largestComponentPixels: number;
};

export type InkMapSummary = InkMapMetrics & {
  mode: InkMapMode;
  width: number;
  height: number;
  preprocessingMs: number;
  parameters: InkMap["parameters"];
};

function luminance(data: Uint8ClampedArray) {
  const gray = new Uint8Array(data.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const offset = i * 4;
    gray[i] = Math.round(
      0.299 * data[offset] +
        0.587 * data[offset + 1] +
        0.114 * data[offset + 2],
    );
  }
  return gray;
}

function minMax(values: Uint8Array) {
  let min = 255;
  let max = 0;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

export function otsuThreshold(values: Uint8Array | number[]) {
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

function stretch(values: Uint8Array) {
  const { min, max } = minMax(values);
  const output = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    output[i] =
      max === min ? values[i] : Math.round(((values[i] - min) * 255) / (max - min));
  }
  return output;
}

/** Separable box blur using prefix sums. Radius is relative to image size. */
function boxBlur(values: Uint8Array, width: number, height: number, radius: number) {
  const horizontal = new Float32Array(values.length);
  const output = new Uint8Array(values.length);
  const rowPrefix = new Float64Array(width + 1);
  for (let y = 0; y < height; y++) {
    rowPrefix[0] = 0;
    for (let x = 0; x < width; x++) rowPrefix[x + 1] = rowPrefix[x] + values[y * width + x];
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      horizontal[y * width + x] =
        (rowPrefix[right + 1] - rowPrefix[left]) / (right - left + 1);
    }
  }
  const columnPrefix = new Float64Array(height + 1);
  for (let x = 0; x < width; x++) {
    columnPrefix[0] = 0;
    for (let y = 0; y < height; y++)
      columnPrefix[y + 1] = columnPrefix[y] + horizontal[y * width + x];
    for (let y = 0; y < height; y++) {
      const top = Math.max(0, y - radius);
      const bottom = Math.min(height - 1, y + radius);
      output[y * width + x] = Math.round(
        (columnPrefix[bottom + 1] - columnPrefix[top]) / (bottom - top + 1),
      );
    }
  }
  return output;
}

function correctedFromBackground(
  gray: Uint8Array,
  illumination: Uint8Array,
  gain: number,
) {
  const corrected = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    corrected[i] = Math.max(
      0,
      Math.min(255, Math.round(128 + (gray[i] - illumination[i]) * gain)),
    );
  }
  return corrected;
}

function binaryFrom(values: Uint8Array, threshold: number, inclusive = true) {
  const binary = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++)
    binary[i] = (inclusive ? values[i] <= threshold : values[i] < threshold) ? 1 : 0;
  return binary;
}

export function preprocessGeometry(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { baseline: InkMap; v1: InkMap } {
  const started = performance.now();
  const gray = luminance(data);
  const stretched = stretch(gray);
  const baselineThreshold = otsuThreshold(stretched);
  const baselineBinary = binaryFrom(stretched, baselineThreshold);
  const baselineTime = performance.now();
  const radius = Math.max(2, Math.min(64, Math.round(Math.min(width, height) * 0.04)));
  const illumination = boxBlur(gray, width, height, radius);
  const corrected = correctedFromBackground(gray, illumination, 2.2);
  const rawThreshold = otsuThreshold(corrected);
  const threshold = Math.max(80, Math.min(120, rawThreshold));
  const v1Binary = binaryFrom(corrected, threshold, false);
  const v1Time = performance.now();
  return {
    baseline: {
      mode: "baseline",
      width,
      height,
      grayscale: stretched,
      binary: baselineBinary,
      parameters: {
        grayscale: "luma-0.299-0.587-0.114",
        threshold: baselineThreshold,
        thresholdMethod: "otsu",
      },
      timings: { totalMs: baselineTime - started },
    },
    v1: {
      mode: "v1",
      width,
      height,
      grayscale: gray,
      illumination,
      corrected,
      binary: v1Binary,
      parameters: {
        grayscale: "luma-0.299-0.587-0.114",
        threshold,
        illuminationRadius: radius,
        contrastGain: 2.2,
        thresholdMethod: "local-background-otsu",
      },
      timings: { totalMs: v1Time - baselineTime },
    },
  };
}

export function summarizeInkMap(map: InkMap, componentPixels: number[]): InkMapSummary {
  const foregroundPixels = map.binary.reduce((count, value) => count + value, 0);
  let largestComponentPixels = 0;
  for (const pixels of componentPixels) largestComponentPixels = Math.max(largestComponentPixels, pixels);
  return {
    mode: map.mode,
    width: map.width,
    height: map.height,
    foregroundPixels,
    foregroundRatio: foregroundPixels / Math.max(1, map.binary.length),
    componentCount: componentPixels.length,
    tinyComponentCount: componentPixels.filter((pixels) => pixels < 4).length,
    largestComponentPixels,
    preprocessingMs: map.timings.totalMs,
    parameters: map.parameters,
  };
}

export function mapChannel(map: InkMap, channel: "grayscale" | "illumination" | "corrected" | "binary") {
  if (channel === "binary") return map.binary;
  if (channel === "illumination") return map.illumination ?? map.grayscale;
  if (channel === "corrected") return map.corrected ?? map.grayscale;
  return map.grayscale;
}
