// Renders a template's `formatterTemplate` by substituting `{{key}}` with the
// corresponding extracted field value. Missing fields render as an empty
// string rather than throwing — a partially-matched page should still produce
// a best-effort preview instead of blocking on one missing selector.
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

export function renderFormatterTemplate(
  formatterTemplate: string,
  values: Record<string, string>,
): string {
  return formatterTemplate.replace(PLACEHOLDER_PATTERN, (_match, key: string) => values[key] ?? '');
}
