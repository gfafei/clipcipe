import TurndownService from 'turndown';

// Single shared instance — Turndown's config (rules, options) is process-wide
// and stateless per conversion, so there's no reason to construct it per call.
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  return turndownService.turndown(html).trim();
}
