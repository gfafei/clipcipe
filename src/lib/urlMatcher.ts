import type { Template } from './types';

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export function matchesUrl(pattern: string, url: string): boolean {
  if (!pattern) return false;
  return globToRegExp(pattern).test(url);
}

// First matching template in the input array wins.
export function findMatchingTemplate(templates: Template[], url: string): Template | undefined {
  return templates.find((template) => matchesUrl(template.urlPattern, url));
}
