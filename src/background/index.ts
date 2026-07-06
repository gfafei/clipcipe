// Listeners must be registered synchronously at the top level — a message or
// event that wakes a terminated service worker must never be missed because
// registration was deferred inside an async init function.
import type { BackgroundRequest } from '../lib/messages';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Failed to set side panel behavior', error));
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundRequest, _sender, sendResponse: (response: { ok: boolean; error?: string }) => void) => {
    if (message.type !== 'contentScript/ensureInjected') return undefined;

    chrome.scripting
      .executeScript({ target: { tabId: message.tabId }, files: ['content.js'] })
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      );
    return true; // keep the message channel open for the async executeScript response
  },
);
