import { useMemo, useState } from 'react';
import type { ExtractResultMessage } from '../../lib/messages';
import type { Template } from '../../lib/types';
import { renderMarkdownToHtml } from '../../lib/markdown/markdownPreview';
import { uploadClip } from '../../lib/api/clips';

interface PreviewViewProps {
  template: Template;
  loading: boolean;
  error: string | null;
  result: ExtractResultMessage | null;
  onExtract: () => void;
  onBack: () => void;
}

export function PreviewView({ template, loading, error, result, onExtract, onBack }: PreviewViewProps) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'preview' | 'source'>('preview');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const renderedHtml = useMemo(
    () => (result ? renderMarkdownToHtml(result.markdown) : ''),
    [result],
  );

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleUpload() {
    if (!result) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadClip({
        markdown: result.markdown,
        sourceUrl: result.sourceUrl,
        title: result.values.title || template.name,
        clippedAt: new Date().toISOString(),
        templateId: template.id,
        fields: result.values,
        metadata: { extensionVersion: chrome.runtime.getManifest().version },
      });
      setUploaded(true);
      setTimeout(() => setUploaded(false), 1500);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
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
        <h2 style={{ fontSize: 16, margin: 0 }}>Extract: {template.name}</h2>
        <button onClick={onBack} style={secondaryButtonStyle}>
          Back
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onExtract} disabled={loading} style={primaryButtonStyle}>
          {loading ? 'Extracting…' : 'Extract from active tab'}
        </button>
        {result && (
          <button onClick={handleCopy} style={secondaryButtonStyle}>
            {copied ? 'Copied!' : 'Copy markdown'}
          </button>
        )}
        {result && (
          <button onClick={handleUpload} disabled={uploading} style={secondaryButtonStyle}>
            {uploading ? 'Uploading…' : uploaded ? 'Uploaded!' : 'Upload to server'}
          </button>
        )}
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

      {uploadError && (
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
          {uploadError}
        </div>
      )}

      {result && (
        <>
          {result.usedReadabilityFallback && (
            <div style={noteStyle}>
              Some fields used the Readability fallback because their selectors didn't match.
            </div>
          )}
          {result.missingFieldKeys.length > 0 && (
            <div style={{ ...noteStyle, color: '#b71c1c', background: '#fdecea' }}>
              No match for: {result.missingFieldKeys.join(', ')}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Markdown preview</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setTab('preview')}
                style={tab === 'preview' ? tabButtonActiveStyle : tabButtonStyle}
              >
                Preview
              </button>
              <button
                onClick={() => setTab('source')}
                style={tab === 'source' ? tabButtonActiveStyle : tabButtonStyle}
              >
                Source
              </button>
            </div>
          </div>

          {tab === 'preview' ? (
            <>
              <style>{markdownPreviewCss}</style>
              <div
                className="clipcipe-markdown-preview"
                style={previewBoxStyle}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </>
          ) : (
            <textarea
              readOnly
              value={result.markdown}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 260,
                fontFamily: 'monospace',
                fontSize: 12,
                padding: 8,
                border: '1px solid #ccc',
                borderRadius: 4,
              }}
            />
          )}

          <label style={{ ...labelStyle, marginTop: 12 }}>Extracted fields</label>
          <div style={{ border: '1px solid #e0e0e0', borderRadius: 6 }}>
            {Object.entries(result.values).map(([key, value], i) => (
              <div
                key={key}
                style={{
                  padding: '6px 10px',
                  borderTop: i === 0 ? undefined : '1px solid #eee',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600 }}>{key}</div>
                <div
                  style={{
                    color: '#555',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 80,
                    overflow: 'auto',
                  }}
                >
                  {value || <em style={{ color: '#999' }}>(empty)</em>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  color: '#333',
};

const noteStyle: React.CSSProperties = {
  background: '#e8f0fe',
  color: '#174ea6',
  padding: '8px 10px',
  borderRadius: 4,
  fontSize: 12,
  marginBottom: 12,
};

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

const tabButtonStyle: React.CSSProperties = {
  background: '#fff',
  color: '#555',
  border: '1px solid #ccc',
  padding: '3px 10px',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
};

const tabButtonActiveStyle: React.CSSProperties = {
  ...tabButtonStyle,
  background: '#e8f0fe',
  color: '#174ea6',
  borderColor: '#174ea6',
};

const previewBoxStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 260,
  maxHeight: 400,
  overflow: 'auto',
  fontSize: 13,
  padding: '8px 12px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
};

// Scoped to .clipcipe-markdown-preview so it only styles rendered-markdown
// output, never the rest of the side panel's own UI.
const markdownPreviewCss = `
.clipcipe-markdown-preview h1, .clipcipe-markdown-preview h2, .clipcipe-markdown-preview h3 {
  margin: 12px 0 6px;
  line-height: 1.3;
}
.clipcipe-markdown-preview h1 { font-size: 20px; }
.clipcipe-markdown-preview h2 { font-size: 17px; }
.clipcipe-markdown-preview h3 { font-size: 14px; }
.clipcipe-markdown-preview p { margin: 8px 0; line-height: 1.5; }
.clipcipe-markdown-preview ul, .clipcipe-markdown-preview ol { margin: 8px 0; padding-left: 22px; }
.clipcipe-markdown-preview li { margin: 2px 0; }
.clipcipe-markdown-preview blockquote {
  margin: 8px 0;
  padding: 2px 10px;
  border-left: 3px solid #ccc;
  color: #555;
}
.clipcipe-markdown-preview code {
  background: #f1f3f4;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
.clipcipe-markdown-preview pre {
  background: #f1f3f4;
  padding: 8px;
  border-radius: 4px;
  overflow: auto;
}
.clipcipe-markdown-preview pre code { background: none; padding: 0; }
.clipcipe-markdown-preview img { max-width: 100%; }
.clipcipe-markdown-preview a { color: #1a73e8; }
`;
