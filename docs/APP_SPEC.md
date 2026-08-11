# App Spec: SpoilERT (Google Spoiler Shield)

## 0) How To Use This Spec

- This file is the single source of truth for implementation decisions.
- Sections marked with `[EDIT ME]` are expected to be customized by you.
- If a requirement is not in this file, the implementation agent should not invent it.
- Priority order when conflicts exist:
  1. Security and privacy requirements
  2. Core MVP acceptance criteria
  3. UX requirements
  4. Nice-to-have items

---

## 1) Product Goal

Build a browser extension that reduces accidental spoilers on Google Search by detecting and masking spoiler-risk text before the user reads it and also removing any spoilers from the web page hes viewing.

### Problem Statement

Users searching for episodes, cast details, character names, release schedules, or fan content often see unwanted spoilers in Google results (titles, snippets, related questions, knowledge panels, and suggestions).

### Target Outcome

Users can safely search for shows and movies with little to no spoiler exposures.

### Success Metrics (MVP)

- Spoiler masking precision on flagged text >= 80% in manual test set.
- User-reported accidental spoiler exposure reduced by >= 60% in first-week usage logs/surveys.
- Extension interaction latency perceived as instant (no visible page lag for normal searches).

---

## 2) Users & Roles

### Primary User

- Viewer of ongoing TV series and unreleased/newly released movies.
- viewer of a past show/anime/movie that he has seen yet or hasnt finished yet
- Wants control over what to hide without disabling search entirely.

### Roles

- `end_user`: installs extension, sets spoiler sensitivity, manages watchlist.

---

## 3) Scope

### In Scope (MVP)

- Google Search result pages only.
- Detect and mask spoiler-risk text in:
  - Search result titles/snippets
  - "People also ask" questions/snippets
  - Related searches text
  - Knowledge panel summary text
- User watchlist with manual entries:
  - Show/movie title
  - Optional season/episode progress
- Local-only processing and storage (no backend required for MVP).
- Toggle extension on/off per tab and globally.
- Optional on-device DistilBERT spoiler classifier via Transformers.js (hybrid with heuristics).

### Out of Scope (MVP)

- Non-Google search engines.
- Social platforms (X, Reddit, YouTube comments, etc.).
- Cloud NLP inference (user text stays on-device).
- Cross-device sync.
- Mobile browser support.

---

## 4) Core Features (MVP)

### Feature A: Spoiler Detection and Masking

#### User Story

As a user, I want spoiler-risk text hidden on Google results so I can search safely.

#### Inputs

- Visible text nodes from supported Google page sections.
- Watchlist titles and optional progress metadata.
- User sensitivity level (`low`, `medium`, `high`).

#### Business Rules

- If text contains high-confidence spoiler patterns for tracked content, mask it.
- Mask with blur + placeholder text (`Potential spoiler hidden`).
- User can click to reveal individual masked blocks.
- Do not remove DOM nodes; wrap/overlay to preserve layout stability.

#### Edge Cases

- Ambiguous terms (common words that are also character names).
- Multi-language snippets (English-first support in MVP; non-English best effort).
- Live-updating Google content sections after initial page load.

#### Acceptance Criteria

- Risk text in targeted sections is masked within 300ms after render/update.
- Reveal action works per block and does not affect other blocks.
- False positive rate is acceptable in manual QA (target <= 20% in seed dataset).

---

### Feature B: Watchlist Management

#### User Story

As a user, I want to define what content I care about so detection is relevant.

#### Inputs

- Title input (required), type (`show` or `movie`), optional progress fields.

#### Business Rules

- Deduplicate titles case-insensitively.
- Allow editing/removing entries.
- For shows, optional progress:
  - `latest_watched_season`
  - `latest_watched_episode`
- For movies, optional `watched` toggle.

#### Acceptance Criteria

- User can add, edit, and remove entries from popup UI.
- Changes persist across browser restarts.
- Content script uses updated watchlist without reload when possible.

---

### Feature C: Sensitivity and Controls

#### User Story

As a user, I want control over strictness and quick disable options.

#### Inputs

- Sensitivity dropdown (`low`, `medium`, `high`)
- Global enable/disable
- Per-site toggle (Google only in MVP)

#### Business Rules

- `low`: mask only explicit spoiler phrases.
- `medium`: mask explicit + strong contextual spoiler signals.
- `high`: mask explicit + contextual + likely spoiler references to tracked titles.

#### Acceptance Criteria

- Switching sensitivity updates behavior immediately on next page mutation cycle.
- Toggle state persists and is clearly reflected in popup UI.

---

## 5) Non-Functional Requirements

### Performance

- Initial content scan on page load under 100ms on typical results page.
- Mutation handling should be debounced/throttled to avoid jank.
- Avoid blocking main thread with expensive regex passes on large DOM chunks.

### Privacy & Security

- No raw search queries sent externally in MVP.
- All user data stored locally in browser extension storage.
- Least-privilege extension permissions.
- Sanitize any dynamic HTML insertion (prefer text-only rendering in UI).

### Reliability

- Extension fails safe: if detector errors, do not break Google page interaction.
- Robust against moderate Google DOM structure changes by using resilient selectors.

### Accessibility

- Keyboard navigable popup.
- Color contrast for masked/revealed states.
- Clear labels for toggles and settings.

---

## 6) Recommended Technical Stack (MVP)

