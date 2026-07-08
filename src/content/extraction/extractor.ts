import type { Field, Template } from '../../lib/types';
import { renderFormatterTemplate } from '../../lib/markdown/formatter';
import { htmlToMarkdown } from '../../lib/markdown/turndownSetup';
import { runReadabilityFallback } from './readabilityFallback';

export interface FieldResult {
  key: string;
  raw: string | null;
  matchedSelector: string | null;
}

export interface ExtractionResult {
  markdown: string;
  values: Record<string, string>;
  missingFieldKeys: string[];
  usedReadabilityFallback: boolean;
  sourceUrl: string;
}

// Nested ad/related-content blocks are stripped on a clone so the live page
// is never mutated by a preview extraction.
function withExcluded(element: Element, excludeSelectors: string[] | undefined): Element {
  if (!excludeSelectors || excludeSelectors.length === 0) return element;
  const clone = element.cloneNode(true) as Element;
  for (const selector of excludeSelectors) {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  }
  return clone;
}

function extractField(field: Field, root: ParentNode): FieldResult {
  for (const selector of field.selectors) {
    if (!selector) continue;
    let element: Element | null;
    try {
      element = root.querySelector(selector);
    } catch {
      continue; // invalid selector syntax — fall through to the next fallback
    }
    if (!element) continue;

    const scoped = withExcluded(element, field.excludeSelectors);
    return { key: field.key, raw: scoped.innerHTML, matchedSelector: selector };
  }
  return { key: field.key, raw: null, matchedSelector: null };
}

// Readability only ever backfills fields that every one of the template's own
// selectors missed, and only for keys that plausibly mean "title" or
// "body"/"content" — it's a last resort for the fields most likely to make a
// clip useless if empty, not a general substitute for authored selectors.
function fallbackValueForField(
  field: Field,
  article: { title: string; contentHtml: string; textContent: string },
): string | null {
  const key = field.key.toLowerCase();
  if (key === 'title') {
    return article.title || null;
  }
  if (key === 'body' || key === 'content') {
    return article.contentHtml || null;
  }
  return null;
}

export function runExtraction(template: Template, doc: Document = document): ExtractionResult {
  const baseUrl = doc.location?.href ?? doc.baseURI;
  const results = template.fields.map((field) => extractField(field, doc));

  let usedReadabilityFallback = false;
  if (results.some((result) => result.raw === null)) {
    const article = runReadabilityFallback(doc);
    if (article) {
      for (let i = 0; i < results.length; i++) {
        if (results[i].raw !== null) continue;
        const fallback = fallbackValueForField(template.fields[i], article);
        if (fallback !== null) {
          results[i] = { ...results[i], raw: fallback };
          usedReadabilityFallback = true;
        }
      }
    }
  }

  const values: Record<string, string> = {};
  for (let i = 0; i < results.length; i++) {
    const field = template.fields[i];
    const result = results[i];
    if (result.raw === null) continue;
    values[field.key] = htmlToMarkdown(result.raw);
  }

  const missingFieldKeys = results.filter((result) => result.raw === null).map((result) => result.key);
  const markdown = renderFormatterTemplate(template.formatterTemplate, values);

  return { markdown, values, missingFieldKeys, usedReadabilityFallback, sourceUrl: baseUrl };
}
