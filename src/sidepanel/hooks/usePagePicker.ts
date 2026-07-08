import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandAck, PickerEvent } from '../../lib/messages';
import { getActiveTab } from './useMessaging';

// Drives the debugger-backed element picker (see background/picker.ts) from
// the side panel: starts a pick session on the active tab, listens for the
// (asynchronous, push-style) result, and cleans up if the caller unmounts
// mid-pick. `onPicked` receives the picked element's raw outerHTML.
export function usePagePicker(onPicked: (html: string) => void) {
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const pickingRef = useRef(false);

  useEffect(() => {
    pickingRef.current = picking;
  }, [picking]);

  const cancel = useCallback(() => {
    setPicking(false);
    void chrome.runtime.sendMessage({ type: 'picker/stop' });
  }, []);

  useEffect(() => {
    function handleMessage(message: PickerEvent) {
      if (!pickingRef.current) return;
      if (message.type === 'picker/selected') {
        onPicked(message.html);
        setPicking(false);
      } else if (message.type === 'picker/cancelled') {
        setPickError(message.reason);
        setPicking(false);
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [onPicked]);

  useEffect(() => {
    if (!picking) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [picking, cancel]);

  // Stop any in-flight session if the caller unmounts mid-pick.
  useEffect(() => {
    return () => {
      if (pickingRef.current) void chrome.runtime.sendMessage({ type: 'picker/stop' });
    };
  }, []);

  const start = useCallback(async (): Promise<chrome.tabs.Tab | undefined> => {
    setPickError(null);
    const tab = await getActiveTab().catch((error: unknown) => {
      setPickError(error instanceof Error ? error.message : 'No active tab found.');
      return undefined;
    });
    if (!tab?.id) return undefined;
    if (!/^https?:\/\//.test(tab.url ?? '')) {
      setPickError("Can't pick elements on this kind of page. Open a regular web page and try again.");
      return undefined;
    }

    setPicking(true);
    const response = (await chrome.runtime.sendMessage({ type: 'picker/start', tabId: tab.id })) as CommandAck;
    if (!response?.ok) {
      setPickError(response?.error ?? 'Failed to start picking.');
      setPicking(false);
      return undefined;
    }
    return tab;
  }, []);

  return { picking, pickError, start, cancel };
}
