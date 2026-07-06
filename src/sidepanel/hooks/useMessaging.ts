import type {
  BackgroundRequest,
  ContentScriptResponse,
  ExtractResultMessage,
} from '../../lib/messages';
import type { Template } from '../../lib/types';
import { ensureOriginPermission } from '../../lib/permissions';

// Requires the "tabs" permission (see manifest) — without it, `url` comes
// back redacted/undefined for tabs the extension has no host permission for
// yet, which is exactly the case this function needs to distinguish.
export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error('No active tab found.');
  return tab;
}

// `activeTab` only covers the tab that was active the moment the extension
// icon was clicked. Once the side panel is open, the user can freely switch
// tabs — at that point the newly active tab has no grant, so
// scripting.executeScript fails with "Cannot access contents of the page."
// We request `optional_host_permissions` for this tab's origin explicitly.
// `chrome.permissions.request` only succeeds during a user gesture — a manual
// "Extract" click has one, an automatic on-load/on-refresh attempt doesn't,
// so `auto` picks which error message to surface when it's not already granted.
async function ensureHostPermission(url: string, auto: boolean): Promise<void> {
  if (!/^https?:\/\//.test(url)) {
    throw new Error("Can't extract from this kind of page. Open a regular web page and try again.");
  }
  try {
    await ensureOriginPermission(url);
  } catch {
    throw new Error(
      auto
        ? 'This site needs one-time permission — click "Extract from active tab" to grant it.'
        : 'Permission to access this page was denied.',
    );
  }
}

async function ensureContentScriptInjected(tabId: number): Promise<void> {
  const request: BackgroundRequest = { type: 'contentScript/ensureInjected', tabId };
  const response: { ok: boolean; error?: string } = await chrome.runtime.sendMessage(request);
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Failed to inject content script.');
  }
}

// Extraction talks to the content script directly (background is only used to
// inject it on demand) — see the message-protocol note in PLAN.md. `auto`
// distinguishes a user-clicked extraction from an automatic one for the sake
// of the permission-denied error message only (see ensureHostPermission).
export async function extractOnActiveTab(
  template: Template,
  options: { auto?: boolean } = {},
): Promise<ExtractResultMessage> {
  const tab = await getActiveTab();
  await ensureHostPermission(tab.url!, options.auto ?? false);
  await ensureContentScriptInjected(tab.id!);

  const response: ContentScriptResponse = await chrome.tabs.sendMessage(tab.id!, {
    type: 'extract/run',
    template,
  });

  if (response.type === 'extract/error') {
    throw new Error(response.message);
  }
  return response;
}

// Fires `onRefresh` when the tab that's active in this side panel's window
// finishes loading (covers both a manual reload and a same-tab navigation) —
// this is how "auto-select on page refresh" is implemented, since Chrome has
// no direct "active tab's page refreshed" event.
export function watchActiveTabRefresh(onRefresh: (tab: chrome.tabs.Tab) => void): () => void {
  const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (changeInfo.status !== 'complete' || !tab.active) return;
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([currentTab]) => {
      if (currentTab?.id === tabId) onRefresh(currentTab);
    });
  };
  chrome.tabs.onUpdated.addListener(listener);
  return () => chrome.tabs.onUpdated.removeListener(listener);
}
