import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommandAck, PickerEvent } from '../../lib/messages';
import { getActiveTab } from './useMessaging';

export interface PickTarget {
  fieldIndex: number;
  selectorIndex: number;
}

// Drives the debugger-backed element picker (see background/picker.ts) from
// the side panel: tracks which selector input a pick is destined for, listens
// for the (asynchronous, push-style) result, and cleans up if the editor
// unmounts mid-pick.
export function useElementPicker(onPicked: (target: PickTarget, selector: string) => void) {
  const [picking, setPicking] = useState<PickTarget | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const pickingRef = useRef<PickTarget | null>(null);

  useEffect(() => {
    pickingRef.current = picking;
  }, [picking]);

  const cancel = useCallback(() => {
    setPicking(null);
    void chrome.runtime.sendMessage({ type: 'picker/stop' });
  }, []);

  useEffect(() => {
    function handleMessage(message: PickerEvent) {
      if (!pickingRef.current) return;
      if (message.type === 'picker/selected') {
        onPicked(pickingRef.current, message.selector);
        setPicking(null);
      } else if (message.type === 'picker/cancelled') {
        setPickError(message.reason);
        setPicking(null);
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

  // Stop any in-flight session if the editor unmounts mid-pick.
  useEffect(() => {
    return () => {
      if (pickingRef.current) void chrome.runtime.sendMessage({ type: 'picker/stop' });
    };
  }, []);

  const start = useCallback(async (target: PickTarget) => {
    setPickError(null);
    const tab = await getActiveTab().catch((error: unknown) => {
      setPickError(error instanceof Error ? error.message : 'No active tab found.');
      return undefined;
    });
    if (!tab?.id) return;
    if (!/^https?:\/\//.test(tab.url ?? '')) {
      setPickError("Can't pick elements on this kind of page. Open a regular web page and try again.");
      return;
    }

    setPicking(target);
    const response = (await chrome.runtime.sendMessage({ type: 'picker/start', tabId: tab.id })) as CommandAck;
    if (!response?.ok) {
      setPickError(response?.error ?? 'Failed to start picking.');
      setPicking(null);
    }
  }, []);

  return { picking, pickError, start, cancel };
}
