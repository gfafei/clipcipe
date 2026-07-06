import { marked } from 'marked';

// Rendering-only: turns the already-generated markdown string into HTML for
// the side panel's live preview. The raw markdown string stays the source of
// truth for copy/upload — this is never parsed back into it.
export function renderMarkdownToHtml(markdown: string): string {
  return String(marked.parse(markdown));
}
