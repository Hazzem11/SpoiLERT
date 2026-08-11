import { env, pipeline, type TextClassificationPipeline } from "@huggingface/transformers";

import {
  ML_MODEL_VERSION,
  type ClassifyBatchResponse,
  type ClassifierStatus,
  type ClassifierStatusResponse
} from "../shared/messaging/classifier";

type SpoilerPipeline = TextClassificationPipeline;

interface ClassificationCandidate {
  label?: string;
  score?: number;
}

let classifierPromise: Promise<SpoilerPipeline | null> | null = null;
let status: ClassifierStatus = { state: "idle", version: ML_MODEL_VERSION };

function setStatus(next: ClassifierStatus): void {
  status = { ...next, version: next.version ?? ML_MODEL_VERSION };
}

function getModelPath(): string {
  return chrome.runtime.getURL("models/spoiler-classifier/");
}

async function createClassifier(): Promise<SpoilerPipeline | null> {
  setStatus({ state: "loading" });
  try {
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.useBrowserCache = true;
    const wasm = env.backends.onnx?.wasm;
    if (wasm) {
      wasm.numThreads = 1;
      wasm.proxy = false;
      const wasmBase = chrome.runtime.getURL("wasm/");
      // Provide explicit loader + binary URLs so ORT does not guess CDN paths.
      wasm.wasmPaths = {
        mjs: `${wasmBase}ort-wasm-simd-threaded.asyncify.mjs`,
        wasm: `${wasmBase}ort-wasm-simd-threaded.asyncify.wasm`
      };
    }

    const modelPath = getModelPath();
    const probe = await fetch(`${modelPath}config.json`);
    if (!probe.ok) {
      setStatus({
        state: "unavailable",
        error: "Model files are not packaged. Run ml/scripts/export_onnx.py."
      });
      return null;
    }

    const classifier = (await pipeline("text-classification", modelPath, {
      dtype: "q8"
    })) as SpoilerPipeline;

    setStatus({ state: "ready" });
    return classifier;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus({ state: "error", error: message });
    classifierPromise = null;
    console.warn("SpoilERT classifier failed to load:", message);
    return null;
  }
}

function getClassifier(): Promise<SpoilerPipeline | null> {
  if (!classifierPromise) {
    classifierPromise = createClassifier();
  }
  return classifierPromise;
}

function normalizeLabel(label: string): "spoiler" | "safe" {
  const normalized = label.toLowerCase();
  if (normalized.includes("spoiler") || normalized === "label_1" || normalized === "1") {
    return "spoiler";
  }
  return "safe";
}

function extractSpoilerScore(row: ClassificationCandidate | ClassificationCandidate[]): {
  label: "spoiler" | "safe";
  score: number;
} {
  const candidates = Array.isArray(row) ? row : [row];
  const spoiler = candidates.find((item) => normalizeLabel(String(item.label ?? "")) === "spoiler");
  if (spoiler) {
    const score = Number(spoiler.score ?? 0);
    return {
      label: score >= 0.5 ? "spoiler" : "safe",
      score
    };
  }

  const top = candidates[0];
  const topLabel = normalizeLabel(String(top?.label ?? "safe"));
  const topScore = Number(top?.score ?? 0);
  if (topLabel === "spoiler") {
    return { label: "spoiler", score: topScore };
  }
  return { label: "safe", score: Math.max(0, 1 - topScore) };
}

async function classifyBatch(texts: string[]): Promise<ClassifyBatchResponse> {
  if (texts.length === 0) {
    return { ok: true, results: [], status };
  }

  const classifier = await getClassifier();
  if (!classifier) {
    return { ok: false, error: status.error ?? "Classifier unavailable", status };
  }

  try {
    const outputs = await classifier(texts, { top_k: 2 });
    const rows = (Array.isArray(outputs) ? outputs : [outputs]) as Array<
      ClassificationCandidate | ClassificationCandidate[]
    >;
    const results = rows.map((row) => extractSpoilerScore(row));
    return { ok: true, results, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus({ state: "error", error: message });
    classifierPromise = null;
    return { ok: false, error: message, status };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object" || message.target !== "offscreen") {
    return false;
  }

  if (message.type === "CLASSIFIER_STATUS") {
    void getClassifier().finally(() => {
      const response: ClassifierStatusResponse = { status };
      sendResponse(response);
    });
    return true;
  }

  if (message.type === "CLASSIFY_BATCH" && Array.isArray(message.texts)) {
    void classifyBatch(message.texts as string[]).then((response) => sendResponse(response));
    return true;
  }

  return false;
});

console.info("SpoilERT offscreen classifier ready.");
