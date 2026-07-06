// This script is injected on demand via chrome.scripting.executeScript, not
// statically declared in the manifest (see permissions strategy in the plan).
// The idempotency guard matters because the side panel may request injection
// more than once per tab session.
import type { ContentScriptRequest, ContentScriptResponse } from '../lib/messages';
import { runExtraction } from './extraction/extractor';

declare global {
  interface Window {
    __clipcipeInjected?: boolean;
  }
}

if (!window.__clipcipeInjected) {
  window.__clipcipeInjected = true;

  chrome.runtime.onMessage.addListener(
    (message: ContentScriptRequest, _sender, sendResponse: (response: ContentScriptResponse) => void) => {
      if (message.type !== 'extract/run') return undefined;

      try {
        const result = runExtraction(message.template, document);
        sendResponse({ type: 'extract/result', ...result });
      } catch (error) {
        sendResponse({
          type: 'extract/error',
          message: error instanceof Error ? error.message : 'Extraction failed.',
        });
      }
      return undefined; // response sent synchronously above, no async channel needed
    },
  );
}
