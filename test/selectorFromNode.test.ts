import { describe, expect, it } from 'vitest';
import { attributesFromFlatArray, selectorFromNode } from '../src/lib/selectorFromNode';

describe('selectorFromNode', () => {
  it('prefers a stable id above everything else', () => {
    const selector = selectorFromNode({
      tagName: 'H1',
      attributes: { id: 'article-title', class: 'title css-1a2b3c' },
    });
    expect(selector).toBe('#article-title');
  });

  it('falls back to a stable data/aria attribute when there is no id', () => {
    const selector = selectorFromNode({
      tagName: 'DIV',
      attributes: { 'data-testid': 'article-body' },
    });
    expect(selector).toBe('div[data-testid="article-body"]');
  });

  it('falls back to non-hashed classes when there is no id or stable attribute', () => {
    const selector = selectorFromNode({
      tagName: 'SPAN',
      attributes: { class: 'byline author css-1a2b3c Button_root__x7Yq2' },
    });
    expect(selector).toBe('span.byline.author');
  });

  it('falls back to the bare tag name when nothing stable is found', () => {
    const selector = selectorFromNode({
      tagName: 'ARTICLE',
      attributes: { class: 'css-1a2b3c' },
    });
    expect(selector).toBe('article');
  });

  it('escapes special characters in ids and classes', () => {
    expect(selectorFromNode({ tagName: 'DIV', attributes: { id: '1:col' } })).toBe('#1\\:col');
  });
});

describe('attributesFromFlatArray', () => {
  it('parses a flat name/value array into an object', () => {
    expect(attributesFromFlatArray(['id', 'title', 'class', 'a b'])).toEqual({
      id: 'title',
      class: 'a b',
    });
  });

  it('returns an empty object for undefined input', () => {
    expect(attributesFromFlatArray(undefined)).toEqual({});
  });
});
