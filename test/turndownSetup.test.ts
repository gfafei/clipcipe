import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../src/lib/markdown/turndownSetup';

describe('htmlToMarkdown', () => {
  it('preserves inline formatting nested inside a selector match', () => {
    const html = '<span><b>this is strong</b><h2>this is head two</h2></span>';
    const markdown = htmlToMarkdown(html);

    expect(markdown).toContain('**this is strong**');
    expect(markdown).toContain('## this is head two');
  });

  it('returns an empty string for whitespace-only html', () => {
    expect(htmlToMarkdown('   ')).toBe('');
  });
});
