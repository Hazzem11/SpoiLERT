export const ML_MODEL_VERSION = "1.0.0";

export type ClassifierStatusState = "idle" | "loading" | "ready" | "unavailable" | "error";

export interface ClassifierStatus {
  state: ClassifierStatusState;
  version?: string;
  error?: string;
}

export interface ClassifyBatchRequest {
  type: "CLASSIFY_BATCH";
  texts: string[];
}

export interface ClassifyBatchResponse {
  ok: boolean;
  results?: Array<{ label: "spoiler" | "safe"; score: number }>;
  error?: string;
  status?: ClassifierStatus;
}

export interface ClassifierStatusRequest {
  type: "CLASSIFIER_STATUS";
}

export interface ClassifierStatusResponse {
  status: ClassifierStatus;
}

export type BackgroundRequest = ClassifyBatchRequest | ClassifierStatusRequest;
