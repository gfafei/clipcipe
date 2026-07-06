import { Readability } from '@mozilla/readability';

export interface ReadabilityArticle {
  title: string;
  contentHtml: string;
  textContent: string;
  byline: string | null;
}

// Readability mutates the document it's given while scoring/stripping nodes,
// so it always runs against a clone — never the live page the user is looking
// at. Returns null when Readability can't find an article-shaped region.
export function runReadabilityFallback(doc: Document): ReadabilityArticle | null {
  const clone = doc.cloneNode(true) as Document;
  const article = new Readability(clone).parse();
  if (!article) return null;
  return {
    title: article.title ?? '',
    contentHtml: article.content ?? '',
    textContent: article.textContent ?? '',
    byline: article.byline || null,
  };
}
