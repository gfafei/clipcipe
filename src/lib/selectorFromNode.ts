// Builds a CSS selector string from a picked DOM node's tag name and
// attributes. Kept DOM-independent (no `document`/`CSS.escape`) since the
// picker resolves nodes via the debugger protocol from the background
// service worker, which has no DOM APIs available.

export interface PickedNode {
  tagName: string; // as returned by CDP's DOM.describeNode, e.g. "DIV"
  attributes: Record<string, string>;
}

// Preference order for a selector that survives page re-renders: a stable id
// wins outright; failing that, data/aria attributes meant to be stable
// hooks; failing that, non-hashed classes; tag name alone is the last resort.
const STABLE_ATTRIBUTES = ['data-testid', 'aria-label', 'itemprop', 'name'];

// Best-effort heuristic for CSS-in-JS/build-hashed classnames — not
// exhaustive, just enough to skip the obviously unstable ones in favor of a
// plainer alternative. Covers emotion/styled-components' `css-<hash>` and CSS
// Modules' `<Component>_<class>__<hash>` conventions.
const HASHED_CLASS = /^css-[a-z0-9]+$|__[a-zA-Z0-9]+$/i;

function escapeIdent(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function escapeAttrValue(value: string): string {
  return value.replace(/["\\]/g, (ch) => `\\${ch}`);
}

export function selectorFromNode(node: PickedNode): string {
  const tag = node.tagName.toLowerCase();
  const { id, class: classAttr } = node.attributes;

  if (id) return `#${escapeIdent(id)}`;

  for (const attr of STABLE_ATTRIBUTES) {
    const value = node.attributes[attr];
    if (value) return `${tag}[${attr}="${escapeAttrValue(value)}"]`;
  }

  if (classAttr) {
    const classes = classAttr
      .split(/\s+/)
      .filter(Boolean)
      .filter((cls) => !HASHED_CLASS.test(cls));
    if (classes.length > 0) return `${tag}.${classes.map(escapeIdent).join('.')}`;
  }

  return tag;
}

// CDP's DOM.describeNode returns attributes as a flat [name, value, name, value, ...] array.
export function attributesFromFlatArray(flat: string[] | undefined): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (!flat) return attributes;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    attributes[flat[i]] = flat[i + 1];
  }
  return attributes;
}
