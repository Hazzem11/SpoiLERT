import { evaluateSpoilerRisk } from "../shared/detector/spoilerDetector";
import { hasSpoilerIntent } from "../shared/detector/queryRisk";
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

export class ContentProcessor {
  private readonly lastSignatures = new WeakMap<HTMLElement, string>();
  private config: ContentRuntimeConfig;

  public constructor(config: ContentRuntimeConfig) {
    this.config = config;
  }

  public updateConfig(config: ContentRuntimeConfig): void {
    this.config = config;
  }

  public processRoot(root: ParentNode): void {
    const candidates = collectCandidateElements(root);
    for (const candidate of candidates.slice(0, MAX_CANDIDATES_PER_PASS)) {
      this.processElement(candidate.element, candidate.kind);
    }
  }

  public processElement(element: HTMLElement, kind: CandidateKind = "result"): void {
    if (!this.isGuardEnabledForKind(kind)) {
      clearMask(element);
      return;
    }
    if (isIgnoredElement(element)) {
      return;
    }

    const text = (element.innerText || element.textContent || "").trim();
    if (text.length < MIN_TEXT_LENGTH) {
      return;
    }
    const scopedText = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

    const signature = this.buildSignature(scopedText);
    if (this.lastSignatures.get(element) === signature) {
      return;
    }
    this.lastSignatures.set(element, signature);

    if (!this.config.enabled) {
      clearMask(element);
      return;
    }

    const result = evaluateSpoilerRisk({
      text: scopedText,
      sensitivity: this.config.sensitivity,
      watchItems: this.config.watchItems,
      rulePack: this.config.rulePack,
      strictCharacterSpoilerMode: this.config.strictCharacterSpoilerMode
    });
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
    return `${this.config.enabled}:${this.config.sensitivity}:${this.config.guardAiOverview}:${this.config.guardAutocomplete}:${this.config.strictCharacterSpoilerMode}:${this.config.currentQueryRisky}:${this.config.currentQuery}:${this.config.rulePack.version}:${watchTitles}:${text}`;
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
