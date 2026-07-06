// Discriminated-union message protocol (see PLAN.md "Message protocol").
// Only the extraction slice is defined so far — picker/highlight/sync
// messages get added alongside those features in later phases.
import type { Template } from './types';

// Panel -> Background (chrome.runtime.sendMessage)
export interface EnsureContentScriptInjectedMessage {
  type: 'contentScript/ensureInjected';
  tabId: number;
}

export type BackgroundRequest = EnsureContentScriptInjectedMessage;

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
