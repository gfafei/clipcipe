// Core domain contracts shared across the extension. These mirror the
// `TemplateDTO` shape documented in PLAN.md so the local-storage layer built in
// Phase 1 can later be swapped for the REST-backed one without changing the UI.

export interface Field {
  key: string;
  // Ordered fallback selectors — first match wins.
  selectors: string[];
  // Nested blocks (ads / related content) stripped before conversion.
  excludeSelectors?: string[];
}

// Two-state local cache marker (see PLAN.md "Local storage"): `modified` means
// there are local edits not yet pushed to the server; `saved` means in sync.
export type SyncStatus = 'saved' | 'modified';

export interface Template {
  id: string;
  name: string;
  urlPattern: string;
  fields: Field[];
  formatterTemplate: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

// A template as authored in the editor, before persistence assigns identity and
// timestamps. Used as the create/update input to the repository.
export type TemplateDraft = Pick<
  Template,
  'name' | 'urlPattern' | 'fields' | 'formatterTemplate'
>;

export function createEmptyField(): Field {
  return { key: '', selectors: [''] };
}

export function createEmptyDraft(): TemplateDraft {
  return {
    name: '',
    urlPattern: '',
    fields: [createEmptyField()],
    formatterTemplate: '',
  };
}

export function draftFromTemplate(template: Template): TemplateDraft {
  return {
    name: template.name,
    urlPattern: template.urlPattern,
    fields: template.fields.map((field) => ({
      key: field.key,
      selectors: [...field.selectors],
      ...(field.excludeSelectors
        ? { excludeSelectors: [...field.excludeSelectors] }
        : {}),
    })),
    formatterTemplate: template.formatterTemplate,
  };
}
