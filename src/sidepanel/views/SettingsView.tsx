import { useEffect, useState } from 'react';
import { getAuthToken, setAuthToken } from '../../lib/storage/settingsStore';

interface SettingsViewProps {
  onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getAuthToken().then((stored) => {
      setToken(stored ?? '');
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    await setAuthToken(token.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
        <h2 style={{ fontSize: 16, margin: 0 }}>Settings</h2>
        <button onClick={onBack} style={secondaryButtonStyle}>
          Back
        </button>
      </div>

      <label style={labelStyle}>API auth token</label>
      <input
        type="password"
        style={inputStyle}
        value={token}
        disabled={loading}
        placeholder="Sent as an Authorization: Bearer header"
        onChange={(e) => setToken(e.target.value)}
      />
      <p style={{ fontSize: 11, color: '#777', marginTop: 6 }}>
        The API base URL is fixed at build time via <code>VITE_API_BASE_URL</code> in{' '}
        <code>.env</code> — change it there and rebuild.
      </p>

      <button onClick={handleSave} disabled={loading} style={{ ...primaryButtonStyle, marginTop: 12 }}>
        {saved ? 'Saved!' : 'Save token'}
      </button>
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
