import { useCallback, useState } from 'react';
import { createEmptyField, type Field, type TemplateDraft } from '../../lib/types';
import { useElementPicker, type PickTarget } from '../hooks/useElementPicker';

interface TemplateEditorViewProps {
  initialDraft: TemplateDraft;
  title: string;
  onSave: (draft: TemplateDraft) => Promise<void>;
  onCancel: () => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  color: '#333',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  fontSize: 13,
  border: '1px solid #ccc',
  borderRadius: 4,
};

const fieldGroupStyle: React.CSSProperties = { marginBottom: 14 };

export function TemplateEditorView({
  initialDraft,
  title,
  onSave,
  onCancel,
}: TemplateEditorViewProps) {
  const [draft, setDraft] = useState<TemplateDraft>(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(partial: Partial<TemplateDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function updateField(index: number, partial: Partial<Field>) {
    setDraft((current) => {
      const fields = current.fields.map((field, i) =>
        i === index ? { ...field, ...partial } : field,
      );
      return { ...current, fields };
    });
  }

  function updateSelector(fieldIndex: number, selectorIndex: number, value: string) {
    setDraft((current) => {
      const fields = current.fields.map((field, i) => {
        if (i !== fieldIndex) return field;
        const selectors = field.selectors.map((selector, s) =>
          s === selectorIndex ? value : selector,
        );
        return { ...field, selectors };
      });
      return { ...current, fields };
    });
  }

  function addSelector(fieldIndex: number) {
    setDraft((current) => {
      const fields = current.fields.map((field, i) =>
        i === fieldIndex ? { ...field, selectors: [...field.selectors, ''] } : field,
      );
      return { ...current, fields };
    });
  }

  function removeSelector(fieldIndex: number, selectorIndex: number) {
    setDraft((current) => {
      const fields = current.fields.map((field, i) => {
        if (i !== fieldIndex) return field;
        const selectors = field.selectors.filter((_, s) => s !== selectorIndex);
        return { ...field, selectors: selectors.length ? selectors : [''] };
      });
      return { ...current, fields };
    });
  }

  const handlePicked = useCallback((target: PickTarget, selector: string) => {
    updateSelector(target.fieldIndex, target.selectorIndex, selector);
  }, []);
  const { picking, pickError, start: startPicking, cancel: cancelPicking } = useElementPicker(handlePicked);

  function addField() {
    patch({ fields: [...draft.fields, createEmptyField()] });
  }

  function removeField(index: number) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.filter((_, i) => i !== index),
    }));
  }

  function normalize(input: TemplateDraft): TemplateDraft {
    return {
      ...input,
      name: input.name.trim(),
      urlPattern: input.urlPattern.trim(),
      fields: input.fields.map((field) => ({
        ...field,
        key: field.key.trim(),
        selectors: field.selectors.map((selector) => selector.trim()).filter(Boolean),
      })),
    };
  }

  function validate(input: TemplateDraft): string | null {
    if (!input.name) return 'Template name is required.';
    if (!input.urlPattern) return 'A URL match pattern is required.';
    if (input.fields.length === 0) return 'Add at least one field.';
    for (const field of input.fields) {
      if (!field.key) return 'Every field needs a key.';
      if (field.selectors.length === 0) {
        return `Field "${field.key}" needs at least one selector.`;
      }
    }
    const keys = input.fields.map((field) => field.key);
    if (new Set(keys).size !== keys.length) {
      return 'Field keys must be unique.';
    }
    return null;
  }

  async function handleSave() {
    const normalized = normalize(draft);
    const validationError = validate(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(normalized);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save.');
      setSaving(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>{title}</h2>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Cancel
        </button>
      </div>

      {error && (
        <div
          style={{
            background: '#fdecea',
            color: '#b71c1c',
            padding: '8px 10px',
            borderRadius: 4,
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {pickError && (
        <div
          style={{
            background: '#fdecea',
            color: '#b71c1c',
            padding: '8px 10px',
            borderRadius: 4,
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {pickError}
        </div>
      )}

      {picking && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#e8f0fe',
            color: '#174ea6',
            padding: '8px 10px',
            borderRadius: 4,
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <span>Click an element in the page to select it — Esc to cancel</span>
          <button onClick={cancelPicking} style={{ ...linkButtonStyle, color: '#174ea6' }}>
            Cancel
          </button>
        </div>
      )}

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Name</label>
        <input
          style={inputStyle}
          value={draft.name}
          placeholder="e.g. Example Blog Article"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>URL pattern (glob)</label>
        <input
          style={inputStyle}
          value={draft.urlPattern}
          placeholder="https://example.com/blog/*"
          onChange={(e) => patch({ urlPattern: e.target.value })}
        />
      </div>

      <div style={fieldGroupStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <label style={{ ...labelStyle, marginBottom: 0 }}>Fields</label>
          <button onClick={addField} style={secondaryButtonStyle}>
            + Field
          </button>
        </div>

        {draft.fields.map((field, fieldIndex) => (
          <div
            key={fieldIndex}
            style={{
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              padding: 10,
              marginBottom: 10,
              background: '#fafafa',
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Key</label>
              <input
                style={inputStyle}
                value={field.key}
                placeholder="title"
                onChange={(e) => updateField(fieldIndex, { key: e.target.value })}
              />
            </div>

            <label style={labelStyle}>Selectors (first match wins)</label>
            {field.selectors.map((selector, selectorIndex) => (
              <div
                key={selectorIndex}
                style={{ display: 'flex', gap: 6, marginBottom: 6 }}
              >
                <input
                  style={inputStyle}
                  value={selector}
                  placeholder="h1.article-title"
                  onChange={(e) =>
                    updateSelector(fieldIndex, selectorIndex, e.target.value)
                  }
                />
                <button
                  onClick={() => startPicking({ fieldIndex, selectorIndex })}
                  disabled={!!picking}
                  style={iconButtonStyle}
                  title="Pick an element on the page"
                >
                  {picking?.fieldIndex === fieldIndex && picking?.selectorIndex === selectorIndex
                    ? '…'
                    : '⌖'}
                </button>
                <button
                  onClick={() => removeSelector(fieldIndex, selectorIndex)}
                  style={iconButtonStyle}
                  title="Remove selector"
                >
                  ×
                </button>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <button onClick={() => addSelector(fieldIndex)} style={linkButtonStyle}>
                + Selector
              </button>
              {draft.fields.length > 1 && (
                <button
                  onClick={() => removeField(fieldIndex)}
                  style={{ ...linkButtonStyle, color: '#b71c1c' }}
                >
                  Remove field
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Formatter template</label>
        <textarea
          style={{ ...inputStyle, minHeight: 120, fontFamily: 'monospace' }}
          value={draft.formatterTemplate}
          placeholder={'# {{title}}\n\nBy {{author}}\n\n{{body}}'}
          onChange={(e) => patch({ formatterTemplate: e.target.value })}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? 'Saving…' : 'Save template'}
        </button>
        <button onClick={onCancel} style={secondaryButtonStyle} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  background: '#1a73e8',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  background: '#fff',
  color: '#333',
  border: '1px solid #ccc',
  padding: '6px 12px',
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
};

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#1a73e8',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
};

const iconButtonStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #ccc',
  borderRadius: 4,
  width: 30,
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: '1',
};
