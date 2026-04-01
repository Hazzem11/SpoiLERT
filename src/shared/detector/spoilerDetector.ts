import type {
  DetectionResult,
  DetectionRulePack,
  Sensitivity,
  SpoilerReason,
  WatchItem
} from "../types";
import { normalizeText, normalizeWatchTerms } from "./textNormalization";

const SCORE_WEIGHTS = {
  explicitIntent: 5,
  endingIntent: 4,
  deathIntent: 4,
  implicitIntent: 2,
  titleMatch: 3,
  titleNearIntent: 3,
  strictCharacterBoost: 2,
  contextHint: 1
} as const;

const MASK_THRESHOLDS: Record<Sensitivity, number> = {
  low: 11,
  medium: 8,
  high: 5
};

const IMPLICIT_INTENT_PATTERNS = [
  /\bfinds out\b/i,
  /\bturns out\b/i,
  /\bfinal scene\b/i,
  /\bfinal moment\b/i,
  /\bwhat happened to\b/i,
  /\brevealed\b/i,
  /\bbetray(s|al)?\b/i,
  /\btrue identity\b/i
] as const;

const CONTEXT_HINT_PATTERNS = [/\btheory\b/i, /\bexplained\b/i, /\banalysis\b/i] as const;

const INTENT_TOKENS = new Set([
  "ending",
  "death",
  "dies",
  "killed",
  "killer",
  "twist",
  "spoiler",
  "finale",
  "explained",
  "leak",
  "survives",
  "wins",
  "betrayal",
  "revealed"
]);

const STOPWORD_TOKENS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "what",
  "when",
  "where",
  "about",
  "scene",
  "episode",
  "season"
]);

function collectReasons(
  text: string,
  regexes: RegExp[],
  kind: SpoilerReason["kind"]
): SpoilerReason[] {
  return regexes
    .filter((regex) => regex.test(text))
    .map((regex) => ({
      kind,
      pattern: regex.source
    }));
}

function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.reduce<RegExp[]>((acc, pattern) => {
    try {
      acc.push(new RegExp(pattern, "i"));
    } catch {
      // Invalid pattern entries are ignored to keep detection fail-safe.
    }
    return acc;
  }, []);
}

function tokenize(input: string): string[] {
  return input.split(" ").filter((token) => token.length > 0);
}

interface TitleMatch {
  watchItemId: string;
  term: string;
  tokenIndex: number;
}

function findTitleMatches(normalizedText: string, tokens: string[], watchItems: WatchItem[]): TitleMatch[] {
  const matches: TitleMatch[] = [];

  for (const watchItem of watchItems) {
    const terms = normalizeWatchTerms(watchItem.title, watchItem.aliases ?? []);
    for (const term of terms) {
      const tokenIndex = findSubsequenceIndex(tokens, tokenize(term));
      if (tokenIndex >= 0 || normalizedText.includes(term)) {
        matches.push({
          watchItemId: watchItem.id,
          term,
          tokenIndex: Math.max(tokenIndex, 0)
        });
      }
    }
  }

  return matches;
}

function findSubsequenceIndex(tokens: string[], phraseTokens: string[]): number {
  if (phraseTokens.length === 0 || phraseTokens.length > tokens.length) {
    return -1;
  }
  for (let i = 0; i <= tokens.length - phraseTokens.length; i += 1) {
    const isMatch = phraseTokens.every((token, offset) => tokens[i + offset] === token);
    if (isMatch) {
      return i;
    }
  }
  return -1;
}

function detectTitleReasons(titleMatches: TitleMatch[]): SpoilerReason[] {
  const reasons: SpoilerReason[] = [];

  for (const titleMatch of titleMatches) {
    reasons.push({
      kind: "title",
      matchedText: titleMatch.term
    });
  }

  return reasons;
}

export function evaluateSpoilerRisk(params: {
  text: string;
  watchItems: WatchItem[];
  sensitivity: Sensitivity;
  rulePack: DetectionRulePack;
  strictCharacterSpoilerMode?: boolean;
}): DetectionResult {
  const normalizedText = normalizeText(params.text);
  const tokens = tokenize(normalizedText);
  const strictCharacterSpoilerMode = params.strictCharacterSpoilerMode ?? true;

  const explicitReasons = collectReasons(
    normalizedText,
    compilePatterns(params.rulePack.explicitPatterns),
    "explicit"
  );
  const endingReasons = collectReasons(
    normalizedText,
    compilePatterns(params.rulePack.endingPatterns),
    "ending"
  );
  const characterDeathReasons = collectReasons(
    normalizedText,
    compilePatterns(params.rulePack.characterDeathPatterns),
    "characterDeath"
  );
  const contextReasons = collectReasons(
    normalizedText,
    compilePatterns(params.rulePack.contextPatterns),
    "context"
  );
  const implicitIntentReasons = collectReasons(
    normalizedText,
    [...IMPLICIT_INTENT_PATTERNS],
    "context"
  );
  const hintReasons = collectReasons(normalizedText, [...CONTEXT_HINT_PATTERNS], "context");

  const titleMatches = findTitleMatches(normalizedText, tokens, params.watchItems);
  const titleReasons = detectTitleReasons(titleMatches);

  const intentTokenPositions = tokens
    .map((token, index) => (INTENT_TOKENS.has(token) ? index : -1))
    .filter((index) => index >= 0);

  const hasTitleNearIntent =
    titleMatches.length > 0 &&
    intentTokenPositions.some((intentIndex) =>
      titleMatches.some((titleMatch) => Math.abs(titleMatch.tokenIndex - intentIndex) <= 5)
    );

  const hasStrictCharacterPattern =
    strictCharacterSpoilerMode &&
    titleMatches.length > 0 &&
    intentTokenPositions.length > 0 &&
    tokens.some(
      (token) =>
        token.length >= 4 &&
        !INTENT_TOKENS.has(token) &&
        !STOPWORD_TOKENS.has(token) &&
        !titleMatches.some((titleMatch) => titleMatch.term.includes(token))
    );

  const score =
    explicitReasons.length * SCORE_WEIGHTS.explicitIntent +
    endingReasons.length * SCORE_WEIGHTS.endingIntent +
    characterDeathReasons.length * SCORE_WEIGHTS.deathIntent +
    implicitIntentReasons.length * SCORE_WEIGHTS.implicitIntent +
    titleReasons.length * SCORE_WEIGHTS.titleMatch +
    (hasTitleNearIntent ? SCORE_WEIGHTS.titleNearIntent : 0) +
    (hasStrictCharacterPattern ? SCORE_WEIGHTS.strictCharacterBoost : 0) +
    hintReasons.length * SCORE_WEIGHTS.contextHint +
    contextReasons.length * SCORE_WEIGHTS.contextHint;

  const threshold = MASK_THRESHOLDS[params.sensitivity];
  const reasons = [
    ...explicitReasons,
    ...endingReasons,
    ...characterDeathReasons,
    ...titleReasons,
    ...implicitIntentReasons,
    ...hintReasons,
    ...contextReasons
  ];
  const confidence: DetectionResult["confidence"] =
    score >= 12 ? "high" : score >= 7 ? "medium" : "low";

  return {
    score,
    threshold,
    shouldMask: score >= threshold,
    confidence,
    reasons
  };
}
