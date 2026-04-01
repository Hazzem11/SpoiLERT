import type { WatchItem } from "./types";

export interface WatchItemDraft {
  id?: string;
  title: string;
  type: "show" | "movie";
  aliases?: string[];
  progress?: WatchItem["progress"];
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeAliases(aliases: string[]): string[] {
  const cleaned = aliases
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0)
    .map((alias) => alias.replace(/\s+/g, " "));

  return cleaned.filter((alias, index) => cleaned.indexOf(alias) === index);
}

export function findDuplicateTitle(
  watchItems: WatchItem[],
  title: string,
  excludeId?: string
): WatchItem | undefined {
  const normalized = normalizeTitle(title);
  return watchItems.find(
    (item) => item.id !== excludeId && normalizeTitle(item.title) === normalized
  );
}

export function upsertWatchItem(watchItems: WatchItem[], draft: WatchItemDraft): WatchItem[] {
  const timestamp = Date.now();
  const aliases = normalizeAliases(draft.aliases ?? []);
  const existing = draft.id ? watchItems.find((item) => item.id === draft.id) : undefined;

  if (existing) {
    return watchItems.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            title: draft.title.trim(),
            type: draft.type,
            aliases,
            progress: draft.progress,
            updatedAt: timestamp
          }
        : item
    );
  }

  const created: WatchItem = {
    id: crypto.randomUUID(),
    title: draft.title.trim(),
    type: draft.type,
    aliases,
    progress: draft.progress,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return [...watchItems, created];
}

export function removeWatchItem(watchItems: WatchItem[], id: string): WatchItem[] {
  return watchItems.filter((item) => item.id !== id);
}
