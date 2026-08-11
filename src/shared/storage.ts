import type { UserSettings, WatchItem } from "./types";

export const STORAGE_KEYS = {
  settings: "settings",
  watchItems: "watchItems"
} as const;

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  sensitivity: "medium",
  maskStyle: "blur",
  revealMode: "click",
  guardAiOverview: true,
  guardRiskyQueries: true,
  guardAutocomplete: true,
  strictCharacterSpoilerMode: true,
  useMlClassifier: true
};

export function normalizeSettings(settings?: Partial<UserSettings>): UserSettings {
  return {
    enabled: settings?.enabled ?? DEFAULT_SETTINGS.enabled,
    sensitivity: settings?.sensitivity ?? DEFAULT_SETTINGS.sensitivity,
    maskStyle: settings?.maskStyle ?? DEFAULT_SETTINGS.maskStyle,
    revealMode: settings?.revealMode ?? DEFAULT_SETTINGS.revealMode,
    guardAiOverview: settings?.guardAiOverview ?? DEFAULT_SETTINGS.guardAiOverview,
    guardRiskyQueries: settings?.guardRiskyQueries ?? DEFAULT_SETTINGS.guardRiskyQueries,
    guardAutocomplete: settings?.guardAutocomplete ?? DEFAULT_SETTINGS.guardAutocomplete,
    strictCharacterSpoilerMode:
      settings?.strictCharacterSpoilerMode ?? DEFAULT_SETTINGS.strictCharacterSpoilerMode,
    useMlClassifier: settings?.useMlClassifier ?? DEFAULT_SETTINGS.useMlClassifier
  };
}

export async function getSettings(): Promise<UserSettings> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return DEFAULT_SETTINGS;
  }

  const raw = await chrome.storage.local.get([STORAGE_KEYS.settings]);
  const settings = raw[STORAGE_KEYS.settings] as Partial<UserSettings> | undefined;
  return normalizeSettings(settings);
}

export async function setSettings(settings: UserSettings): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return;
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: settings
  });
}

export async function getWatchItems(): Promise<WatchItem[]> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return [];
  }
  const raw = await chrome.storage.local.get([STORAGE_KEYS.watchItems]);
  return (raw[STORAGE_KEYS.watchItems] as WatchItem[] | undefined) ?? [];
}

export async function setWatchItems(watchItems: WatchItem[]): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return;
  }
  await chrome.storage.local.set({
    [STORAGE_KEYS.watchItems]: watchItems
  });
}
