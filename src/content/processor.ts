import { evaluateSpoilerRisk } from "../shared/detector/spoilerDetector";
import {
  buildClassifierInput,
  decideHybridGate,
  ML_MASK_THRESHOLDS,
  mlProbabilityToConfidence,
  shouldMaskFromMlProbability
} from "../shared/detector/hybridGate";
import { hasSpoilerIntent } from "../shared/detector/queryRisk";
import { ML_MODEL_VERSION } from "../shared/messaging/classifier";
import { requestClassifyBatch } from "../shared/messaging/client";
import type { DetectionResult } from "../shared/types";
import {
  GOOGLE_AI_OVERVIEW_SELECTORS,
  GOOGLE_AUTOCOMPLETE_SELECTORS,
  GOOGLE_AUTOCOMPLETE_ROW_SELECTORS,
  GOOGLE_RESULT_SELECTORS,
  OVERLAY_CLASS,
  SPOILERT_ATTR_STATE
} from "./constants";
import { applyMask, clearMask } from "./masking";
import type { ContentRuntimeConfig } from "./types";

const MIN_TEXT_LENGTH = 12;
const MAX_TEXT_LENGTH = 400;
const MAX_CANDIDATES_PER_PASS = 250;

type CandidateKind = "result" | "aiOverview" | "autocomplete";

interface CandidateElement {
  element: HTMLElement;
  kind: CandidateKind;
}

interface PendingCandidate {
  element: HTMLElement;
  kind: CandidateKind;
  scopedText: string;
  heuristic: DetectionResult;
}

export class ContentProcessor {
  private readonly lastSignatures = new WeakMap<HTMLElement, string>();
  private config: ContentRuntimeConfig;

  public constructor(config: ContentRuntimeConfig) {
    this.config = config;
  }

  public updateConfig(config: ContentRuntimeConfig): void {
    this.config = config;
  }

  public async processRoot(root: ParentNode): Promise<void> {
    const candidates = collectCandidateElements(root).slice(0, MAX_CANDIDATES_PER_PASS);
    const pendingMl: PendingCandidate[] = [];

    for (const candidate of candidates) {
      const prepared = this.prepareCandidate(candidate.element, candidate.kind);
      if (!prepared) {
        continue;
      }
      if (prepared.action === "queueMl") {
        pendingMl.push(prepared.pending);
        continue;
      }
      this.applyDecision(prepared.pending.element, prepared.pending.kind, prepared.result, prepared.pending.scopedText);
    }

    if (pendingMl.length === 0) {
      return;
    }

    const watchTitles = this.config.watchItems.map((item) => item.title);
    const texts = pendingMl.map((item) => buildClassifierInput(item.scopedText, watchTitles));
    const response = await requestClassifyBatch(texts);

    for (let index = 0; index < pendingMl.length; index += 1) {
      const pending = pendingMl[index]!;
      let result: DetectionResult;
      const mlResult = response.results?.[index];

      if (!response.ok || !mlResult) {
        result = {
          ...pending.heuristic,
          gate: "heuristicFallback"
        };
      } else {
        const probability = mlResult.score;
        const threshold = ML_MASK_THRESHOLDS[this.config.sensitivity];
        result = {
          score: probability,
          threshold,
          shouldMask: shouldMaskFromMlProbability(probability, this.config.sensitivity),
          confidence: mlProbabilityToConfidence(probability),
          reasons: [
            ...pending.heuristic.reasons,
            {
              kind: "ml",
              matchedText: mlResult.label,
              score: probability
            }
          ],
          mlProbability: probability,
          gate: "needsMl"
        };
      }

      this.applyDecision(pending.element, pending.kind, result, pending.scopedText);
    }
  }

  public async processElement(element: HTMLElement, kind: CandidateKind = "result"): Promise<void> {
    await this.processRoot(element);
    void kind;
  }

  private prepareCandidate(
    element: HTMLElement,
    kind: CandidateKind
  ):
    | { action: "done"; pending: PendingCandidate; result: DetectionResult }
    | { action: "queueMl"; pending: PendingCandidate }
    | null {
    if (!this.isGuardEnabledForKind(kind)) {
      clearMask(element);
      return null;
    }
    if (isIgnoredElement(element)) {
      return null;
    }

    const text = (element.innerText || element.textContent || "").trim();
    if (text.length < MIN_TEXT_LENGTH) {
      return null;
    }
    const scopedText = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

    const signature = this.buildSignature(scopedText);
    if (this.lastSignatures.get(element) === signature) {
      return null;
    }
    this.lastSignatures.set(element, signature);

    if (!this.config.enabled) {
      clearMask(element);
      return null;
    }

    const heuristic = evaluateSpoilerRisk({
      text: scopedText,
      sensitivity: this.config.sensitivity,
      watchItems: this.config.watchItems,
      rulePack: this.config.rulePack,
      strictCharacterSpoilerMode: this.config.strictCharacterSpoilerMode
    });

    const pending: PendingCandidate = { element, kind, scopedText, heuristic };
    const gate = decideHybridGate(heuristic);

    if (gate === "obviousHit") {
      return {
        action: "done",
        pending,
        result: { ...heuristic, shouldMask: true, gate: "obviousHit" }
      };
    }

    if (gate === "obviousMiss") {
      return {
        action: "done",
        pending,
        result: { ...heuristic, shouldMask: false, gate: "obviousMiss" }
      };
    }

    if (!this.config.useMlClassifier) {
      return {
        action: "done",
        pending,
        result: { ...heuristic, gate: "heuristicFallback" }
      };
    }

    return { action: "queueMl", pending };
  }

