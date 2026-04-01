import { describe, expect, it } from "vitest";

import { evaluateQueryRisk } from "../src/shared/detector/queryRisk";
import type { WatchItem } from "../src/shared/types";

const watchItems: WatchItem[] = [
  {
    id: "1",
    title: "Attack on Titan",
    type: "show",
    aliases: ["AOT"],
    createdAt: 1,
    updatedAt: 1
  }
];

describe("query risk detector", () => {
  it("flags tracked title with spoiler intent phrase", () => {
    const result = evaluateQueryRisk("attack on titan ending", watchItems);
    expect(result.isRisky).toBe(true);
    expect(result.matchedTitle).toBe("attack on titan");
  });

  it("flags alias with spoiler intent phrase", () => {
    const result = evaluateQueryRisk("aot eren death", watchItems);
    expect(result.isRisky).toBe(true);
    expect(result.matchedTitle).toBe("aot");
  });

  it("flags title + character + death pattern with high confidence", () => {
    const bbWatchlist: WatchItem[] = [
      {
        id: "bb",
        title: "Breaking Bad",
        type: "show",
        aliases: [],
        createdAt: 1,
        updatedAt: 1
      }
    ];
    const result = evaluateQueryRisk("breaking bad hank death", bbWatchlist);
    expect(result.isRisky).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("does not flag safe tracked title searches", () => {
    const result = evaluateQueryRisk("attack on titan release schedule", watchItems);
    expect(result.isRisky).toBe(false);
    expect(result.confidence).toBe("low");
  });
});
