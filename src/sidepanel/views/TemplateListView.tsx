import type { Template } from '../../lib/types';

interface TemplateListViewProps {
  templates: Template[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  onExtract: (template: Template) => void;
  onSync: () => void;
  syncing: boolean;
  syncMessage: string | null;
  onOpenSettings: () => void;
}

export function TemplateListView({
  templates,
  loading,
  onAdd,
  onEdit,
  onDelete,
  onExtract,
  onSync,
  syncing,
  syncMessage,
  onOpenSettings,
}: TemplateListViewProps) {
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
        <h1 style={{ fontSize: 18, margin: 0 }}>Templates</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onOpenSettings} style={secondaryButtonStyle}>
            Settings
          </button>
          <button onClick={onSync} disabled={syncing} style={secondaryButtonStyle}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button onClick={onAdd} style={primaryButtonStyle}>
            + New
          </button>
        </div>
      </div>

      {syncMessage && <div style={noteStyle}>{syncMessage}</div>}

      {loading ? (
        <p style={{ color: '#777', fontSize: 13 }}>Loading…</p>
      ) : templates.length === 0 ? (
        <div
          style={{
            border: '1px dashed #ccc',
            borderRadius: 6,
            padding: 24,
            textAlign: 'center',
            color: '#777',
            fontSize: 13,
          }}
        >
          No templates yet. Click <strong>+ New</strong> to create one.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {templates.map((template) => (
            <li
              key={template.id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: 6,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{template.name}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#777',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace' }}>{template.urlPattern}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                    {template.fields.length} field
                    {template.fields.length === 1 ? '' : 's'}
                    {template.syncStatus === 'modified' && (
                      <span style={{ color: '#e37400' }}> · unsynced</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => onExtract(template)} style={secondaryButtonStyle}>
                    Extract
                  </button>
                  <button onClick={() => onEdit(template)} style={secondaryButtonStyle}>
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(template)}
                    style={{ ...secondaryButtonStyle, color: '#b71c1c' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
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
  padding: '5px 10px',
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
};

const noteStyle: React.CSSProperties = {
  background: '#e8f0fe',
  color: '#174ea6',
  padding: '8px 10px',
  borderRadius: 4,
  fontSize: 12,
  marginBottom: 12,
};
