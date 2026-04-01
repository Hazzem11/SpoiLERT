import { seedRulePack } from "../shared/rules/seedRules";
import { evaluateQueryRisk } from "../shared/detector/queryRisk";
import { DEFAULT_SETTINGS, STORAGE_KEYS, getSettings, getWatchItems } from "../shared/storage";
import { ensureMaskStyles } from "./masking";
import { ContentProcessor } from "./processor";
import { setupQueryGuard, setupSearchPageQueryGuard } from "./queryGuard";
import type { ContentRuntimeConfig } from "./types";

const PROCESS_DELAY_MS = 70;

function isParentNodeNode(node: Node): node is ParentNode {
  return node instanceof Element || node instanceof Document || node instanceof DocumentFragment;
}

function isSupportedGooglePage(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  return window.location.hostname === "www.google.com";
}

async function loadRuntimeConfig(): Promise<ContentRuntimeConfig> {
  const currentQuery =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") ?? "" : "";
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return {
        enabled: DEFAULT_SETTINGS.enabled,
        sensitivity: DEFAULT_SETTINGS.sensitivity,
        guardAiOverview: DEFAULT_SETTINGS.guardAiOverview,
        guardRiskyQueries: DEFAULT_SETTINGS.guardRiskyQueries,
        guardAutocomplete: DEFAULT_SETTINGS.guardAutocomplete,
        strictCharacterSpoilerMode: DEFAULT_SETTINGS.strictCharacterSpoilerMode,
        currentQuery,
        currentQueryRisky: false,
        watchItems: [],
        rulePack: seedRulePack
      };
    }

    const [settings, watchItems] = await Promise.all([getSettings(), getWatchItems()]);
    const queryRisk = evaluateQueryRisk(currentQuery, watchItems);

    return {
      enabled: settings.enabled,
      sensitivity: settings.sensitivity,
      guardAiOverview: settings.guardAiOverview,
      guardRiskyQueries: settings.guardRiskyQueries,
      guardAutocomplete: settings.guardAutocomplete,
      strictCharacterSpoilerMode: settings.strictCharacterSpoilerMode,
      currentQuery,
      currentQueryRisky: queryRisk.isRisky,
      watchItems,
      rulePack: seedRulePack
    };
  } catch {
    // Fail safe to defaults if storage access throws.
    return {
      enabled: DEFAULT_SETTINGS.enabled,
      sensitivity: DEFAULT_SETTINGS.sensitivity,
      guardAiOverview: DEFAULT_SETTINGS.guardAiOverview,
      guardRiskyQueries: DEFAULT_SETTINGS.guardRiskyQueries,
      guardAutocomplete: DEFAULT_SETTINGS.guardAutocomplete,
      strictCharacterSpoilerMode: DEFAULT_SETTINGS.strictCharacterSpoilerMode,
      currentQuery,
      currentQueryRisky: false,
      watchItems: [],
      rulePack: seedRulePack
    };
  }
}

function createDebouncedRunner(action: () => void, delayMs: number): () => void {
  let timeoutId: number | undefined;
  return () => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(action, delayMs);
  };
}

async function bootstrap(): Promise<void> {
  if (!isSupportedGooglePage()) {
    return;
  }

  ensureMaskStyles();
  const config = await loadRuntimeConfig();
  const processor = new ContentProcessor(config);
  let currentConfig = config;
  const queuedRoots = new Set<ParentNode>([document]);

  const flushQueuedRoots = (): void => {
    for (const root of queuedRoots) {
      processor.processRoot(root);
    }
    queuedRoots.clear();
  };

  const scheduleFlush = createDebouncedRunner(flushQueuedRoots, PROCESS_DELAY_MS);
  scheduleFlush();

  setupQueryGuard(() => currentConfig);
  setupSearchPageQueryGuard(() => currentConfig);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (isParentNodeNode(record.target)) {
        queuedRoots.add(record.target);
      } else if (record.target.nodeType === Node.TEXT_NODE && record.target.parentNode) {
        queuedRoots.add(record.target.parentNode);
      }
      for (const node of record.addedNodes) {
        if (isParentNodeNode(node)) {
          queuedRoots.add(node);
        }
      }
    }
    scheduleFlush();
  });

  if (!document.body) {
    return;
  }

  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true
  });

  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      try {
        if (areaName !== "local") {
          return;
        }
        if (!changes[STORAGE_KEYS.settings] && !changes[STORAGE_KEYS.watchItems]) {
          return;
        }
        currentConfig = await loadRuntimeConfig();
        processor.updateConfig(currentConfig);
        queuedRoots.add(document);
        scheduleFlush();
      } catch {
        // No-op to avoid breaking page behavior when storage listeners fail.
      }
    });
  }

  console.info("SpoilERT content script active.");
}

void bootstrap();
