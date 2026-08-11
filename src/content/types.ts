import type { DetectionRulePack, Sensitivity, WatchItem } from "../shared/types";

export interface ContentRuntimeConfig {
  enabled: boolean;
  sensitivity: Sensitivity;
  guardAiOverview: boolean;
  guardRiskyQueries: boolean;
  guardAutocomplete: boolean;
  strictCharacterSpoilerMode: boolean;
  useMlClassifier: boolean;
  currentQuery: string;
  currentQueryRisky: boolean;
  watchItems: WatchItem[];
  rulePack: DetectionRulePack;
}
