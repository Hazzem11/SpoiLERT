export type Sensitivity = "low" | "medium" | "high";

export interface WatchItem {
  id: string;
  title: string;
  type: "show" | "movie";
  aliases?: string[];
  progress?: {
    season?: number;
    episode?: number;
    watched?: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  enabled: boolean;
  sensitivity: Sensitivity;
  maskStyle: "blur" | "blackout";
  revealMode: "click" | "hover";
  guardAiOverview: boolean;
  guardRiskyQueries: boolean;
  guardAutocomplete: boolean;
  strictCharacterSpoilerMode: boolean;
  useMlClassifier: boolean;
}

export interface DetectionRulePack {
  version: string;
  explicitPatterns: string[];
  contextPatterns: string[];
  characterDeathPatterns: string[];
  endingPatterns: string[];
}

export interface SpoilerReason {
  kind: "explicit" | "characterDeath" | "ending" | "context" | "title" | "ml";
  pattern?: string;
  matchedText?: string;
  score?: number;
}

export interface DetectionResult {
  score: number;
  threshold: number;
  shouldMask: boolean;
  confidence: "low" | "medium" | "high";
  reasons: SpoilerReason[];
  mlProbability?: number;
  gate?: "obviousHit" | "obviousMiss" | "needsMl" | "heuristicFallback";
}