- Extension format: Manifest V3
- Language: TypeScript
- UI: React + lightweight styling with Tailwind
- Build tooling: Vite + extension plugin 
- Storage: `chrome.storage.local`
- State management: simple store (`zustand` or React context)
- Testing:
  - Unit: Vitest
  - E2E (light): Playwright extension tests

### Permissions (initial target)

- `storage`
- `activeTab`
- Host permission for Google search pages only (`https://www.google.com/*`)

---

## 7) Data Model

### Entity: WatchItem

- `id: string` (uuid)
- `title: string`
- `type: "show" | "movie"`
- `aliases: string[]` (optional, user-entered)
- `progress?: { season?: number; episode?: number; watched?: boolean }`
- `createdAt: number`
- `updatedAt: number`

### Entity: UserSettings

- `enabled: boolean`
- `sensitivity: "low" | "medium" | "high"`
- `maskStyle: "blur" | "blackout"` (`blur` default)
- `revealMode: "click" | "hover"` (`click` default)

### Entity: DetectionRulePack

- `version: string`
- `explicitPatterns: string[]`
- `contextPatterns: string[]`
- `characterDeathPatterns: string[]`
- `endingPatterns: string[]`

---

## 8) Detection Strategy (Implementation Guidance)

### MVP Approach

Use a hybrid heuristic engine:

1. Title-aware matching:
  - Activate rules more aggressively when watched-title tokens appear.
2. Pattern-based scoring:
  - Weighted regex/pattern hits for spoiler indicators (e.g., "dies", "ending explained", "killer is").
3. Sensitivity thresholding:
  - Convert score to mask decision by threshold per sensitivity level.

### Suggested Scoring

- Explicit spoiler phrase: +5
- Ending/death reveal phrase: +4
- Tracked title mention: +3
- Character/event context phrase: +2
- If score >= threshold -> mask

Thresholds:

- `low`: 8
- `medium`: 6
- `high`: 4

### Initial Seed Patterns (English)

- Explicit:
  - `\bspoiler(s)?\b`
  - `\bending explained\b`
  - `\bfinale\b`
- Death/outcome:
  - `\b(dies|death|killed|killer is)\b`
  - `\bplot twist\b`
  - `\bpost[- ]credit scene\b`
- Outcome reveal:
  - `\bwho (dies|wins|survives)\b`
  - `\bwhat happens to\b`

Expand or trim patterns based on your preferred strictness.

---

## 9) UX Requirements

### Popup UI

- Header: extension status (`On/Off`)
- Quick toggle button
- Sensitivity selector
- Watchlist section:
  - Add item form
  - Existing items list with edit/delete
- Optional: "Reveal all on current page" action

### On-Page Masking UX

- Masked block shows:
  - Placeholder label (`Potential spoiler hidden`)
  - Small `Reveal` action
- Preserve original layout dimensions to avoid content jumping.
- Revealed block should visually indicate user override.

---

## 10) Architecture

### Components

- `content-script`:
  - Observe Google DOM
  - Extract candidate text nodes from targeted sections
  - Run detector
  - Apply masking/reveal behavior
- `background/service worker`:
  - Central settings/watchlist reads
  - Message routing (if needed)
- `popup app`:
  - Manage settings and watchlist
- `shared`:
  - Types, detector engine, rules, utilities

### Messaging

- Popup updates settings in storage.
- Content script listens for storage changes to refresh behavior.

---

## 11) Testing Plan

### Unit Tests

- Detector scoring with representative strings.
- Threshold behavior by sensitivity.
- Title matching normalization (case, punctuation, spacing).
- Storage read/write utilities.

### Integration Tests

- Content script masks known spoiler snippets in mocked DOM.
- Mutation observer re-processes newly injected nodes.
- Reveal action toggles only targeted block.

### Manual QA Checklist

- Google results page with tracked show query.
- Generic query containing spoiler language.
- Toggle extension off -> no masking.
- Sensitivity changes produce expected strictness.
- Watchlist update reflects without browser restart.

---

## 12) Delivery Plan

### Phase 1: Scaffold + Core Detector

- Set up MV3 extension structure and build tooling.
- Implement shared types and simple scoring engine.
- Add static seed rules and tests for detector.

### Phase 2: Google Content Script Masking

- Implement DOM targeting for Google sections.
- Add mask/reveal UI behavior.
- Add mutation observer handling and performance safeguards.

### Phase 3: Popup + Watchlist + Settings

- Build popup UI with watchlist CRUD.
- Persist settings in `chrome.storage.local`.
- Wire live updates to content script.

### Phase 4: Hardening + QA

- Improve selector robustness.
- Add edge-case tests.
- Final manual QA and docs.

---

## 13) Definition of Done (MVP)

- Extension loads and runs on Google search pages.
- Spoiler-risk text is masked using configured sensitivity.
- User can reveal masked text per block.
- Watchlist CRUD works and persists locally.
- Settings changes apply reliably.
- Unit tests pass.
- Basic integration/manual QA completed.
- README includes install and usage instructions.

---


## 14) Handoff Prompt (Copy/Paste Next)

Use this when you want the implementation to start:

```text
Read and follow docs/APP_SPEC.md as the source of truth.
Implement Phase 1 end-to-end now.

Rules:
- Keep changes scoped to Phase 1 only.
- Add/update tests for everything implemented.
- Run lint/typecheck/tests after coding.
- If blocked by ambiguity, ask at most 3 precise questions; otherwise proceed with a clearly stated assumption.
- At the end provide: files changed, what was implemented, test results, and next phase recommendation.
```

