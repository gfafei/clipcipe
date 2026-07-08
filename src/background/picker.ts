// Element picking, built on chrome.debugger + the Chrome DevTools Protocol
// instead of a hand-rolled content-script overlay — Overlay.setInspectMode
// with mode "searchForNode" is the exact hover-highlight/click picker DevTools
// itself uses, including piercing shadow DOM/iframes, which querySelectorAll
// from a content script cannot do. Trade-off: attaching shows Chrome's
// persistent "is debugging this browser" infobar, and only one debugger
// client (this or real DevTools) can attach to a tab at a time.
import type { CommandAck } from '../lib/messages';
import { attributesFromFlatArray, selectorFromNode } from '../lib/selectorFromNode';

// At most one picking session runs at a time — starting a new one implicitly
// cancels whatever was running before.
let activeTabId: number | null = null;

async function disableInspectMode(tabId: number): Promise<void> {
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Overlay.setInspectMode', { mode: 'none' });
  } catch {
    // tab may already be gone — nothing to clean up
  }
}

async function detach(tabId: number): Promise<void> {
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // already detached
  }
}

export async function stopPicking(): Promise<void> {
  const tabId = activeTabId;
  if (tabId === null) return;
  activeTabId = null;
  await disableInspectMode(tabId);
  await detach(tabId);
}

export async function startPicking(tabId: number): Promise<CommandAck> {
  await stopPicking();

  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'DOM.enable');
    await chrome.debugger.sendCommand({ tabId }, 'Overlay.enable');
    await chrome.debugger.sendCommand({ tabId }, 'Overlay.setInspectMode', {
      mode: 'searchForNode',
      highlightConfig: {
        showInfo: true,
        contentColor: { r: 111, g: 168, b: 220, a: 0.35 },
        borderColor: { r: 66, g: 133, b: 244, a: 0.8 },
      },
    });
    activeTabId = tabId;
    return { ok: true };
  } catch (error) {
    await detach(tabId);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

interface DescribeNodeResult {
  node: { nodeName: string; attributes?: string[] };
}

function notifyPanel(event: { type: 'picker/selected'; selector: string } | { type: 'picker/cancelled'; reason: string }) {
  // No listener (side panel closed) just means this rejects — nothing to do about it.
  void chrome.runtime.sendMessage(event).catch(() => {});
}

async function handleInspectNodeRequested(tabId: number, backendNodeId: number): Promise<void> {
  try {
    const result = (await chrome.debugger.sendCommand({ tabId }, 'DOM.describeNode', {
      backendNodeId,
    })) as unknown as DescribeNodeResult;
    const selector = selectorFromNode({
      tagName: result.node.nodeName,
      attributes: attributesFromFlatArray(result.node.attributes),
    });
    await stopPicking();
    notifyPanel({ type: 'picker/selected', selector });
  } catch (error) {
    await stopPicking();
    notifyPanel({
      type: 'picker/cancelled',
      reason: error instanceof Error ? error.message : 'Failed to resolve the picked element.',
    });
  }
}

// Registered synchronously at module load — see the top-level-listener note
// in background/index.ts.
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (source.tabId == null || source.tabId !== activeTabId) return;
  if (method === 'Overlay.inspectNodeRequested') {
    const { backendNodeId } = params as unknown as { backendNodeId: number };
    void handleInspectNodeRequested(source.tabId, backendNodeId);
  }
});

// Fires when the debugger session ends for a reason we didn't initiate
// ourselves — most commonly the user closing Chrome's "is debugging this
// browser" infobar, or the tab navigating/closing. Our own stopPicking()
// calls above already null out activeTabId before detaching, so this only
// ever matches an externally-triggered detach.
chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId == null || source.tabId !== activeTabId) return;
  activeTabId = null;
  notifyPanel({ type: 'picker/cancelled', reason });
});
