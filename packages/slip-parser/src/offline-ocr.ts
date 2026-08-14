import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { createCanvas, loadImage, type Canvas } from "@napi-rs/canvas";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as Tesseract from "tesseract.js";

import { sha256Hex, stableJson } from "./digest.js";
import type {
  AdmittedDocument,
  AdapterExtractionResult,
  BoundingBox,
  ExtractionContext,
  ParserIssue,
  ParserLimits,
  TextEvidence,
  TextExtractionAdapter,
} from "./types.js";

const ADAPTER_ID = "bundled-tesseract-pdfjs-ocr-v1";
const TESSERACT_VERSION = "7.0.0";
const TESSERACT_CORE_VERSION = "7.0.0";
const PDFJS_VERSION = "6.1.200";
const CANVAS_VERSION = "1.0.6";
const LANGUAGE_DATA_VERSION = "1.0.0";

const HARD_MAX_CONCURRENCY = 2;
const HARD_MAX_DURATION_MS = 5 * 60_000;
const HARD_MAX_PAGES = 100;
const HARD_MAX_PAGE_PIXELS = 25_000_000;
const HARD_MAX_TOTAL_PIXELS = 100_000_000;
const HARD_MAX_RASTER_SCALE = 4;
const HARD_MAX_MEMORY_BYTES = 1024 * 1024 * 1024;
const OCR_RUNTIME_MEMORY_RESERVE_BYTES = 256 * 1024 * 1024;

const requireFromPackage = createRequire(import.meta.url);

let activeOcrJobs = 0;
let activeOcrReservedBytes = 0;

type OcrControlReason = "cancelled" | "processing-timeout";

class OcrControlError extends Error {
  constructor(readonly reason: OcrControlReason) {
    super(reason);
    this.name = "OcrControlError";
  }
}

class OcrResourceError extends Error {
  constructor(readonly resource: string) {
    super(resource);
    this.name = "OcrResourceError";
  }
}

interface EffectiveOcrLimits {
  readonly pages: number;
  readonly pagePixels: number;
  readonly totalPixels: number;
  readonly rasterScale: number;
  readonly dimension: number;
  readonly durationMs: number;
  readonly memoryBytes: number;
  readonly concurrency: number;
}

interface RasterPage {
  readonly page: number;
  readonly bytes: Buffer;
  readonly width: number;
  readonly height: number;
  readonly pixels: number;
  readonly pageDigest: string;
  readonly coordinateSpace: TextEvidence["coordinateSpace"];
  readonly toSourceBounds: (bounds: BoundingBox) => BoundingBox;
  dispose(): void;
}

type OcrWorker = Awaited<ReturnType<typeof Tesseract.createWorker>>;

