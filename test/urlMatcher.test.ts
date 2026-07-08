import { describe, expect, it } from 'vitest';
import { findMatchingTemplate, matchesUrl } from '../src/lib/urlMatcher';
import type { Template } from '../src/lib/types';

function template(overrides: Partial<Template>): Template {
  return {
    id: overrides.id ?? 'id',
    name: overrides.name ?? 'name',
    urlPattern: overrides.urlPattern ?? '*',
    fields: overrides.fields ?? [],
    formatterTemplate: overrides.formatterTemplate ?? '',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'saved',
    ...overrides,
  };
}

describe('matchesUrl', () => {
  it('matches a glob pattern with a wildcard suffix', () => {
    expect(matchesUrl('https://example.com/blog/*', 'https://example.com/blog/post-1')).toBe(true);
    expect(matchesUrl('https://example.com/blog/*', 'https://other.com/blog/post-1')).toBe(false);
  });

  it('rejects an empty pattern', () => {
    expect(matchesUrl('', 'https://example.com')).toBe(false);
  });
});

describe('findMatchingTemplate', () => {
  it('picks the first template whose pattern matches', () => {
    const nonMatching = template({ id: 'no-match', urlPattern: '*only-this-site.com*' });
    const matching = template({ id: 'match', urlPattern: '*example.com/blog/*' });
    const result = findMatchingTemplate([nonMatching, matching], 'https://example.com/blog/post-1');
    expect(result?.id).toBe('match');
  });

  it('resolves multiple matches to whichever comes first in the input array', () => {
    const first = template({ id: 'first', urlPattern: '*example.com*' });
    const second = template({ id: 'second', urlPattern: '*example.com*' });
    const result = findMatchingTemplate([first, second], 'https://example.com/anything');
    expect(result?.id).toBe('first');
  });

  it('returns undefined when nothing matches', () => {
    const t = template({ urlPattern: '*only-this-site.com*' });
    expect(findMatchingTemplate([t], 'https://example.com')).toBeUndefined();
  });
});
