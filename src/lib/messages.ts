// Discriminated-union message protocol (see PLAN.md "Message protocol").

import type { Template } from './types';

// Panel -> Background (chrome.runtime.sendMessage)
export interface EnsureContentScriptInjectedMessage {
  type: 'contentScript/ensureInjected';
  tabId: number;
}

// Starts an element-picking session on the given tab via the debugger
// protocol (see background/picker.ts) — the response only acknowledges the
// session started; the picked element's HTML arrives later as a separate
// push message (PickerSelectedMessage), since the user's click can come long
// after this call returns.
export interface PickerStartMessage {
  type: 'picker/start';
  tabId: number;
}

// Ends whichever picking session is currently active, if any. Safe to send
// even if no session is active (a no-op in that case).
export interface PickerStopMessage {
  type: 'picker/stop';
}

export type BackgroundRequest = EnsureContentScriptInjectedMessage | PickerStartMessage | PickerStopMessage;

export interface CommandAck {
  ok: boolean;
  error?: string;
}

// Background -> Panel (chrome.runtime.sendMessage, pushed whenever the
// active picking session ends, successfully or not). `html` is the picked
// element's outerHTML — the panel converts it to Markdown itself (via
// Turndown, which needs a real DOM the service worker doesn't have).
export interface PickerSelectedMessage {
  type: 'picker/selected';
  html: string;
}

export interface PickerCancelledMessage {
  type: 'picker/cancelled';
  reason: string;
}

export type PickerEvent = PickerSelectedMessage | PickerCancelledMessage;

// Panel -> Content script (chrome.tabs.sendMessage, background bypassed)
export interface ExtractRunMessage {
  type: 'extract/run';
  template: Template;
}

export type ContentScriptRequest = ExtractRunMessage;

export interface ExtractResultMessage {
  type: 'extract/result';
  markdown: string;
  values: Record<string, string>;
  missingFieldKeys: string[];
  usedReadabilityFallback: boolean;
  sourceUrl: string;
}

export interface ExtractErrorMessage {
  type: 'extract/error';
  message: string;
}

export type ContentScriptResponse = ExtractResultMessage | ExtractErrorMessage;
