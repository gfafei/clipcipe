import { useCallback, useMemo, useRef, useState } from 'react';
import { htmlToMarkdown } from '../../lib/markdown/turndownSetup';
import { renderMarkdownToHtml } from '../../lib/markdown/markdownPreview';
import { uploadClip } from '../../lib/api/clips';
import { usePagePicker } from '../hooks/usePagePicker';

interface QuickClipViewProps {
  onBack: () => void;
}

interface Picked {
  markdown: string;
  sourceUrl: string;
}

export function QuickClipView({ onBack }: QuickClipViewProps) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pendingTabRef = useRef<chrome.tabs.Tab | undefined>(undefined);

  const handlePicked = useCallback((html: string) => {
    const tab = pendingTabRef.current;
    setPicked({ markdown: htmlToMarkdown(html), sourceUrl: tab?.url ?? '' });
    setTitle(tab?.title ?? '');
    setUploaded(false);
    setUploadError(null);
  }, []);
  const { picking, pickError, start, cancel } = usePagePicker(handlePicked);

  async function handlePick() {
    const tab = await start();
    pendingTabRef.current = tab;
  }

  const renderedHtml = useMemo(() => (picked ? renderMarkdownToHtml(picked.markdown) : ''), [picked]);

  async function handleUpload() {
    if (!picked) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadClip({
        markdown: picked.markdown,
        sourceUrl: picked.sourceUrl,
        title: title || 'Untitled',
        clippedAt: new Date().toISOString(),
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
        <h2 style={{ fontSize: 16, margin: 0 }}>Quick clip</h2>
        <button onClick={onBack} style={secondaryButtonStyle}>
          Back
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={handlePick} disabled={picking} style={primaryButtonStyle}>
          {picking ? 'Picking…' : 'Pick element'}
        </button>
        {picked && (
          <button onClick={handleUpload} disabled={uploading} style={secondaryButtonStyle}>
            {uploading ? 'Uploading…' : uploaded ? 'Uploaded!' : 'Upload'}
          </button>
        )}
      </div>

      {pickError && <div style={errorStyle}>{pickError}</div>}
      {uploadError && <div style={errorStyle}>{uploadError}</div>}

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
          <span>Click an element in the page to clip it — Esc to cancel</span>
          <button onClick={cancel} style={{ ...linkButtonStyle, color: '#174ea6' }}>
            Cancel
          </button>
        </div>
      )}

      {picked && (
        <>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <label style={{ ...labelStyle, marginBottom: 4 }}>Markdown preview</label>
          <style>{markdownPreviewCss}</style>
          <div
            className="clipcipe-markdown-preview"
            style={previewBoxStyle}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  fontSize: 13,
  border: '1px solid #ccc',
  borderRadius: 4,
};

const fieldGroupStyle: React.CSSProperties = { marginBottom: 14 };

const errorStyle: React.CSSProperties = {
  background: '#fdecea',
  color: '#b71c1c',
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

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#1a73e8',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
};

const previewBoxStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 200,
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
