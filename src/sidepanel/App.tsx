import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createEmptyDraft,
  draftFromTemplate,
  type Template,
  type TemplateDraft,
} from '../lib/types';
import type { ExtractResultMessage } from '../lib/messages';
import { templateRepository } from '../lib/storage/templatesStore';
import { extractOnActiveTab, getActiveTab, watchActiveTabRefresh } from './hooks/useMessaging';
import { findMatchingTemplate } from '../lib/urlMatcher';
import { syncTemplates } from '../lib/sync/templateSync';
import { TemplateListView } from './views/TemplateListView';
import { TemplateEditorView } from './views/TemplateEditorView';
import { PreviewView } from './views/PreviewView';
import { SettingsView } from './views/SettingsView';
import { QuickClipView } from './views/QuickClipView';

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; template: Template }
  | { kind: 'preview'; template: Template }
  | { kind: 'settings' }
  | { kind: 'quickClip' };

export function App() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ kind: 'list' });

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<ExtractResultMessage | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const loaded = await templateRepository.list();
    setTemplates(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = useCallback(
    async (draft: TemplateDraft) => {
      await templateRepository.create(draft);
      await refresh();
      setView({ kind: 'list' });
    },
    [refresh],
  );

  const handleUpdate = useCallback(
    async (id: string, draft: TemplateDraft) => {
      await templateRepository.update(id, draft);
      await refresh();
      setView({ kind: 'list' });
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (template: Template) => {
      if (!confirm(`Delete template "${template.name}"?`)) return;
      await templateRepository.remove(template.id);
      await refresh();
    },
    [refresh],
  );

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncTemplates();
      await refresh();
      setSyncMessage(`Synced — pulled ${result.pulled}, pushed ${result.pushed}.`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? `Sync failed: ${error.message}` : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const handleExtract = useCallback(async (template: Template, options: { auto?: boolean } = {}) => {
    setExtractResult(null);
    setExtractError(null);
    setExtracting(true);
    try {
      const result = await extractOnActiveTab(template, options);
      setExtractResult(result);
    } catch (error) {
      setExtractError(error instanceof Error ? error.message : 'Extraction failed.');
    } finally {
      setExtracting(false);
    }
  }, []);

  const openPreview = useCallback(
    (template: Template) => {
      setExtractResult(null);
      setExtractError(null);
      setView({ kind: 'preview', template });
      void handleExtract(template);
    },
    [handleExtract],
  );

  // Auto-select: on initial side-panel load and on every subsequent reload of
  // the active tab's page, jump straight to the preview for whichever
  // template's match rule wins for that URL and run extraction immediately.
  // Refs (not state) back this so the effect registers its listener exactly
  // once instead of re-subscribing whenever `templates`/`view` change.
  const templatesRef = useRef(templates);
  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const tryAutoMatch = useCallback(
    async (tab?: chrome.tabs.Tab) => {
      // Don't yank the user out of an in-progress create/edit to show a preview.
      if (viewRef.current.kind === 'create' || viewRef.current.kind === 'edit') return;
      const activeTab = tab ?? (await getActiveTab().catch(() => undefined));
      if (!activeTab?.url) return;
      const matched = findMatchingTemplate(templatesRef.current, activeTab.url);
      if (!matched) return;
      setExtractResult(null);
      setExtractError(null);
      setView({ kind: 'preview', template: matched });
      void handleExtract(matched, { auto: true });
    },
    [handleExtract],
  );

  // `loading` also flips true→false after every create/update/delete refresh,
  // not just the first one — guard so this only ever fires for the initial
  // side-panel load, per the "extension first loads" requirement.
  const initialMatchRanRef = useRef(false);
  useEffect(() => {
    if (loading || initialMatchRanRef.current) return;
    initialMatchRanRef.current = true;
    void tryAutoMatch();
  }, [loading, tryAutoMatch]);

  useEffect(() => watchActiveTabRefresh((tab) => void tryAutoMatch(tab)), [tryAutoMatch]);

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif', color: '#202124' }}>
      {view.kind === 'list' && (
        <TemplateListView
          templates={templates}
          loading={loading}
          onAdd={() => setView({ kind: 'create' })}
          onEdit={(template) => setView({ kind: 'edit', template })}
          onDelete={handleDelete}
          onExtract={openPreview}
          onSync={handleSync}
          syncing={syncing}
          syncMessage={syncMessage}
          onOpenSettings={() => setView({ kind: 'settings' })}
          onQuickClip={() => setView({ kind: 'quickClip' })}
        />
      )}

      {view.kind === 'settings' && <SettingsView onBack={() => setView({ kind: 'list' })} />}

      {view.kind === 'quickClip' && <QuickClipView onBack={() => setView({ kind: 'list' })} />}

      {view.kind === 'create' && (
        <TemplateEditorView
          title="New template"
          initialDraft={createEmptyDraft()}
          onSave={handleCreate}
          onCancel={() => setView({ kind: 'list' })}
        />
      )}

      {view.kind === 'edit' && (
        <TemplateEditorView
          title="Edit template"
          initialDraft={draftFromTemplate(view.template)}
          onSave={(draft) => handleUpdate(view.template.id, draft)}
          onCancel={() => setView({ kind: 'list' })}
        />
      )}

      {view.kind === 'preview' && (
        <PreviewView
          template={view.template}
          loading={extracting}
          error={extractError}
          result={extractResult}
          onExtract={() => handleExtract(view.template)}
          onBack={() => setView({ kind: 'list' })}
        />
      )}
    </div>
  );
}
