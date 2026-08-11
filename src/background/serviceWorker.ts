import type {
  BackgroundRequest,
  ClassifyBatchResponse,
  ClassifierStatus,
  ClassifierStatusResponse
} from "../shared/messaging/classifier";
import { ML_MODEL_VERSION } from "../shared/messaging/classifier";

const OFFSCREEN_PATH = "src/offscreen/offscreen.html";

let creatingOffscreen: Promise<void> | null = null;
let cachedStatus: ClassifierStatus = { state: "idle", version: ML_MODEL_VERSION };

async function hasOffscreenDocument(): Promise<boolean> {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
    });
    return contexts.length > 0;
  }
  // Older Chrome fallback.
  const offscreen = chrome.offscreen as typeof chrome.offscreen & {
    hasDocument?: () => Promise<boolean>;
  };
  if (typeof offscreen.hasDocument === "function") {
    return offscreen.hasDocument();
  }
  return false;
}

async function setupOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return;
  }
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: "Run on-device spoiler classifier with Transformers.js"
  });
  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function sendToOffscreen<T>(message: Record<string, unknown>): Promise<T> {
  await setupOffscreenDocument();
  return (await chrome.runtime.sendMessage({
    ...message,
    target: "offscreen"
  })) as T;
}

chrome.runtime.onInstalled.addListener(() => {
  console.info("SpoilERT installed.");
});

chrome.runtime.onMessage.addListener((message: BackgroundRequest | { target?: string }, _sender, sendResponse) => {
  // Ignore messages meant for the offscreen document (they share the bus).
  if (message && typeof message === "object" && "target" in message && message.target === "offscreen") {
    return false;
  }

  if (!message || typeof message !== "object" || !("type" in message)) {
    return false;
  }

  if (message.type === "CLASSIFIER_STATUS") {
    void (async () => {
      try {
        const response = await sendToOffscreen<ClassifierStatusResponse>({
          type: "CLASSIFIER_STATUS",
          target: "offscreen"
        });
        cachedStatus = response.status;
        sendResponse(response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        cachedStatus = {
          state: "error",
          version: ML_MODEL_VERSION,
          error: errorMessage
        };
        sendResponse({ status: cachedStatus } satisfies ClassifierStatusResponse);
      }
    })();
    return true;
  }

  if (message.type === "CLASSIFY_BATCH") {
    void (async () => {
      try {
        const response = await sendToOffscreen<ClassifyBatchResponse>({
          type: "CLASSIFY_BATCH",
          target: "offscreen",
          texts: message.texts
        });
        if (response.status) {
          cachedStatus = response.status;
        }
        sendResponse(response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        cachedStatus = {
          state: "error",
          version: ML_MODEL_VERSION,
          error: errorMessage
        };
        sendResponse({
          ok: false,
          error: errorMessage,
          status: cachedStatus
        } satisfies ClassifyBatchResponse);
      }
    })();
    return true;
  }

  return false;
});
