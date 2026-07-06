# Clipcipe — Browser Web-Clipper Extension (Chrome, MV3)

*("Clipcipe" is a provisional working name — rename freely, nothing below depends on it.)*

## Context

The goal is a Chrome extension that turns arbitrary web pages into clean Markdown using per-site "templates" (URL match rule + DOM selectors + a Markdown formatter), so the user can build a personal library of clipped content without hand-copying and reformatting every article/thread/page they want to keep.

Two things distinguish this from generic "web clipper" extensions and drove the design below:
1. **Templates are user-authored and must be easy to build/maintain** — via a point-and-click element picker and live highlight-on-type — rather than requiring the user to hand-write CSS selectors blind.
2. **This repo is extension-only.** A separate backend project (out of scope here) exposes a REST API for uploading clipped Markdown and, per the user's decision, for storing/syncing templates too. This plan defines the API contract the extension expects but does not implement the server.

Distribution target is undecided (personal-use-only vs. eventual Chrome Web Store publish), so the plan defaults to the safer incremental-permissions model, which also works fine for personal use and can be relaxed to static `<all_urls>` later with a one-line manifest change if the user commits to personal-only use.

## Approach

### Build tooling
**Plain Vite** (no extension-specific plugin) + **TypeScript** + **React** for the side panel only. Chrome-only scope removes WXT's main value (cross-browser manifest generation and multi-target output), so a framework layer isn't worth the extra convention/dependency weight for a solo Chrome-only build.
- `manifest.json` is hand-written and lives in `public/manifest.json`, copied to `dist/` as-is by Vite's public-dir passthrough — for a Chrome-only MV3 manifest this is ~30 lines, not worth generating from config.
- `vite.config.ts` declares three build entries via `build.rollupOptions.input`: `background` (service worker), `content` (content script), and `sidepanel/index.html` (the React UI). One `vite build` produces all three as static output files with predictable names that `manifest.json` references directly — no generation/templating step in between.
- The side panel gets Vite's normal dev server/HMR since it's just a regular web page in an extension context. Background and content-script changes still require a manual "reload extension" click in `chrome://extensions` — true of virtually any tooling choice here, since MV3 doesn't support true hot-swapping of service workers or content scripts regardless of framework.
- `turndown` (HTML→Markdown) and `@mozilla/readability` (fallback extraction) are bundled npm deps via Vite, never loaded from a CDN (MV3 CSP forbids remote code).

### File / module structure
```
clipcipe/
├─ vite.config.ts
├─ public/
│  ├─ manifest.json              # static, hand-written, Chrome-only MV3 manifest
│  └─ icons/{16,32,48,128}.png
├─ src/
│  ├─ background/
│  │  ├─ index.ts                # SW entry — register all listeners synchronously (see MV3 gotchas)
│  │  ├─ messageRouter.ts
│  │  ├─ templateSync.ts         # manual pull+push, triggered by "Sync now"
│  │  ├─ uploadQueue.ts          # offline retry queue processor
│  │  ├─ permissions.ts          # optional_host_permissions request/track helpers
│  │  └─ contentScriptInjector.ts
│  ├─ content/
│  │  ├─ index.ts                # injected on demand, not statically declared
│  │  ├─ picker/
│  │  │  ├─ pickerController.ts  # hover/click, enter/exit picker mode
│  │  │  ├─ selectorGenerator.ts # id > data-attrs > tag+class > nth-of-type chain
│  │  │  └─ domNavigation.ts     # "select parent" / "select similar"
│  │  ├─ highlight/highlightController.ts   # querySelectorAll + match/offscreen count
│  │  ├─ overlay/overlay.ts      # shared getBoundingClientRect overlay renderer
│  │  └─ extraction/
│  │     ├─ extractor.ts         # runs field selector-lists, resolves relative URLs
│  │     └─ readabilityFallback.ts
│  ├─ sidepanel/
│  │  ├─ App.tsx
│  │  ├─ views/{TemplateListView,TemplateEditorView,FieldEditor,PreviewView,SettingsView}.tsx
│  │  ├─ state/{templatesStore,uiStore}.ts   # uiStore tracks the bound tabId (see §ux gap)
│  │  └─ hooks/useMessaging.ts
│  └─ lib/                       # shared, DOM-independent
│     ├─ types.ts                # Template, Field, MatchRule, ClipPayload, ApiDTOs
│     ├─ messages.ts              # discriminated-union message protocol
│     ├─ urlMatcher.ts            # glob/regex + priority resolution + ReDoS guard
│     ├─ markdown/{turndownSetup,formatter}.ts
│     ├─ selector/cssSelectorUtils.ts   # hashed-classname deny-list, shared by generator+validator
│     ├─ storage/{templatesCache,settingsStore,uploadQueueStore}.ts
│     └─ api/{client,clips,templates}.ts
└─ test/                          # vitest: urlMatcher, selectorGenerator, formatter
```

