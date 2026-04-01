export const SPOILERT_ATTR_STATE = "data-spoilert-state";
export const SPOILERT_ATTR_SCORE = "data-spoilert-score";

export const GOOGLE_RESULT_SELECTORS = [
  "#search .MjjYud h3",
  "#search .g h3",
  "#search .g .VwiC3b",
  "#search .g .IsZvec",
  "#search .g .BNeawe",
  "#search .related-question-pair span",
  "#search [jsname='yEVEwb'] span",
  "#search .s75CSd",
  "#rhs .kno-rdesc",
  "#rhs .kno-rdesc span"
] as const;

export const GOOGLE_AI_OVERVIEW_SELECTORS = [
  "#search .kno-aoc",
  "#search [data-md='61']",
  "#search [data-attrid='ai_overview']",
  "#search [data-hveid] .wDYxhc",
  "#search .YzCcne"
] as const;

export const GOOGLE_AUTOCOMPLETE_SELECTORS = [
  "form[role='search'] [role='listbox'] [role='option']",
  "form[role='search'] .sbct",
  "form[role='search'] li.sbct",
  "form[role='search'] .wM6W7d",
  "[role='listbox'] [role='option']",
  "ul[role='listbox'] li",
  "div[role='presentation'] .sbct"
] as const;

export const GOOGLE_AUTOCOMPLETE_ROW_SELECTORS = [
  "[role='option']",
  ".sbct",
  "li.sbct",
  ".wM6W7d",
  "li",
  "div"
] as const;

export const MASK_STYLE_ID = "spoilert-mask-style";
export const MASKED_CLASS = "spoilert-masked";
export const REVEALED_CLASS = "spoilert-revealed";
export const OVERLAY_CLASS = "spoilert-overlay";
export const REVEAL_BUTTON_CLASS = "spoilert-reveal-button";
