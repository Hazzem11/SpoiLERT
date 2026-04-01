# SpoilERT

SpoilERT is a Chrome extension that reduces accidental spoilers on Google Search pages by detecting spoiler-risk text and masking it until you choose to reveal it.

## Current Status

- Phase 1 complete: extension scaffold + detector core + seed rules
- Phase 2 complete: Google targeting + mask/reveal + mutation handling
- Phase 3 complete: popup settings + watchlist CRUD + storage sync
- Phase 4 complete: selector hardening + edge-case tests + QA checklist

## Local Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

## Load In Chrome

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `dist` folder

## QA Checklist

### Core Runtime

- Extension loads without errors in Chrome extensions page
- Popup opens and displays branding + controls
- On Google search pages, content script runs without console errors

### Settings + Watchlist

- Toggle protection on/off and confirm state persists
- Change sensitivity and confirm it persists
- Add/edit/delete watchlist items and confirm updates persist after reload
- Duplicate title prevention works (case/spacing insensitive)

### Spoiler Masking

- Search a tracked title with spoiler-heavy query and verify masking appears
- Click reveal on one block and verify only that block is revealed
- Disable protection and verify previously masked items clear on reprocess

### Dynamic Content

- Expand "People also ask" results and verify new text can be processed
- Scroll/search interactions that inject new cards should still be processed

## Notes

- Storage is local only (`chrome.storage.local`).
- Host permissions are limited to `https://www.google.com/*`.
- Detection uses heuristic scoring and may require tuning for your preferences.
