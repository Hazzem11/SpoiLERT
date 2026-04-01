import { evaluateQueryRisk } from "../shared/detector/queryRisk";
import type { ContentRuntimeConfig } from "./types";

const GUARD_MODAL_ID = "spoilert-query-guard-modal";
const GUARD_STYLE_ID = "spoilert-query-guard-style";
const ACK_STORAGE_KEY = "spoilert-risky-query-ack";
export const QUERY_GUARD_MODAL_ID = GUARD_MODAL_ID;

function ensureGuardStyles(): void {
  if (document.getElementById(GUARD_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = GUARD_STYLE_ID;
  style.textContent = `
    #${GUARD_MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(4, 8, 14, 0.9);
      backdrop-filter: blur(14px) saturate(0.75);
      -webkit-backdrop-filter: blur(14px) saturate(0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    #${GUARD_MODAL_ID} .spoilert-guard-card {
      width: min(460px, 100%);
      border-radius: 14px;
      border: 1px solid rgba(143, 167, 216, 0.34);
      background: #0f1a33;
      color: #eef4ff;
      box-shadow: 0 24px 40px rgba(0, 0, 0, 0.45);
      padding: 16px;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${GUARD_MODAL_ID} h3 {
      margin: 0 0 8px;
      font-size: 18px;
    }
    #${GUARD_MODAL_ID} p {
      margin: 0;
      line-height: 1.45;
      color: #c5d4f2;
      font-size: 14px;
    }
    #${GUARD_MODAL_ID} .spoilert-guard-actions {
      margin-top: 14px;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    #${GUARD_MODAL_ID} button {
      border-radius: 10px;
      border: 1px solid rgba(130, 154, 198, 0.48);
      background: #17284d;
      color: #f4f7ff;
      padding: 8px 12px;
      font-size: 13px;
      cursor: pointer;
    }
    #${GUARD_MODAL_ID} .spoilert-guard-continue {
      border-color: rgba(110, 228, 255, 0.8);
      background: linear-gradient(135deg, #0e7490 0%, #2563eb 100%);
    }
  `;
  if (document.head) {
    document.head.append(style);
    return;
  }
  if (document.documentElement) {
    document.documentElement.append(style);
  }
}

type SearchField = HTMLInputElement | HTMLTextAreaElement;

function getSearchInput(form: HTMLFormElement): SearchField | null {
  const byName = form.querySelector("input[name='q']");
  if (byName instanceof HTMLInputElement) {
    return byName;
  }
  const fallback = document.querySelector("textarea[name='q'], input[name='q']");
  return fallback instanceof HTMLInputElement || fallback instanceof HTMLTextAreaElement ? fallback : null;
}

function removeGuardModal(): void {
  const existing = document.getElementById(GUARD_MODAL_ID);
  if (existing) {
    existing.remove();
  }
}

function showGuardModal(params: {
  onContinue: () => void;
  onCancel: () => void;
  riskyTerm: string;
  riskyTitle: string;
  confidence: "low" | "medium" | "high";
}): void {
  removeGuardModal();
  ensureGuardStyles();

  const modal = document.createElement("div");
  modal.id = GUARD_MODAL_ID;

  const card = document.createElement("div");
  card.className = "spoilert-guard-card";
  const title = document.createElement("h3");
  title.textContent = "Possible spoiler search";
  const body = document.createElement("p");
  if (params.riskyTitle) {
    body.textContent = `Your query mentions "${params.riskyTitle}" and "${params.riskyTerm}" (risk: ${params.confidence}). This can reveal spoilers. Continue anyway?`;
  } else {
    body.textContent = `This query includes spoiler-heavy wording ("${params.riskyTerm}") with ${params.confidence} confidence. Continue anyway?`;
  }

  const actions = document.createElement("div");
  actions.className = "spoilert-guard-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Go back";
  cancelButton.addEventListener("click", () => {
    removeGuardModal();
    params.onCancel();
  });

  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.className = "spoilert-guard-continue";
  continueButton.textContent = "Continue anyway";
  continueButton.addEventListener("click", () => {
    removeGuardModal();
    params.onContinue();
  });

  actions.append(cancelButton, continueButton);
  card.append(title, body, actions);
  modal.append(card);
  if (document.body) {
    document.body.append(modal);
  } else if (document.documentElement) {
    document.documentElement.append(modal);
  } else {
    return;
  }
  continueButton.focus();
}

export function setupQueryGuard(getConfig: () => ContentRuntimeConfig): void {
  const submitHandler = createQueryGuardSubmitHandler(getConfig);
  document.addEventListener("submit", submitHandler, true);

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter") {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }
      if (target.name !== "q") {
        return;
      }
      const form = target.form;
      if (!form) {
        return;
      }
      const synthetic = new Event("submit", { cancelable: true, bubbles: true });
      Object.defineProperty(synthetic, "target", { value: form });
      submitHandler(synthetic);
      if (synthetic.defaultPrevented) {
        event.preventDefault();
      }
    },
    true
  );
}

export function setupSearchPageQueryGuard(getConfig: () => ContentRuntimeConfig): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!window.location.pathname.startsWith("/search")) {
    return;
  }

  const query = new URLSearchParams(window.location.search).get("q") ?? "";
  if (!query.trim()) {
    return;
  }

  const config = getConfig();
  if (!config.enabled || !config.guardRiskyQueries) {
    return;
  }

  const ackQuery = window.sessionStorage.getItem(ACK_STORAGE_KEY);
  if (ackQuery === query) {
    return;
  }

  const risk = evaluateQueryRisk(query, config.watchItems);
  if (!risk.isRisky || !risk.matchedIntent) {
    return;
  }

  showGuardModal({
    riskyTerm: risk.matchedIntent,
    riskyTitle: risk.matchedTitle ?? "",
    confidence: risk.confidence,
    onCancel: () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "https://www.google.com";
      }
    },
    onContinue: () => {
      window.sessionStorage.setItem(ACK_STORAGE_KEY, query);
    }
  });
}

export function createQueryGuardSubmitHandler(getConfig: () => ContentRuntimeConfig): EventListener {
  let bypassNextSubmit = false;

  return (event: Event) => {
    const eventTarget = event.target;
    const form =
      eventTarget instanceof HTMLFormElement
        ? eventTarget
        : eventTarget instanceof Element
          ? eventTarget.closest("form")
          : null;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const input = getSearchInput(form);
    if (!input) {
      return;
    }

    if (bypassNextSubmit) {
      bypassNextSubmit = false;
      return;
    }

    const config = getConfig();
    if (!config.enabled || !config.guardRiskyQueries) {
      return;
    }

    const risk = evaluateQueryRisk(input.value, config.watchItems);
    if (!risk.isRisky || !risk.matchedIntent) {
      return;
    }

    event.preventDefault();
    showGuardModal({
      riskyTerm: risk.matchedIntent,
      riskyTitle: risk.matchedTitle ?? "",
      confidence: risk.confidence,
      onCancel: () => {
        input.focus();
      },
      onContinue: () => {
        bypassNextSubmit = true;
        form.requestSubmit();
      }
    });
  };
}
