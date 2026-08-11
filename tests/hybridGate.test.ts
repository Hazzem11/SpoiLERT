import { describe, expect, it } from "vitest";

import {
  buildClassifierInput,
  decideHybridGate,
  mlProbabilityToConfidence,
  shouldMaskFromMlProbability
} from "../src/shared/detector/hybridGate";
import type { DetectionResult } from "../src/shared/types";

function result(partial: Partial<DetectionResult>): DetectionResult {
  return {
    score: 0,
    threshold: 8,
    shouldMask: false,
    confidence: "low",
    reasons: [],
    ...partial
  };
}

describe("hybridGate", () => {
  it("marks obvious hits without ML", () => {
    const decision = decideHybridGate(
      result({
        score: 14,
        confidence: "high",
        reasons: [
          { kind: "explicit", pattern: "spoiler" },
          { kind: "title", matchedText: "attack on titan" }
        ]
      })
    );
    expect(decision).toBe("obviousHit");
  });

  it("marks strong title+intent as obvious hit", () => {
    const decision = decideHybridGate(
      result({
        score: 10,
        confidence: "high",
        reasons: [
          { kind: "ending", pattern: "who dies" },
          { kind: "title", matchedText: "dune" }
        ]
      })
    );
    expect(decision).toBe("obviousHit");
  });

  it("skips obvious misses", () => {
    expect(decideHybridGate(result({ score: 0, reasons: [] }))).toBe("obviousMiss");
  });

  it("routes borderline cases to ML", () => {
    const decision = decideHybridGate(
      result({
        score: 3,
        confidence: "low",
        reasons: [{ kind: "title", matchedText: "arcane" }]
      })
    );
    expect(decision).toBe("needsMl");
  });

  it("maps ML probability by sensitivity", () => {
    expect(shouldMaskFromMlProbability(0.5, "high")).toBe(true);
    expect(shouldMaskFromMlProbability(0.5, "medium")).toBe(false);
    expect(shouldMaskFromMlProbability(0.7, "medium")).toBe(true);
    expect(shouldMaskFromMlProbability(0.7, "low")).toBe(false);
    expect(shouldMaskFromMlProbability(0.8, "low")).toBe(true);
  });

  it("maps ML confidence bands", () => {
    expect(mlProbabilityToConfidence(0.9)).toBe("high");
    expect(mlProbabilityToConfidence(0.65)).toBe("medium");
    expect(mlProbabilityToConfidence(0.2)).toBe("low");
  });

  it("builds classifier input with watch titles", () => {
    expect(buildClassifierInput("ending explained", ["Arcane", "Dune"])).toBe(
      "Watching: Arcane, Dune. Search result: ending explained"
    );
    expect(buildClassifierInput("cast interview", [])).toBe("cast interview");
  });
});
