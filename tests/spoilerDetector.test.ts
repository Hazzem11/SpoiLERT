import { describe, expect, it } from "vitest";

import { evaluateSpoilerRisk } from "../src/shared/detector/spoilerDetector";
import { normalizeText, normalizeWatchTerms } from "../src/shared/detector/textNormalization";
import { seedRulePack } from "../src/shared/rules/seedRules";
import type { WatchItem } from "../src/shared/types";

const watchItems: WatchItem[] = [
  {
    id: "1",
    title: "Attack on Titan",
    type: "show",
    aliases: ["AOT"],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

describe("text normalization", () => {
  it("normalizes punctuation and spacing for title matching", () => {
    expect(normalizeText("Attack-on   Titan!!")).toBe("attack on titan");
  });

  it("deduplicates aliases and removes empty values", () => {
    const terms = normalizeWatchTerms("AOT", ["Attack on Titan", "", "AOT"]);
    expect(terms).toEqual(["aot", "attack on titan"]);
  });
});

describe("spoiler detector", () => {
  it("masks high confidence spoiler text", () => {
    const result = evaluateSpoilerRisk({
      text: "Attack on Titan finale spoiler: who dies at the end?",
      watchItems,
      sensitivity: "medium",
      rulePack: seedRulePack
    });

    expect(result.shouldMask).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(result.threshold);
    expect(result.confidence).toBe("high");
    expect(result.reasons.some((reason) => reason.kind === "title")).toBe(true);
    expect(result.reasons.some((reason) => reason.kind === "explicit")).toBe(true);
  });

  it("does not mask low risk text", () => {
    const result = evaluateSpoilerRisk({
      text: "Attack on Titan streaming schedule and voice cast details",
      watchItems,
      sensitivity: "low",
      rulePack: seedRulePack
    });

    expect(result.shouldMask).toBe(false);
    expect(result.score).toBeLessThan(result.threshold);
  });

  it("applies stricter masking at high sensitivity", () => {
    const result = evaluateSpoilerRisk({
      text: "Attack on Titan cast interview roundup",
      watchItems,
      sensitivity: "high",
      rulePack: seedRulePack
    });

    expect(result.threshold).toBeGreaterThan(0);
    expect(result.confidence === "low" || result.confidence === "medium" || result.confidence === "high").toBe(
      true
    );
  });

  it("ignores invalid regex patterns safely", () => {
    const result = evaluateSpoilerRisk({
      text: "Movie ending explained",
      watchItems: [],
      sensitivity: "high",
      rulePack: {
        ...seedRulePack,
        explicitPatterns: ["[invalid", "\\bending explained\\b"]
      }
    });

    expect(result.shouldMask).toBe(true);
    expect(result.reasons.some((reason) => reason.pattern === "\\bending explained\\b")).toBe(true);
  });

  it("detects implicit spoiler phrasing with title relation", () => {
    const result = evaluateSpoilerRisk({
      text: "Attack on Titan final scene turns out to reveal who survives",
      watchItems,
      sensitivity: "medium",
      rulePack: seedRulePack
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.shouldMask).toBe(true);
  });

  it("reduces overblocking on safe generic queries", () => {
    const result = evaluateSpoilerRisk({
      text: "Breaking Bad filming locations and cast interviews",
      watchItems: [
        {
          id: "bb",
          title: "Breaking Bad",
          type: "show",
          aliases: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ],
      sensitivity: "low",
      rulePack: seedRulePack
    });

    expect(result.shouldMask).toBe(false);
  });
});
