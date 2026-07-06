import { describe, expect, it } from 'vitest';
import { findMatchingTemplate, isPatternSafe, matchesUrl } from '../src/lib/urlMatcher';
import type { Template } from '../src/lib/types';

function template(overrides: Partial<Template>): Template {
  return {
    id: overrides.id ?? 'id',
    name: overrides.name ?? 'name',
    matchRule: overrides.matchRule ?? { type: 'glob', pattern: '*' },
    priority: overrides.priority ?? 0,
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
    expect(matchesUrl({ type: 'glob', pattern: 'https://example.com/blog/*' }, 'https://example.com/blog/post-1')).toBe(true);
    expect(matchesUrl({ type: 'glob', pattern: 'https://example.com/blog/*' }, 'https://other.com/blog/post-1')).toBe(false);
  });

  it('matches a regex pattern', () => {
    expect(matchesUrl({ type: 'regex', pattern: '^https://example\\.com/\\d+$' }, 'https://example.com/123')).toBe(true);
    expect(matchesUrl({ type: 'regex', pattern: '^https://example\\.com/\\d+$' }, 'https://example.com/abc')).toBe(false);
  });

  it('rejects an unsafe (catastrophic-backtracking-shaped) regex', () => {
    expect(matchesUrl({ type: 'regex', pattern: '(a+)+$' }, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!')).toBe(false);
  });

  it('rejects an invalid regex instead of throwing', () => {
    expect(matchesUrl({ type: 'regex', pattern: '(unterminated' }, 'https://example.com')).toBe(false);
  });
});

describe('isPatternSafe', () => {
  it('flags overly long patterns as unsafe', () => {
    expect(isPatternSafe({ type: 'regex', pattern: 'a'.repeat(501) })).toBe(false);
  });

  it('treats glob patterns as always safe', () => {
    expect(isPatternSafe({ type: 'glob', pattern: '(a+)+' })).toBe(true);
  });
});

describe('findMatchingTemplate', () => {
  it('picks the highest-priority match among multiple candidates', () => {
    const low = template({ id: 'low', matchRule: { type: 'glob', pattern: '*example.com*' }, priority: 1 });
    const high = template({ id: 'high', matchRule: { type: 'glob', pattern: '*example.com/blog/*' }, priority: 5 });
    const result = findMatchingTemplate([low, high], 'https://example.com/blog/post-1');
    expect(result?.id).toBe('high');
  });

  it('resolves equal-priority ties to the first template in the input array', () => {
    const first = template({ id: 'first', matchRule: { type: 'glob', pattern: '*example.com*' }, priority: 3 });
    const second = template({ id: 'second', matchRule: { type: 'glob', pattern: '*example.com*' }, priority: 3 });
    const result = findMatchingTemplate([first, second], 'https://example.com/anything');
    expect(result?.id).toBe('first');
  });

  it('returns undefined when nothing matches', () => {
    const t = template({ matchRule: { type: 'glob', pattern: '*only-this-site.com*' } });
    expect(findMatchingTemplate([t], 'https://example.com')).toBeUndefined();
  });
});