function issue(
  code: ParserIssue["code"],
  id: string,
  message: string,
): ParserIssue {
  return { id, code, severity: "error", message };
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function effectiveLimits(limits: Readonly<ParserLimits>): EffectiveOcrLimits | null {
  if (
    !finitePositive(limits.maxOcrPages) ||
    !finitePositive(limits.maxOcrPagePixels) ||
    !finitePositive(limits.maxOcrTotalPixels) ||
    !finitePositive(limits.maxOcrRasterScale) ||
    !finitePositive(limits.maxOcrDurationMs) ||
    !finitePositive(limits.maxOcrMemoryBytes) ||
    !finitePositive(limits.maxOcrConcurrency) ||
    !finitePositive(limits.maxImageDimension)
  ) {
    return null;
  }
  return {
    pages: Math.min(
      Math.floor(limits.maxOcrPages),
      Math.floor(limits.maxPdfPages),
      HARD_MAX_PAGES,
    ),
    pagePixels: Math.min(
      Math.floor(limits.maxOcrPagePixels),
      Math.floor(limits.maxImagePixels),
      HARD_MAX_PAGE_PIXELS,
    ),
    totalPixels: Math.min(Math.floor(limits.maxOcrTotalPixels), HARD_MAX_TOTAL_PIXELS),
    rasterScale: Math.min(limits.maxOcrRasterScale, HARD_MAX_RASTER_SCALE),
    dimension: Math.min(Math.floor(limits.maxImageDimension), 16_384),
    durationMs: Math.min(Math.floor(limits.maxOcrDurationMs), HARD_MAX_DURATION_MS),
    memoryBytes: Math.min(Math.floor(limits.maxOcrMemoryBytes), HARD_MAX_MEMORY_BYTES),
    concurrency: Math.min(Math.floor(limits.maxOcrConcurrency), HARD_MAX_CONCURRENCY),
  };
}

function reserveJob(
  document: AdmittedDocument,
  limits: EffectiveOcrLimits,
): { readonly bytes: number } | ParserIssue {
  const decodedImageBytes = document.image
    ? document.image.width * document.image.height * 4
    : 0;
  const reservedBytes =
    OCR_RUNTIME_MEMORY_RESERVE_BYTES +
    document.bytes.byteLength * 2 +
    decodedImageBytes +
    limits.pagePixels * 8;
  if (reservedBytes > limits.memoryBytes) {
    return issue(
      "resource-limit",
      "ocr:memory-reservation",
      "The configured OCR memory limit is too small for the bounded runtime, source copies, decoded image pixels, and one raster page.",
    );
  }
  if (activeOcrJobs >= limits.concurrency) {
    return issue(
      "resource-limit",
      "ocr:concurrency",
      "The bounded local OCR concurrency limit is already in use. No work was queued and no partial data was returned.",
    );
  }
  if (activeOcrReservedBytes + reservedBytes > limits.memoryBytes * limits.concurrency) {
    return issue(
      "resource-limit",
      "ocr:aggregate-memory",
      "Starting another OCR job would exceed the configured aggregate memory reservation.",
    );
  }
  activeOcrJobs += 1;
  activeOcrReservedBytes += reservedBytes;
  return { bytes: reservedBytes };
}

function releaseJob(reservation: { readonly bytes: number }): void {
  activeOcrJobs = Math.max(0, activeOcrJobs - 1);
  activeOcrReservedBytes = Math.max(0, activeOcrReservedBytes - reservation.bytes);
}

async function runBounded<T>(
  operation: Promise<T>,
  deadline: number,
  signal: AbortSignal | undefined,
  interrupt?: () => void,
): Promise<T> {
  if (signal?.aborted) {
    interrupt?.();
    throw new OcrControlError("cancelled");
  }
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    interrupt?.();
    throw new OcrControlError("processing-timeout");
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const control = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      interrupt?.();
      reject(new OcrControlError("processing-timeout"));
    }, remaining);
    if (signal) {
      onAbort = () => {
        interrupt?.();
        reject(new OcrControlError("cancelled"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });

  try {
    return await Promise.race([operation, control]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  }
}

function resolvePackageRoot(packageName: string): string {
  return dirname(requireFromPackage.resolve(`${packageName}/package.json`));
}

async function readLanguageModels(): Promise<{
  readonly languages: Tesseract.Lang[];
  dispose(): void;
}> {
  const specs = [
    { code: "eng", packageName: "@tesseract.js-data/eng" },
    { code: "fra", packageName: "@tesseract.js-data/fra" },
  ] as const;
  const data = await Promise.all(
    specs.map(async ({ code, packageName }) => ({
      code,
      data: new Uint8Array(
        await readFile(
          join(resolvePackageRoot(packageName), "4.0.0_best_int", `${code}.traineddata.gz`),
        ),
      ),
    })),
  );
  return {
    languages: data,
    dispose(): void {
      for (const language of data) language.data.fill(0);
    },
  };
}

function normalizedConfidence(value: number): number {
  return Math.max(0, Math.min(1, value / 100));
}

function normalizeBounds(bounds: BoundingBox): BoundingBox {
  return {
    x: Math.max(0, bounds.x),
    y: Math.max(0, bounds.y),
    width: Math.max(0, bounds.width),
    height: Math.max(0, bounds.height),
  };
}

function evidence(
  text: string,
  confidence: number,
  rasterBounds: BoundingBox,
  raster: RasterPage,
  sourceDigest: string,
): TextEvidence | null {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (normalizedText.length === 0 || normalizedText.length > 4_096) return null;
  const base = {
    text: normalizedText,
    page: raster.page,
    bounds: normalizeBounds(raster.toSourceBounds(normalizeBounds(rasterBounds))),
    coordinateSpace: raster.coordinateSpace,
    confidence: normalizedConfidence(confidence),
    adapterId: ADAPTER_ID,
    sourceDigest,
    pageDigest: raster.pageDigest,
  } as const;
  return {
    ...base,
    evidenceDigest: sha256Hex(stableJson(base)),
  };
}

function tokensFromBlocks(
  blocks: Tesseract.Block[] | null,
  raster: RasterPage,
  sourceDigest: string,
): TextEvidence[] {
  const tokens: TextEvidence[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const token = evidence(
            word.text,
            word.confidence,
            {
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0,
            },
            raster,
            sourceDigest,
          );
          if (token) tokens.push(token);
        }
      }
    }
  }
  return tokens;
}