### Template data model
Each field (title, author, date, body, images, tags…) holds an **ordered list of fallback selectors** (first match wins), plus an `attribute` of `"text" | "html" | "attr:<name>"`, and an optional `excludeSelectors: string[]` to strip nested ad/related-content blocks before Turndown conversion. Match rule is `{ type: "glob"|"regex", pattern }` plus a numeric `priority`; on save, reject/warn if two templates have identical priority with overlapping patterns (no silent tie-break ambiguity later).

### Editor UX — side panel, not popup
Popups are destroyed the instant focus moves to the page, which happens the moment the user clicks an element for the picker. The template editor lives in `chrome.sidePanel` instead, which persists independently of page focus. Because `chrome.sidePanel` is per-window and doesn't auto-rescope per active tab, `uiStore` explicitly tracks the "bound tabId" for the current edit/picker session, and listens to `chrome.tabs.onActivated`/`onUpdated` to prompt ("switch clipping to this tab?") rather than silently sending picker/highlight messages to a stale tab.

### Point-and-click picker & highlight-on-type
- **Picker**: content script enters picker mode on request, draws an overlay `<div>` (via `getBoundingClientRect`, not by mutating page styles) on hover, and on click generates a selector preferring: stable `id` → stable data attributes (`data-testid`, `aria-label`, `itemprop`, `name`) → tag+non-hashed class → `nth-of-type` ancestor chain as last resort. A regex-based deny-list in `cssSelectorUtils.ts` filters out CSS-in-JS hashed classnames (accept this will need per-site tuning over time, not 100% robust). "Select parent" / "select similar" refine the result.
- **Highlight-on-type**: side panel debounces selector-field input ~300ms, sends it to the content script, which runs `querySelectorAll` and draws the same overlay on every match, reporting match count and how many are off-screen.
- Both bypass the background service worker on the hot path — side panel talks directly to the content script via `chrome.tabs.sendMessage(boundTabId, …)` — since routing every hover/keystroke through the SW risks hitting its termination/wake latency.
- **Known v1 limitation, not solved now**: neither picker nor highlight can reach into shadow DOM or cross-origin iframes (`querySelectorAll` doesn't pierce them). Article body content is usually plain light DOM, so impact should be low, but call it out in release notes.

### Permissions strategy (`optional_host_permissions`, per your decision)
- Manifest declares `activeTab` + `optional_host_permissions: ["<all_urls>"]`, **not** a static broad grant.
- Opening the side panel grants `activeTab` access to that tab for the session — enough for on-demand extraction/picker/highlight.
- Saving a template's match pattern for a **new domain** triggers `chrome.permissions.request({ origins: [derivedOrigin] })` — one explicit, contextual grant per site, not a blanket upfront one.
- Consequence to accept: Clipcipe won't proactively badge "a template matches this page" the instant a page loads unless the panel has been opened (or the origin previously granted) for that tab/session — it's a manual "clip this page" tool by design, not a passive scanner. Static `<all_urls>` can be swapped in later with a one-line manifest change if personal-only distribution is confirmed.
- The API base URL (Settings) also needs `chrome.permissions.request({ origins: [apiOrigin] })` when saved — this exempts the fetch from CORS entirely (an MV3 privilege tied to host_permissions) rather than depending on the backend adding CORS headers.

### MV3 gotchas designed around
- Service worker can be evicted after ~30s idle / mid-fetch after ~5 min — never hold queue/sync/picker-session state only in SW module scope; persist to `chrome.storage.local` immediately and treat the SW as stateless between events.
- Use `chrome.alarms` (not `setInterval`) for upload-queue retry — timers die with the SW. Template sync is manual-only (see below), so no periodic alarm is needed for it.
- Register all `chrome.runtime.onMessage` listeners synchronously at the top of `background/index.ts`, not inside an async init — otherwise the message that wakes a terminated SW can be missed.
- No persistent `chrome.runtime.connect` Ports for picker/highlight streaming (breaks silently across SW termination) — one-shot `sendMessage` request/response or direct panel↔content-script calls instead.
- Content scripts are injected on demand (`chrome.scripting.executeScript`, guarded by `window.__clipcipeInjected` idempotency check) rather than statically declared on all pages — consistent with the permissions strategy above.
- `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` must be set in `onInstalled`, or the action icon won't open the panel. Requires Chrome 114+.

### Message protocol (`src/lib/messages.ts`)
Discriminated unions on two channels:
- **Panel ↔ Background** (`chrome.runtime.sendMessage`): `templates/list|save|delete|sync`, `clip/upload`, `settings/get|save`, `contentScript/ensureInjected`.
- **Panel ↔ Content script** (`chrome.tabs.sendMessage` / `chrome.runtime.sendMessage`, background bypassed): `extract/run`, `picker/start|stop|selectParent|selectSimilar`, `highlight/query|clear` → pushed back as `extract/result`, `picker/elementSelected|cancelled`, `highlight/result`. Picker/highlight results are push events (user's click can come long after `picker/start` returns), so the panel keeps a listener active for the session and tears it down on `picker/stop` or navigation away.

### Local storage (`chrome.storage.local`, never `.sync` — token must not leave the machine)
- `clipcipe:templates` — cached `Template[]` with a two-state `syncStatus: 'saved' | 'modified'`. No conflict-detection metadata — manual sync just pushes everything `modified` and refreshes everything else from the server.
- `clipcipe:settings` — `{ apiBaseUrl, authToken }`. Token stored unencrypted-on-disk but profile-isolated and never synced — accepted trade-off for a single-user personal tool; mask as a password field in Settings UI, never log it.
- `clipcipe:uploadQueue` — pending clip uploads (`pending|uploading|failed`, `attempts`, `lastError`) for offline retry via `chrome.alarms`.
- `clipcipe:syncMeta` — `{ lastPulledAt, lastPushedAt }`.

### Template sync with the external server
Manual only — a single "Sync now" action in Settings does both directions in one call: pull `GET /templates` and overwrite any local template still marked `'saved'` (no local edits) with the server's copy, then push every locally `'modified'` template (`POST`/`PUT`) and flip it back to `'saved'` on success. No periodic alarm, no pull-on-startup, no push-on-save — editing a template just flips it to `'modified'` in the local cache and waits for the next manual sync. This is effectively last-write-wins (a `'modified'` local edit always wins over whatever the pull just fetched, since the push happens after the pull step) without needing explicit conflict metadata — a reasonable trade for a single-user tool where syncing is a deliberate, infrequent action.

### REST API contract (hand off to the backend project — not built here)
All requests: `Authorization: Bearer <token>`.

- **`POST /clips`** — `{ markdown, sourceUrl, title, clippedAt, templateId, fields: {author, date, tags}, metadata: {extensionVersion} }` → `201 { id, createdAt }`. Errors: `401`, `422 { errors }`, `500`.
- **`GET /templates`** → `200 { templates: TemplateDTO[] }`.
- **`POST /templates`** — `TemplateDTO` minus id/timestamps → `201` full DTO.
- **`PUT /templates/:id`** — full DTO → `200` updated DTO. No optimistic-concurrency check needed — the extension doesn't do conflict detection (see sync strategy above).
- **`DELETE /templates/:id`** → `204`.

`TemplateDTO`: `{ id, name, matchRule: {type, pattern}, priority, fields: [{key, selectors[], attribute, excludeSelectors?}], formatterTemplate, createdAt, updatedAt }`.

### Phased build plan
| Phase | Scope | Demo/verification |
|---|---|---|
| 0 | Vite scaffold, static `public/manifest.json`, three build entries wired, SW registered, action opens empty side panel | `vite build`, load unpacked from `dist/`, icon click opens panel; `vite build --watch` for iterative rebuilds |
| 1 | Template types + `chrome.storage.local` CRUD, list/edit view with manually typed selectors + formatter textarea | Create/edit/delete a template, persists across reload |
| 2 | Content-script extractor + Turndown pipeline + Readability fallback + preview pane | Open a real article, manually entered selectors → live Markdown preview |
| 3 | `urlMatcher.ts` (glob/regex + priority) auto-selects winning template per tab | Multiple domain templates saved, correct one auto-selected on navigation |
| 4 | Point-and-click picker: overlay, hover/click, selector generator, parent/similar refine | Click "Pick", click a page element, selector fills the field |
| 5 | Highlight-on-type: debounce + `querySelectorAll` + overlay + match/offscreen count | Typing a selector live-highlights matches on the page |
| 6 | Settings (API URL + token) + `POST /clips` wiring + upload button | Clip a page, upload succeeds against the backend (or a local mock) |
| 7 | Manual `/templates` sync: "Sync now" pulls + pushes `modified` templates in one action, two-state `syncStatus` | Edit a template (marked `modified`) → click "Sync now" → pushed to server and flipped to `saved`; unedited templates refresh from the server on the same sync |
| 8 | Offline upload/sync retry queue via `chrome.alarms` | Disable network → clip queues; re-enable → auto-flushes |
| 9 | Permissions hardening: confirm `optional_host_permissions` flow end-to-end, dynamic content-script injection only where granted | Fresh install requests zero host access; saving a new-domain template prompts exactly one grant |
| 10 | Polish: icons, keyboard shortcut, context-menu "Clip with Clipcipe", empty/error states | Manual smoke test of full flow start to finish |

## Critical files to create first
- `src/lib/types.ts`, `src/lib/messages.ts` — the contracts everything else depends on
- `src/lib/urlMatcher.ts` — template selection logic, needs unit tests (priority ties, ReDoS guard)
- `src/content/picker/selectorGenerator.ts` — the highest-risk/most-novel logic, needs unit tests against varied HTML fixtures
- `src/background/templateSync.ts` — sync/conflict logic
- `vite.config.ts`, `public/manifest.json` — build entries, permissions declarations

## Verification
- Unit tests (vitest) for `urlMatcher`, `selectorGenerator`, and `formatter` against fixture HTML/URLs — these are pure functions and the highest-value places for automated tests.
- Manual end-to-end pass per phase per the table above, using `vite build --watch` and loading the unpacked `dist/` folder in Chrome against a couple of real sites (a static article site and one dynamic/SPA site) to exercise both the fallback (Readability) path and a hand-built template.
- Before Phase 6, verify `POST /clips` and `/templates` against either the real backend project or a throwaway local mock server implementing the contract in this plan, so the interface is validated before both projects integrate for real.
