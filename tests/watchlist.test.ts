import { describe, expect, it, vi } from "vitest";

import { findDuplicateTitle, normalizeAliases, removeWatchItem, upsertWatchItem } from "../src/shared/watchlist";
import type { WatchItem } from "../src/shared/types";

const baseItems: WatchItem[] = [
  {
    id: "a",
    title: "Attack on Titan",
    type: "show",
    aliases: ["AOT"],
    createdAt: 1,
    updatedAt: 1
  }
];

describe("watchlist utilities", () => {
  it("normalizes aliases and removes duplicates/empties", () => {
    const aliases = normalizeAliases([" AOT ", "", "AOT", "Attack   on Titan"]);
    expect(aliases).toEqual(["AOT", "Attack on Titan"]);
  });

  it("finds duplicate title ignoring case and spacing", () => {
    const duplicate = findDuplicateTitle(baseItems, "  attack   on titan ");
    expect(duplicate?.id).toBe("a");
  });

  it("creates new watch item for add", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");
    const next = upsertWatchItem(baseItems, {
      title: "The Last of Us",
      type: "show",
      aliases: ["TLOU"]
    });

    expect(next).toHaveLength(2);
    expect(next[1]?.id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("updates existing watch item on edit", () => {
    const next = upsertWatchItem(baseItems, {
      id: "a",
      title: "Attack on Titan",
      type: "show",
      aliases: ["Shingeki no Kyojin"]
    });

    expect(next).toHaveLength(1);
    expect(next[0]?.aliases).toEqual(["Shingeki no Kyojin"]);
  });

  it("removes watch item by id", () => {
    const next = removeWatchItem(baseItems, "a");
    expect(next).toHaveLength(0);
  });
});