function tokensFromTsv(
  tsv: string | null,
  raster: RasterPage,
  sourceDigest: string,
): TextEvidence[] {
  if (!tsv) return [];
  const tokens: TextEvidence[] = [];
  const lines = tsv.split(/\r?\n/);
  for (let index = 1; index < lines.length; index += 1) {
    const columns = (lines[index] ?? "").split("\t");
    if (columns.length < 12 || columns[0] !== "5") continue;
    const left = Number(columns[6]);
    const top = Number(columns[7]);
    const width = Number(columns[8]);
    const height = Number(columns[9]);
    const confidence = Number(columns[10]);
    if (![left, top, width, height, confidence].every(Number.isFinite)) continue;
    const token = evidence(
      columns.slice(11).join("\t"),
      confidence,
      { x: left, y: top, width, height },
      raster,
      sourceDigest,
    );
    if (token) tokens.push(token);
  }
  return tokens;
}

function boundedRasterDimensions(
  sourceWidth: number,
  sourceHeight: number,
  preferredScale: number,
  limits: EffectiveOcrLimits,
): { readonly width: number; readonly height: number; readonly scale: number } | null {
  if (!finitePositive(sourceWidth) || !finitePositive(sourceHeight)) return null;
  const pixelScale = Math.sqrt(limits.pagePixels / (sourceWidth * sourceHeight));
  const dimensionScale = limits.dimension / Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(preferredScale, limits.rasterScale, pixelScale, dimensionScale);
  if (!finitePositive(scale)) return null;
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  const height = Math.max(1, Math.floor(sourceHeight * scale));
  if (width * height > limits.pagePixels) return null;
  return { width, height, scale };
}