  private applyDecision(
    element: HTMLElement,
    kind: CandidateKind,
    result: DetectionResult,
    scopedText: string
  ): void {
    const contextualRisk =
      this.config.currentQueryRisky && (kind === "aiOverview" || kind === "autocomplete");
    const shouldMaskByContext = contextualRisk && hasSpoilerIntent(scopedText);

    if (result.shouldMask || shouldMaskByContext) {
      if (kind === "autocomplete") {
        if (this.shouldRemoveAutocompleteByConfidence(result.confidence)) {
          this.removeAutocompleteSuggestion(element);
        }
        return;
      }
      const label = "Potential spoiler hidden";
      const score = shouldMaskByContext ? Math.max(result.score, 1) : result.score;
      applyMask(element, score, label);
      return;
    }

    if (element.getAttribute(SPOILERT_ATTR_STATE) === "masked") {
      clearMask(element);
    }
  }

  private buildSignature(text: string): string {
    const watchTitles = this.config.watchItems.map((item) => item.title.toLowerCase()).sort().join("|");
    return `${this.config.enabled}:${this.config.sensitivity}:${this.config.guardAiOverview}:${this.config.guardAutocomplete}:${this.config.strictCharacterSpoilerMode}:${this.config.useMlClassifier}:${ML_MODEL_VERSION}:${this.config.currentQueryRisky}:${this.config.currentQuery}:${this.config.rulePack.version}:${watchTitles}:${text}`;
  }

  private isGuardEnabledForKind(kind: CandidateKind): boolean {
    if (kind === "aiOverview") {
      return this.config.guardAiOverview;
    }
    if (kind === "autocomplete") {
      return this.config.guardAutocomplete;
    }
    return true;
  }

  private shouldRemoveAutocompleteByConfidence(confidence: "low" | "medium" | "high"): boolean {
    if (this.config.sensitivity === "high") {
      return confidence === "low" || confidence === "medium" || confidence === "high";
    }
    if (this.config.sensitivity === "medium") {
      return confidence === "medium" || confidence === "high";
    }
    return confidence === "high";
  }

  private removeAutocompleteSuggestion(element: HTMLElement): void {
    const row = resolveAutocompleteRow(element);
    if (!row) {
      return;
    }
    row.remove();
  }
}

export function collectCandidateElements(root: ParentNode): CandidateElement[] {
  const uniqueElements = new Map<HTMLElement, CandidateKind>();

  collectByKind(root, GOOGLE_AI_OVERVIEW_SELECTORS, "aiOverview", uniqueElements);
  collectAiOverviewByHeuristic(root, uniqueElements);
  collectByKind(root, GOOGLE_AUTOCOMPLETE_SELECTORS, "autocomplete", uniqueElements);
  collectByKind(root, GOOGLE_RESULT_SELECTORS, "result", uniqueElements);

  return Array.from(uniqueElements.entries()).map(([element, kind]) => ({
    element,
    kind
  }));
}

function collectAiOverviewByHeuristic(
  root: ParentNode,
  output: Map<HTMLElement, CandidateKind>
): void {
  const nodes =
    root instanceof HTMLElement || root instanceof Document || root instanceof DocumentFragment
      ? root.querySelectorAll("h2, h3, div, span")
      : [];

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    const text = (node.textContent || "").trim().toLowerCase();
    if (text !== "ai overview") {
      continue;
    }
    const section =
      node.closest("#search .MjjYud, #search [data-hveid], #search .kno-aoc, #search div") ?? node.parentElement;
    if (!(section instanceof HTMLElement)) {
      continue;
    }
    const candidates = section.querySelectorAll(".wDYxhc, .LGOjhe, .IZ6rdc, p, li, span");
    if (candidates.length === 0) {
      output.set(section, "aiOverview");
      continue;
    }
    for (const item of candidates) {
      if (item instanceof HTMLElement && !output.has(item)) {
        output.set(item, "aiOverview");
      }
    }
  }
}

function collectByKind(
  root: ParentNode,
  selectors: readonly string[],
  kind: CandidateKind,
  output: Map<HTMLElement, CandidateKind>
): void {
  if (root instanceof HTMLElement && matchesAnySelector(root, selectors)) {
    output.set(root, kind);
  }

  for (const selector of selectors) {
    const matched = root.querySelectorAll(selector);
    for (const item of matched) {
      if (!(item instanceof HTMLElement)) {
        continue;
      }
      if (item.closest(`.${OVERLAY_CLASS}`)) {
        continue;
      }
      if (!output.has(item)) {
        output.set(item, kind);
      }
    }
  }
}

function matchesAnySelector(element: HTMLElement, selectors: readonly string[]): boolean {
  return selectors.some((selector) => element.matches(selector));
}

function isIgnoredElement(element: HTMLElement): boolean {
  if (element.closest(`.${OVERLAY_CLASS}`)) {
    return true;
  }
  if (element.closest("input, textarea, [contenteditable='true']")) {
    return true;
  }
  if (element.tagName === "SCRIPT" || element.tagName === "STYLE") {
    return true;
  }
  return false;
}

function resolveAutocompleteRow(element: HTMLElement): HTMLElement | null {
  for (const selector of GOOGLE_AUTOCOMPLETE_ROW_SELECTORS) {
    const matched = element.closest(selector);
    if (matched instanceof HTMLElement) {
      return matched;
    }
  }
  return element;
}
