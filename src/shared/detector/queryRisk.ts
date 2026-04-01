import { seedRulePack } from "../rules/seedRules";
import { evaluateSpoilerRisk } from "./spoilerDetector";
import { normalizeText, normalizeWatchTerms } from "./textNormalization";
import type { WatchItem } from "../types";

const SPOILER_INTENT_REGEX =
  /\b(ending|death|dies|killed|killer|twist|spoiler|finale|explained|leak|post credit|post-credit|who dies|what happens)\b/i;

export interface QueryRiskResult {
  isRisky: boolean;
  score: number;
  confidence: "low" | "medium" | "high";
  matchedTitle?: string;
  matchedIntent?: string;
  reason?: "tracked-title" | "explicit-spoiler-query";
}

export function hasSpoilerIntent(text: string): boolean {
  return SPOILER_INTENT_REGEX.test(normalizeText(text));
}

export function evaluateQueryRisk(query: string, watchItems: WatchItem[]): QueryRiskResult {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return { isRisky: false, score: 0, confidence: "low" };
  }

  const detectorResult = evaluateSpoilerRisk({
    text: query,
    watchItems,
    sensitivity: "medium",
    rulePack: seedRulePack,
    strictCharacterSpoilerMode: true
  });

  const intentMatch = normalizedQuery.match(SPOILER_INTENT_REGEX);
  if (!intentMatch) {
    return {
      isRisky: detectorResult.confidence === "high",
      score: detectorResult.score,
      confidence: detectorResult.confidence
    };
  }

  for (const item of watchItems) {
    const terms = normalizeWatchTerms(item.title, item.aliases ?? []);
    const matched = terms.find((term) => normalizedQuery.includes(term));
    if (matched) {
      return {
        isRisky: true,
        score: detectorResult.score,
        confidence: detectorResult.confidence,
        matchedTitle: matched,
        matchedIntent: intentMatch[0],
        reason: "tracked-title"
      };
    }
  }

  // Fallback: still warn on clearly spoiler-focused queries even
  // when the title is not in watchlist yet.
  if (normalizedQuery.split(" ").length >= 2) {
    return {
      isRisky: true,
      score: detectorResult.score,
      confidence: detectorResult.confidence,
      matchedIntent: intentMatch[0],
      reason: "explicit-spoiler-query"
    };
  }

  return {
    isRisky: false,
    score: detectorResult.score,
    confidence: detectorResult.confidence
  };
}