async function rasterizeImage(
  document: AdmittedDocument,
  limits: EffectiveOcrLimits,
  deadline: number,
  signal: AbortSignal | undefined,
): Promise<RasterPage> {
  if (!document.image) throw new Error("Missing admitted image metadata");
  const decoded = await runBounded(loadImage(document.bytes), deadline, signal);
  if (
    decoded.width !== document.image.width ||
    decoded.height !== document.image.height
  ) {
    throw new Error("Decoded image dimensions do not match admission metadata");
  }
  const dimensions = boundedRasterDimensions(
    decoded.width,
    decoded.height,
    1,
    limits,
  );
  if (!dimensions) throw new OcrResourceError("image-raster-dimensions");
  const canvas = createCanvas(dimensions.width, dimensions.height);
  let handedOff = false;
  try {
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, dimensions.width, dimensions.height);
    context.drawImage(decoded, 0, 0, dimensions.width, dimensions.height);
    const bytes = await runBounded(canvas.encode("png"), deadline, signal);
    const scaleX = decoded.width / dimensions.width;
    const scaleY = decoded.height / dimensions.height;
    handedOff = true;
    return {
      page: 1,
      bytes,
      width: dimensions.width,
      height: dimensions.height,
      pixels: dimensions.width * dimensions.height,
      pageDigest: sha256Hex(bytes),
      coordinateSpace: "image-pixels-top-left",
      toSourceBounds(bounds): BoundingBox {
        return {
          x: bounds.x * scaleX,
          y: bounds.y * scaleY,
          width: bounds.width * scaleX,
          height: bounds.height * scaleY,
        };
      },
      dispose(): void {
        bytes.fill(0);
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  } finally {
    if (!handedOff) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

async function openPdf(
  document: AdmittedDocument,
  limits: EffectiveOcrLimits,
  deadline: number,
  signal: AbortSignal | undefined,
): Promise<PDFDocumentProxy> {
  const loadingTask = getDocument({
    data: document.bytes.slice(),
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
    useWorkerFetch: false,
    stopAtErrors: true,
    maxImageSize: limits.pagePixels,
    canvasMaxAreaInBytes: limits.pagePixels * 4,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    useSystemFonts: false,
    enableXfa: false,
  });
  return runBounded(loadingTask.promise, deadline, signal, () => {
    void loadingTask.destroy();
  });
}

async function rasterizePdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  limits: EffectiveOcrLimits,
  deadline: number,
  signal: AbortSignal | undefined,
): Promise<RasterPage> {
  const pageOperation = pdf.getPage(pageNumber);
  const page = await runBounded(pageOperation, deadline, signal, () => {
    void pageOperation.then((latePage) => latePage.cleanup(), () => undefined);
  });
  let canvas: Canvas | null = null;
  let handedOff = false;
  try {
    const baseViewport = page.getViewport({ scale: 1 });
    const dimensions = boundedRasterDimensions(
      baseViewport.width,
      baseViewport.height,
      limits.rasterScale,
      limits,
    );
    if (!dimensions) throw new OcrResourceError("pdf-raster-dimensions");
    const viewport = page.getViewport({ scale: dimensions.scale });
    canvas = createCanvas(dimensions.width, dimensions.height);
    const renderTask = page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
      background: "rgb(255, 255, 255)",
    });
    await runBounded(renderTask.promise, deadline, signal, () => renderTask.cancel());
    const bytes = await runBounded(canvas.encode("png"), deadline, signal);
    const rasterHeight = dimensions.height;
    handedOff = true;
    return {
      page: pageNumber,
      bytes,
      width: dimensions.width,
      height: dimensions.height,
      pixels: dimensions.width * dimensions.height,
      pageDigest: sha256Hex(bytes),
      coordinateSpace: "pdf-points-bottom-left",
      toSourceBounds(bounds): BoundingBox {
        return {
          x: bounds.x / dimensions.scale,
          y: (rasterHeight - bounds.y - bounds.height) / dimensions.scale,
          width: bounds.width / dimensions.scale,
          height: bounds.height / dimensions.scale,
        };
      },
      dispose(): void {
        bytes.fill(0);
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      },
    };
  } finally {
    page.cleanup();
    if (!handedOff && canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

async function recognizeRaster(
  worker: OcrWorker,
  raster: RasterPage,
  sourceDigest: string,
  deadline: number,
  signal: AbortSignal | undefined,
): Promise<TextEvidence[]> {
  const recognition = worker.recognize(
    raster.bytes,
    { rotateAuto: true },
    { text: true, blocks: true, tsv: true },
    `ocr-page-${raster.page}`,
  );
  const result = await runBounded(recognition, deadline, signal, () => {
    void worker.terminate().catch(() => undefined);
  });
  const fromBlocks = tokensFromBlocks(result.data.blocks, raster, sourceDigest);
  return fromBlocks.length > 0
    ? fromBlocks
    : tokensFromTsv(result.data.tsv, raster, sourceDigest);
}

function controlIssue(error: OcrControlError): ParserIssue {
  return error.reason === "cancelled"
    ? issue(
        "cancelled",
        "ocr:cancelled",
        "Local OCR was cancelled. The worker was terminated, temporary raster memory was cleared, and no partial data was returned.",
      )
    : issue(
        "processing-timeout",
        "ocr:timeout",
        "Local OCR exceeded the configured processing-time limit. The worker was terminated, temporary raster memory was cleared, and no partial data was returned.",
      );
}

export const BUNDLED_OFFLINE_OCR_ADAPTER: TextExtractionAdapter = Object.freeze({
  id: ADAPTER_ID,
  supportedKinds: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  proof: {
    bundled: true,
    declared: true,
    declaredInPackage: "packages/slip-parser/assets/offline-ocr-runtime.json",
    artifactId:
      "tesseract.js+pdfjs-dist+@napi-rs/canvas+@tesseract.js-data/eng+@tesseract.js-data/fra",
    artifactVersion: `${TESSERACT_VERSION}+${PDFJS_VERSION}+${CANVAS_VERSION}+${LANGUAGE_DATA_VERSION}`,
    runtimeId: `node-offline:tesseract.js-core@${TESSERACT_CORE_VERSION}`,
    offline: true,
    networkAccess: "forbidden",
    telemetry: "none",
  },
  canExtract(document: AdmittedDocument): boolean {
    return this.supportedKinds.includes(document.kind);
  },
  async extract(
    document: AdmittedDocument,
    parserLimits: Readonly<ParserLimits>,
    context: Readonly<ExtractionContext> = {},
  ): Promise<AdapterExtractionResult> {
    const limits = effectiveLimits(parserLimits);
    if (!limits) {
      return {
        state: "rejected",
        issue: issue(
          "resource-limit",
          "ocr:invalid-limits",
          "The OCR limits must be finite positive values. No worker was started.",
        ),
      };
    }
    const reservation = reserveJob(document, limits);
    if ("code" in reservation) return { state: "rejected", issue: reservation };

    const deadline = Date.now() + limits.durationMs;
    let worker: OcrWorker | null = null;
    let pdf: PDFDocumentProxy | null = null;
    let languageModels: Awaited<ReturnType<typeof readLanguageModels>> | null = null;
    try {
      const languageOperation = readLanguageModels();
      languageModels = await runBounded(
        languageOperation,
        deadline,
        context.signal,
        () => {
          void languageOperation.then((lateModels) => lateModels.dispose(), () => undefined);
        },
      );
      const workerPath = requireFromPackage.resolve(
        "tesseract.js/src/worker-script/node/index.js",
      );
      const corePath = resolvePackageRoot("tesseract.js-core");
      const workerOperation = Tesseract.createWorker(
          languageModels.languages,
          Tesseract.OEM.LSTM_ONLY,
          {
            workerPath,
            corePath,
            cacheMethod: "none",
            gzip: true,
            legacyCore: false,
            legacyLang: false,
            logger: () => undefined,
            errorHandler: () => undefined,
          },
        );
      worker = await runBounded(
        workerOperation,
        deadline,
        context.signal,
        () => {
          void workerOperation.then(
            (lateWorker) => lateWorker.terminate(),
            () => undefined,
          );
        },
      );
      languageModels.dispose();
      languageModels = null;

      const tokens: TextEvidence[] = [];
      let totalPixels = 0;
      const recognize = async (raster: RasterPage): Promise<void> => {
        try {
          totalPixels += raster.pixels;
          if (totalPixels > limits.totalPixels) {
            throw new OcrResourceError("total-raster-pixels");
          }
          const pageTokens = await recognizeRaster(
            worker!,
            raster,
            document.sourceDigest,
            deadline,
            context.signal,
          );
          tokens.push(...pageTokens);
          const characterCount = tokens.reduce(
            (total, token) => total + token.text.length,
            0,
          );
          if (
            tokens.length > parserLimits.maxExtractedTokens ||
            characterCount > parserLimits.maxExtractedCharacters
          ) {
            throw new OcrResourceError("extracted-text");
          }
        } finally {
          raster.dispose();
        }
      };

      let pageCount = 1;
      if (document.kind === "application/pdf") {
        pdf = await openPdf(document, limits, deadline, context.signal);
        pageCount = pdf.numPages;
        if (pageCount < 1 || pageCount > limits.pages) {
          return {
            state: "rejected",
            issue: issue(
              "resource-limit",
              "ocr:pdf-page-limit",
              "The decoded PDF page count is missing or exceeds the configured OCR page limit.",
            ),
          };
        }
        if (
          document.pdf?.pageCount !== null &&
          document.pdf?.pageCount !== undefined &&
          document.pdf.pageCount !== pageCount
        ) {
          return {
            state: "rejected",
            issue: issue(
              "malformed-document",
              "ocr:pdf-page-count-mismatch",
              "The PDF structural page count conflicts with the bundled decoder result. No pages were accepted.",
            ),
          };
        }
        for (let page = 1; page <= pageCount; page += 1) {
          await recognize(
            await rasterizePdfPage(
              pdf,
              page,
              limits,
              deadline,
              context.signal,
            ),
          );
        }
      } else {
        await recognize(
          await rasterizeImage(document, limits, deadline, context.signal),
        );
      }

      const warnings: readonly ParserIssue[] = Object.freeze([
        {
          id: "ocr:manual-review-required",
          code: "low-confidence-field",
          severity: "warning",
          message:
            "OCR text, confidence, source geometry, and digest evidence are unverified suggestions. Every candidate must be compared with the source and explicitly confirmed before return entry.",
        },
      ]);
      const evidenceDigest = sha256Hex(
        stableJson({
          adapterId: ADAPTER_ID,
          sourceDigest: document.sourceDigest,
          pageCount,
          tokens,
          warnings,
        }),
      );
      return {
        state: "extracted",
        document: {
          pageCount,
          tokens: Object.freeze(tokens),
          warnings,
          evidenceDigest,
        },
      };
    } catch (error) {
      if (error instanceof OcrControlError) {
        return { state: "rejected", issue: controlIssue(error) };
      }
      if (error instanceof OcrResourceError) {
        return {
          state: "rejected",
          issue: issue(
            "resource-limit",
            `ocr:resource:${error.resource}`,
            "Local OCR exceeded a configured page, pixel, text, dimension, time, memory, or concurrency bound. No partial data was returned.",
          ),
        };
      }
      return {
        state: "rejected",
        issue: issue(
          "adapter-failed",
          "ocr:local-runtime-failed",
          "The bundled local OCR runtime could not decode or recognize this document within its resource bounds. No source content was logged and no partial data was returned.",
        ),
      };
    } finally {
      languageModels?.dispose();
      if (pdf) {
        try {
          await pdf.cleanup();
        } catch {
          // Cleanup is best-effort after all observable output has already been discarded.
        }
        try {
          await pdf.destroy();
        } catch {
          // Cleanup is best-effort after all observable output has already been discarded.
        }
      }
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // Termination is best-effort after all observable output has been discarded.
        }
      }
      releaseJob(reservation);
    }
  },
});

export const BUNDLED_OFFLINE_OCR_VERSIONS = Object.freeze({
  tesseractJs: TESSERACT_VERSION,
  tesseractCore: TESSERACT_CORE_VERSION,
  pdfJs: PDFJS_VERSION,
  canvas: CANVAS_VERSION,
  languageData: LANGUAGE_DATA_VERSION,
  languages: Object.freeze(["eng", "fra"] as const),
});
