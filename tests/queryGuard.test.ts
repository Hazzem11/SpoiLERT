// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createQueryGuardSubmitHandler,
  QUERY_GUARD_MODAL_ID,
  setupSearchPageQueryGuard
} from "../src/content/queryGuard";
import { seedRulePack } from "../src/shared/rules/seedRules";
import type { ContentRuntimeConfig } from "../src/content/types";

function createConfig(): ContentRuntimeConfig {
  return {
    enabled: true,
    sensitivity: "medium",
    guardAiOverview: true,
    guardRiskyQueries: true,
    guardAutocomplete: true,
    strictCharacterSpoilerMode: true,
    currentQuery: "",
    currentQueryRisky: false,
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

describe("query guard", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    window.history.pushState({}, "", "/");
    window.sessionStorage.clear();
  });

  it("blocks risky query submit and shows confirmation modal", () => {
    document.body.innerHTML = `
      <form id="search-form">
        <input name="q" value="attack on titan ending" />
      </form>
    `;
    const form = document.getElementById("search-form") as HTMLFormElement;
    const handler = createQueryGuardSubmitHandler(() => createConfig());
    const event = new Event("submit", { cancelable: true });
    Object.defineProperty(event, "target", { value: form });

    const prevented = !form.dispatchEvent(event);
    handler(event);

    expect(event.defaultPrevented || prevented).toBe(true);
    expect(document.getElementById(QUERY_GUARD_MODAL_ID)).not.toBeNull();
  });

  it("allows safe query submit without modal", () => {
    document.body.innerHTML = `
      <form id="search-form">
        <input name="q" value="attack on titan release date" />
      </form>
    `;
    const form = document.getElementById("search-form") as HTMLFormElement;
    const handler = createQueryGuardSubmitHandler(() => createConfig());
    const event = new Event("submit", { cancelable: true });
    Object.defineProperty(event, "target", { value: form });

    handler(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.getElementById(QUERY_GUARD_MODAL_ID)).toBeNull();
  });

  it("continues submit when user confirms modal", () => {
    document.body.innerHTML = `
      <form id="search-form">
        <input name="q" value="attack on titan ending" />
      </form>
    `;
    const form = document.getElementById("search-form") as HTMLFormElement;
    const requestSubmitSpy = vi.spyOn(form, "requestSubmit").mockImplementation(() => {});
    const handler = createQueryGuardSubmitHandler(() => createConfig());
    const event = new Event("submit", { cancelable: true });
    Object.defineProperty(event, "target", { value: form });

    handler(event);
    const continueButton = document.querySelector(
      `#${QUERY_GUARD_MODAL_ID} .spoilert-guard-continue`
    ) as HTMLButtonElement;
    continueButton.click();

    expect(requestSubmitSpy).toHaveBeenCalledTimes(1);
  });

  it("blocks risky search results page on load", () => {
    window.history.pushState({}, "", "/search?q=sopranos+ending");
    setupSearchPageQueryGuard(() => createConfig());
    expect(document.getElementById(QUERY_GUARD_MODAL_ID)).not.toBeNull();
  });
});
