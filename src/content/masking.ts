import {
  MASK_STYLE_ID,
  MASKED_CLASS,
  OVERLAY_CLASS,
  REVEAL_BUTTON_CLASS,
  REVEALED_CLASS,
  SPOILERT_ATTR_SCORE,
  SPOILERT_ATTR_STATE
} from "./constants";

function createOverlay(label: string): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;

  const text = document.createElement("span");
  text.textContent = label;

  const button = document.createElement("button");
  button.type = "button";
  button.className = REVEAL_BUTTON_CLASS;
  button.textContent = "Reveal";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const parent = overlay.parentElement as HTMLElement | null;
    if (parent) {
      revealElement(parent);
    }
  });

  overlay.append(text, button);
  return overlay;
}

export function ensureMaskStyles(): void {
  if (document.getElementById(MASK_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = MASK_STYLE_ID;
  style.textContent = `
    .${MASKED_CLASS} {
      position: relative !important;
      filter: blur(6px);
      transition: filter 120ms ease;
    }
    .${MASKED_CLASS} .${OVERLAY_CLASS} {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: rgba(10, 16, 28, 0.78);
      color: #f4f6ff;
      padding: 8px;
      z-index: 2147483646;
      filter: none;
      font-size: 12px;
      border-radius: 6px;
      backdrop-filter: blur(2px);
    }
    .${REVEAL_BUTTON_CLASS} {
      border: 1px solid rgba(255, 255, 255, 0.35);
      color: #ffffff;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 12px;
      line-height: 1.3;
    }
    .${REVEAL_BUTTON_CLASS}:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .${REVEALED_CLASS} {
      filter: none !important;
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

function removeOverlay(element: HTMLElement): void {
  const overlay = element.querySelector(`:scope > .${OVERLAY_CLASS}`);
  if (overlay instanceof HTMLElement) {
    overlay.remove();
  }
}

export function revealElement(element: HTMLElement): void {
  removeOverlay(element);
  element.classList.remove(MASKED_CLASS);
  element.classList.add(REVEALED_CLASS);
  element.setAttribute(SPOILERT_ATTR_STATE, "revealed");
  element.removeAttribute(SPOILERT_ATTR_SCORE);
}

export function clearMask(element: HTMLElement): void {
  removeOverlay(element);
  element.classList.remove(MASKED_CLASS, REVEALED_CLASS);
  element.removeAttribute(SPOILERT_ATTR_STATE);
  element.removeAttribute(SPOILERT_ATTR_SCORE);
}

export function applyMask(element: HTMLElement, score: number, label = "Potential spoiler hidden"): void {
  if (element.getAttribute(SPOILERT_ATTR_STATE) === "revealed") {
    return;
  }

  const hasOverlay = element.querySelector(`:scope > .${OVERLAY_CLASS}`) instanceof HTMLElement;
  if (!hasOverlay) {
    element.append(createOverlay(label));
  } else {
    const text = element.querySelector(`:scope > .${OVERLAY_CLASS} span`);
    if (text) {
      text.textContent = label;
    }
  }

  element.classList.remove(REVEALED_CLASS);
  element.classList.add(MASKED_CLASS);
  element.setAttribute(SPOILERT_ATTR_STATE, "masked");
  element.setAttribute(SPOILERT_ATTR_SCORE, String(score));
}
