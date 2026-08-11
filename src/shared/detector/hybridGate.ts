import type { DetectionResult, Sensitivity } from "../types";

export type HybridGateDecision = "obviousHit" | "obviousMiss" | "needsMl";

const OBVIOUS_HIT_SCORE = 12;

const INTENT_REASON_KINDS = new Set(["explicit", "ending", "characterDeath"]);

export function decideHybridGate(result: DetectionResult): HybridGateDecision {
  const hasTitle = result.reasons.some((reason) => reason.kind === "title");
  const hasStrongIntent = result.reasons.some((reason) => INTENT_REASON_KINDS.has(reason.kind));

  if (
    result.confidence === "high" &&
    (result.score >= OBVIOUS_HIT_SCORE || (hasStrongIntent && hasTitle))
  ) {
    return "obviousHit";
  }

  if (result.score === 0 && !hasTitle) {
    return "obviousMiss";
  }

  return "needsMl";
}

export const ML_MASK_THRESHOLDS: Record<Sensitivity, number> = {
  high: 0.45,
  medium: 0.6,
  low: 0.75
};

export function mlProbabilityToConfidence(probability: number): DetectionResult["confidence"] {
  if (probability >= 0.8) {
    return "high";
  }
  if (probability >= 0.6) {
    return "medium";
  }
  return "low";
}

export function shouldMaskFromMlProbability(
  probability: number,
  sensitivity: Sensitivity
): boolean {
  return probability >= ML_MASK_THRESHOLDS[sensitivity];
}

export function buildClassifierInput(text: string, watchTitles: string[]): string {
  const titles = watchTitles.map((title) => title.trim()).filter((title) => title.length > 0);
  if (titles.length === 0) {
    return text;
  }
  return `Watching: ${titles.join(", ")}. Search result: ${text}`;
}
