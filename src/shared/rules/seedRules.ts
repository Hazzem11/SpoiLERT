import type { DetectionRulePack } from "../types";

export const seedRulePack: DetectionRulePack = {
  version: "1.0.0",
  explicitPatterns: ["\\bspoiler(s)?\\b", "\\bending explained\\b", "\\bfinale\\b"],
  contextPatterns: ["\\bplot twist\\b", "\\bwhat happens to\\b"],
  characterDeathPatterns: ["\\b(dies|death|killed|killer is)\\b"],
  endingPatterns: ["\\bwho (dies|wins|survives)\\b", "\\bpost[- ]credit scene\\b"]
};
