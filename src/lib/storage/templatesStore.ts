import type { Template, TemplateDraft } from '../types';

// The UI depends only on this async interface, never on where templates live.
// Phase 1 ships `LocalTemplateRepository` (chrome.storage.local); a later phase
// swaps in an API-backed implementation with the same shape — see PLAN.md.
export interface TemplateRepository {
  list(): Promise<Template[]>;
  get(id: string): Promise<Template | undefined>;
  create(draft: TemplateDraft): Promise<Template>;
  update(id: string, draft: TemplateDraft): Promise<Template>;
  remove(id: string): Promise<void>;
  // Writes an already-complete Template as-is (inserting if its id is new) —
  // used by template sync to persist server-shaped records without the
  // id/timestamp/syncStatus generation that `create`/`update` apply.
  replace(template: Template): Promise<void>;
}

const STORAGE_KEY = 'clipcipe:templates';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  // crypto.randomUUID is available in the extension (secure) context.
  return crypto.randomUUID();
}

// Persists templates as a JSON array under a single storage key. Kept simple and
// last-write-wins; conflict handling is a server-sync concern, not a local one.
export class LocalTemplateRepository implements TemplateRepository {
  async list(): Promise<Template[]> {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const templates = stored[STORAGE_KEY];
    return Array.isArray(templates) ? (templates as Template[]) : [];
  }

  async get(id: string): Promise<Template | undefined> {
    const templates = await this.list();
    return templates.find((template) => template.id === id);
  }

  async create(draft: TemplateDraft): Promise<Template> {
    const templates = await this.list();
    const timestamp = nowIso();
    const template: Template = {
      ...draft,
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      // New local templates start "modified" so the next server sync pushes them.
      syncStatus: 'modified',
    };
    await this.persist([...templates, template]);
    return template;
  }

  async update(id: string, draft: TemplateDraft): Promise<Template> {
    const templates = await this.list();
    const index = templates.findIndex((template) => template.id === id);
    if (index === -1) {
      throw new Error(`Template not found: ${id}`);
    }
    const updated: Template = {
      ...templates[index],
      ...draft,
      updatedAt: nowIso(),
      syncStatus: 'modified',
    };
    const next = [...templates];
    next[index] = updated;
    await this.persist(next);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const templates = await this.list();
    await this.persist(templates.filter((template) => template.id !== id));
  }

  async replace(template: Template): Promise<void> {
    const templates = await this.list();
    const index = templates.findIndex((t) => t.id === template.id);
    const next =
      index === -1
        ? [...templates, template]
        : templates.map((t, i) => (i === index ? template : t));
    await this.persist(next);
  }

  private async persist(templates: Template[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: templates });
  }
}

// Single shared instance used by the side panel. Swap this line to change the
// backing store app-wide.
export const templateRepository: TemplateRepository = new LocalTemplateRepository();
