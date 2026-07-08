# Clipcipe

A Chrome extension (Manifest V3) that clips web pages to Markdown, either via a
saved per-site template (a URL glob pattern plus CSS selectors for each field,
rendered through a small formatter template) or via a one-off element pick.

## Status

Implemented so far:

- Template CRUD (create/edit/delete), stored locally in `chrome.storage.local`
- Content-script extraction: selector-based field extraction, HTML→Markdown
  via Turndown, Mozilla Readability fallback for fields that don't match
- Side panel preview: rendered Markdown view
- URL match auto-select: on side-panel load and on page refresh, the first
  matching template is selected and extracted automatically
- Point-and-click element picker (via `chrome.debugger` + DevTools' own
  inspect-element protocol) driving a standalone "Quick clip" flow — pick an
  element, get its Markdown, upload — with no template involved
- Optional REST API integration (see [Configuration](#configuration)):
  manual template sync ("Sync now") and clip upload ("Upload")

Not yet implemented: highlight-on-type, offline upload retry queue, and
store-listing polish.

## Setup

```
npm install
cp .env.example .env   # then edit .env with your backend's URL, if you have one
npm run build
```

Load the extension in Chrome:

1. Go to `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select the `dist/` folder.
3. Click the Clipcipe toolbar icon to open the side panel.

## Development

```
npm run dev     # vite build --watch — rebuilds dist/ on every source change
npm test        # vitest
npm run build   # full production build (tsc -b && vite build)
```

`npm run dev` does **not** hot-reload the extension itself — after a rebuild,
click the reload icon for Clipcipe on `chrome://extensions`, and reopen the
side panel if you changed anything under `src/sidepanel`.

## Configuration

Template storage and clip upload can optionally talk to a backend implementing
a small REST contract (`GET/POST /templates`, `PUT/DELETE /templates/:id`,
`POST /clips`). Without one configured, templates just stay in local storage
and the "Sync now"/"Upload" actions will show an error.

- `VITE_API_BASE_URL` (`.env`, see `.env.example`) — the backend's base URL.
  Baked in at build time; changing it requires a rebuild.
- API auth token — set at runtime from the side panel's **Settings** view
  (stored in `chrome.storage.local`, not in `.env`, so it can be rotated
  without a rebuild).

## Project layout

```
src/
├─ background/     service worker: side-panel behavior, content-script injection
├─ content/         injected on demand: field extraction, Readability fallback
├─ sidepanel/       the React UI (template list/editor, preview, settings)
└─ lib/             shared, DOM-independent: types, messages, markdown, API client, storage
```
