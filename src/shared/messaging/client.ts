import type {
  ClassifyBatchRequest,
  ClassifyBatchResponse,
  ClassifierStatus,
  ClassifierStatusRequest,
  ClassifierStatusResponse
} from "../messaging/classifier";

export async function requestClassifyBatch(texts: string[]): Promise<ClassifyBatchResponse> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return { ok: false, error: "Messaging unavailable" };
  }

  const request: ClassifyBatchRequest = { type: "CLASSIFY_BATCH", texts };
  try {
    return (await chrome.runtime.sendMessage(request)) as ClassifyBatchResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export async function requestClassifierStatus(): Promise<ClassifierStatus> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return { state: "unavailable", error: "Messaging unavailable" };
  }

  const request: ClassifierStatusRequest = { type: "CLASSIFIER_STATUS" };
  try {
    const response = (await chrome.runtime.sendMessage(request)) as ClassifierStatusResponse | undefined;
    if (!response?.status) {
      return {
        state: "unavailable",
        error: "Background worker did not respond. Reload the extension on chrome://extensions."
      };
    }
    return response.status;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Receiving end does not exist")) {
      return {
        state: "error",
        error: "Background worker not running. Reload SpoilERT on chrome://extensions."
      };
    }
    return { state: "error", error: message };
  }
}
