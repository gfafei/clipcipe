import type { MatchRule, Template } from './types';

// Best-effort guard, not a formal proof of linear-time matching: catches the
// classic catastrophic-backtracking shape (a quantified group that itself
// contains a quantifier, e.g. `(a+)+`) and caps pattern length. A user-authored
// regex match rule that hits this is rejected outright rather than risking a
// hang on every tab-refresh check.
const NESTED_QUANTIFIER = /\([^()]*[+*][^()]*\)[+*]/;
const MAX_PATTERN_LENGTH = 500;

export function isPatternSafe(rule: MatchRule): boolean {
  if (!rule.pattern || rule.pattern.length > MAX_PATTERN_LENGTH) return false;
  if (rule.type !== 'regex') return true;
  if (NESTED_QUANTIFIER.test(rule.pattern)) return false;
  try {
    new RegExp(rule.pattern);
    return true;
  } catch {
    return false;
  }
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export function matchesUrl(rule: MatchRule, url: string): boolean {
  if (!isPatternSafe(rule)) return false;
  try {
    const regExp = rule.type === 'glob' ? globToRegExp(rule.pattern) : new RegExp(rule.pattern);
    return regExp.test(url);
  } catch {
    return false;
  }
}

// Highest priority wins. Ties resolve to whichever template comes first in
// the input array — Array#sort is spec-guaranteed stable, and PLAN.md's save
// flow is expected to reject/warn on identical-priority overlapping patterns,
// so a tie here should be rare in practice.
export function findMatchingTemplate(templates: Template[], url: string): Template | undefined {
  return templates
    .filter((template) => matchesUrl(template.matchRule, url))
    .sort((a, b) => b.priority - a.priority)[0];
}
