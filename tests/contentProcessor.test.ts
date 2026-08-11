// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { MASKED_CLASS, OVERLAY_CLASS, SPOILERT_ATTR_STATE } from "../src/content/constants";
import { ContentProcessor, collectCandidateElements } from "../src/content/processor";
import { seedRulePack } from "../src/shared/rules/seedRules";
import type { ContentRuntimeConfig } from "../src/content/types";

function createBaseConfig(enabled = true): ContentRuntimeConfig {
  return {
    enabled,
    sensitivity: "medium",
    guardAiOverview: true,
    guardRiskyQueries: true,
    guardAutocomplete: true,
    strictCharacterSpoilerMode: true,
    useMlClassifier: false,
    currentQuery: "attack on titan ending",
    currentQueryRisky: true,
    watchItems: [
      {
        id: "w1",
        title: "Attack on Titan",
        type: "show",
        aliases: ["AOT"],
        createdAt: 1,
        updatedAt: 1
      }
    ],
    rulePack: seedRulePack
  };
}

describe("content processor", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("collects only supported google target nodes", () => {
    document.body.innerHTML = `
      <div id="search">
        <div class="g">
          <h3>Attack on Titan ending explained</h3>
          <div class="VwiC3b">Spoiler warning</div>
        </div>
        <div class="random">Do not process me</div>
      </div>
    `;

    const candidates = collectCandidateElements(document);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((candidate) => candidate.kind === "result")).toBe(true);
  });

  it("masks spoiler-like text and attaches reveal overlay", async () => {
    document.body.innerHTML = `
      <div id="search">
        <div class="g">
          <h3 id="target">Attack on Titan finale spoiler: who dies?</h3>
        </div>
      </div>
    `;

    const target = document.getElementById("target") as HTMLElement;
    const processor = new ContentProcessor(createBaseConfig(true));
    await processor.processRoot(document);

    expect(target.classList.contains(MASKED_CLASS)).toBe(true);
    expect(target.getAttribute(SPOILERT_ATTR_STATE)).toBe("masked");
    expect(target.querySelector(`:scope > .${OVERLAY_CLASS}`)).not.toBeNull();
  });

  it("reveal button unmasks only the selected block", async () => {
    document.body.innerHTML = `
      <div id="search">
        <div class="g">
          <h3 id="one">Attack on Titan finale spoiler: who dies?</h3>
          <h3 id="two">Attack on Titan ending explained</h3>
        </div>
      </div>
    `;

    const one = document.getElementById("one") as HTMLElement;
    const two = document.getElementById("two") as HTMLElement;
    const processor = new ContentProcessor(createBaseConfig(true));
    await processor.processRoot(document);

    const revealButton = one.querySelector("button") as HTMLButtonElement;
    revealButton.click();

    expect(one.getAttribute(SPOILERT_ATTR_STATE)).toBe("revealed");
    expect(two.getAttribute(SPOILERT_ATTR_STATE)).toBe("masked");
  });

  it("clears existing masks when extension is disabled", async () => {
    document.body.innerHTML = `
      <div id="search">
        <div class="g">
          <h3 id="target">Attack on Titan finale spoiler: who dies?</h3>
        </div>
      </div>
    `;

    const target = document.getElementById("target") as HTMLElement;
    const processor = new ContentProcessor(createBaseConfig(true));
    await processor.processRoot(document);
    expect(target.getAttribute(SPOILERT_ATTR_STATE)).toBe("masked");

    processor.updateConfig(createBaseConfig(false));
    await processor.processRoot(document);
    expect(target.hasAttribute(SPOILERT_ATTR_STATE)).toBe(false);
  });

  it("processes mutation-added root element when it directly matches selector", async () => {
    document.body.innerHTML = `<div id="rhs"></div>`;
    const rhs = document.getElementById("rhs") as HTMLElement;
    const injected = document.createElement("div");
    injected.className = "kno-rdesc";
    injected.textContent = "Attack on Titan spoiler ending explained";

    rhs.append(injected);
    const processor = new ContentProcessor(createBaseConfig(true));
    await processor.processRoot(injected);

    expect(injected.getAttribute(SPOILERT_ATTR_STATE)).toBe("masked");
  });

  it("handles knowledge panel selector variants", () => {
    document.body.innerHTML = `
      <div id="rhs">
        <div class="kno-rdesc" id="kp">Attack on Titan finale explained with spoilers</div>
      </div>
    `;

    const candidates = collectCandidateElements(document);
    const target = document.getElementById("kp") as HTMLElement;
    expect(candidates.some((candidate) => candidate.element === target)).toBe(true);
  });

  it("marks autocomplete rows with autocomplete kind", () => {
    document.body.innerHTML = `
      <form role="search">
        <div role="listbox">
          <div role="option" id="suggestion">attack on titan eren death</div>
        </div>
      </form>
    `;
    const suggestion = document.getElementById("suggestion") as HTMLElement;
    const candidates = collectCandidateElements(document);
    const candidate = candidates.find((item) => item.element === suggestion);
    expect(candidate?.kind).toBe("autocomplete");
  });

  it("removes risky autocomplete suggestion rows", async () => {
    document.body.innerHTML = `
      <form role="search">
        <div role="listbox">
          <div role="option" id="suggestion">attack on titan eren death</div>
        </div>
      </form>
    `;
    const suggestion = document.getElementById("suggestion") as HTMLElement;
    const processor = new ContentProcessor(createBaseConfig(true));
    await processor.processRoot(document);
    expect(document.body.contains(suggestion)).toBe(false);
  });

  it("keeps safe autocomplete suggestions", async () => {
    document.body.innerHTML = `
      <form role="search">
        <div role="listbox">
          <div role="option" id="safeSuggestion">attack on titan cast interview</div>
        </div>
      </form>
    `;
    const suggestion = document.getElementById("safeSuggestion") as HTMLElement;
    const processor = new ContentProcessor(createBaseConfig(true));
    await processor.processRoot(document);
    expect(document.body.contains(suggestion)).toBe(true);
  });

  it("does not mask AI overview when guard is disabled", async () => {
    document.body.innerHTML = `
      <div id="search">
        <div class="kno-aoc" id="aov">Attack on Titan ending explained</div>
      </div>
    `;
    const target = document.getElementById("aov") as HTMLElement;
    const processor = new ContentProcessor({
      ...createBaseConfig(true),
      guardAiOverview: false
    });
    await processor.processRoot(document);
    expect(target.hasAttribute(SPOILERT_ATTR_STATE)).toBe(false);
  });

  it("falls back to heuristic when ML classify fails", async () => {
    document.body.innerHTML = `
      <div id="search">
        <div class="g">
          <h3 id="target">Attack on Titan season renewal news</h3>
        </div>
      </div>
    `;
    const target = document.getElementById("target") as HTMLElement;
    const chromeApi = globalThis as typeof globalThis & { chrome?: typeof chrome };
    const previousChrome = chromeApi.chrome;
    chromeApi.chrome = {
      runtime: {
        sendMessage: () => Promise.resolve({ ok: false, error: "boom" })
      }
    } as unknown as typeof chrome;

    const processor = new ContentProcessor({
      ...createBaseConfig(true),
      useMlClassifier: true
    });
    await processor.processRoot(document);
    expect(target.hasAttribute(SPOILERT_ATTR_STATE)).toBe(false);
    chromeApi.chrome = previousChrome;
  });
});
