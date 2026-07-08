# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # vite build --watch (rebuilds dist/ on save; does NOT hot-reload the extension itself)
npm run build   # tsc -b && vite build — full production build
npm test        # vitest run — all tests
npx vitest run test/urlMatcher.test.ts   # single test file
```

After any rebuild, click the reload icon for Clipcipe on `chrome://extensions`. If the change touched anything under `src/sidepanel`, also close and reopen the side panel — Vite's dev watch does not hot-reload the extension context itself.

`vite build` produces three fixed-name entry points (`background.js`, `content.js`, `src/sidepanel/index.html` + hashed assets) declared in `vite.config.ts`'s `rollupOptions.input` — `public/manifest.json` references `background.js`/`content.js` directly, so entry names must stay in sync with the manifest if either changes.

## Architecture

Chrome extension (Manifest V3). Clips web pages to Markdown either via a saved per-site template (CSS selectors + formatter) or via a one-off element pick — no test suite covers UI, only the pure-logic modules (`urlMatcher`, `turndownSetup`).

### Three build entries, one message protocol

- **`background/`** — MV3 service worker. Handles on-demand content-script injection and the element-picker debugger session (see below). Never holds state in module scope across events beyond the single `activeTabId` picker guard — a service worker can be evicted after ~30s idle, so `chrome.runtime.onMessage`, `chrome.debugger.onEvent`, and `chrome.debugger.onDetach` listeners are all registered synchronously at the top of their modules, not inside an async init (a message that wakes a terminated worker must never be missed).
- **`content/`** — injected on demand via `chrome.scripting.executeScript` (never statically declared in the manifest), guarded by a `window.__clipcipeInjected` idempotency check since the panel may request injection more than once per tab session. Only runs template-based extraction (`extraction/extractor.ts` + Readability fallback).
- **`sidepanel/`** — the React UI. Chosen over a popup deliberately: popups die the instant focus moves to the page, which happens constantly during element picking/extraction.

`lib/messages.ts` defines two separate discriminated-union channels:
- **Panel ↔ Background** (`chrome.runtime.sendMessage`): `contentScript/ensureInjected`, `picker/start`, `picker/stop` (requests), plus `picker/selected`/`picker/cancelled` pushed from background whenever a picking session ends — these are pushes, not responses, since the user's click can come long after `picker/start` returns.
- **Panel ↔ Content script** (`chrome.tabs.sendMessage`, background bypassed entirely): `extract/run` → `extract/result` | `extract/error`.

### Element picker: chrome.debugger, not a content-script overlay

`background/picker.ts` implements point-and-click picking using `chrome.debugger` + the Chrome DevTools Protocol rather than a hand-rolled mousemove/overlay content script. `Overlay.setInspectMode({ mode: 'searchForNode' })` is the literal mechanism DevTools' own inspect-element button uses — hover-highlighting and click-to-select come for free, including piercing shadow DOM and cross-origin iframes, which `querySelectorAll` from a content script cannot do. Trade-offs accepted for this: the `debugger` permission is required (not optional/requestable), attaching shows Chrome's persistent "is debugging this browser" infobar for the duration of the pick (Chrome enforces a floor on how long it stays visible even after `detach()` — an anti-abuse measure, not something the extension can shorten), and only one debugger client (this extension or real DevTools) can attach to a tab at a time. At most one picking session runs at a time — starting a new one implicitly cancels whatever was running (`stopPicking()` always runs before `startPicking()` proceeds).

On click, `Overlay.inspectNodeRequested` fires with a `backendNodeId`; the handler resolves it via `DOM.getOuterHTML` and hands the **raw HTML** back to the panel — deliberately not a generated CSS selector. A selector like `p` or `div.byline` matches many elements on the page, not specifically the one just clicked, so it's useless for reliably re-identifying "that one thing." The panel converts the HTML to Markdown itself (`lib/markdown/turndownSetup.ts`'s Turndown wrapper), since the service worker has no `DOMParser`/DOM APIs for Turndown to use. This feeds the standalone **Quick Clip** flow (`sidepanel/views/QuickClipView.tsx` + `sidepanel/hooks/usePagePicker.ts`) — pick an element, see its rendered Markdown, upload — with no template involved at all.

### Template model and extraction

A `Template` (`lib/types.ts`) is `{ id, name, urlPattern, fields, formatterTemplate, createdAt, updatedAt, syncStatus }`. `urlPattern` is a flat glob string (`urlMatcher.ts` converts it to a `RegExp`, escaping regex metacharacters first) — there is no regex match-rule option and no per-template priority; `findMatchingTemplate` just returns the first array match on ties. Each `Field` is `{ key, selectors[], excludeSelectors? }` — selectors are ordered fallbacks (first DOM match wins) and `excludeSelectors` strips nested ad/related-content blocks from a cloned element before conversion. There is no per-field text/html/attribute mode: every field always takes `innerHTML` and runs it through Turndown (`content/extraction/extractor.ts`). Mozilla Readability (`readabilityFallback.ts`) only backfills a field if every one of its own selectors missed, and only for keys that look like `title` or `body`/`content` — it's a last resort for the fields most likely to make a clip useless if empty, not a general substitute for authored selectors.

On side-panel load and on every reload of the active tab's page, `findMatchingTemplate` auto-selects the winning template for the current URL and immediately runs extraction (`App.tsx`'s `tryAutoMatch`).

### Storage, sync, and the REST backend

`chrome.storage.local` is the source of truth for templates (`lib/storage/templatesStore.ts`), tagged with a two-state `syncStatus: 'saved' | 'modified'`. Syncing with a backend is manual-only — a single "Sync now" action (`lib/sync/templateSync.ts`) pulls unmodified templates from the server and pushes modified ones in one pass; there is no periodic alarm, no pull-on-startup, no push-on-save. `chrome.storage.local` (never `.sync`) is used everywhere, including the API auth token, so nothing leaves the machine unintentionally.

The REST backend is optional and its contract-only — `GET/POST/PUT/DELETE /templates`, `POST /clips` — is implemented by a separate project (`note-app`), not this repo. `VITE_API_BASE_URL` (`.env`) is baked in at build time (`lib/api/client.ts`); the auth token is entered at runtime via the Settings view and stored in `chrome.storage.local` instead, specifically so it can be rotated without a rebuild. Every API call also runs `chrome.permissions.request` for the backend's origin before the fetch — this exempts the request from CORS entirely (a privilege tied to host permissions) rather than depending on the backend adding CORS headers.

### Permissions

Manifest declares `activeTab` + `debugger` (required) and `optional_host_permissions: ["<all_urls>"]` (not a static broad grant). Opening the side panel grants `activeTab` for that tab's session; extracting from a newly-active tab or saving a template for a new domain triggers `chrome.permissions.request` for that origin specifically (`lib/permissions.ts`'s `ensureOriginPermission`) — one explicit, contextual grant per site rather than an upfront blanket one. `chrome.permissions.request` only succeeds during a user gesture, so it's always called directly inside a click handler's call chain, never deferred.
