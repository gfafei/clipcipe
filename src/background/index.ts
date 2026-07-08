// Listeners must be registered synchronously at the top level — a message or
// event that wakes a terminated service worker must never be missed because
// registration was deferred inside an async init function.
import type { BackgroundRequest, CommandAck } from '../lib/messages';
import { startPicking, stopPicking } from './picker';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Failed to set side panel behavior', error));
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundRequest, _sender, sendResponse: (response: CommandAck) => void) => {
    if (message.type === 'contentScript/ensureInjected') {
      chrome.scripting
        .executeScript({ target: { tabId: message.tabId }, files: ['content.js'] })
        .then(() => sendResponse({ ok: true }))
        .catch((error) =>
          sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
        );
      return true; // keep the message channel open for the async executeScript response
    }

    if (message.type === 'picker/start') {
      void startPicking(message.tabId).then(sendResponse);
      return true;
    }

    if (message.type === 'picker/stop') {
      void stopPicking().then(() => sendResponse({ ok: true }));
      return true;
    }

    return undefined;
  },
);
