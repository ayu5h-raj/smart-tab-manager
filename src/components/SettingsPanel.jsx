import { useState } from 'react';

export function SettingsPanel({ settings, updateSettings, updateProvider, onClose }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleProviderChange = (provider) => {
    let baseUrl = localSettings.baseUrl;
    let model = localSettings.model;

    if (provider === 'openai') {
      baseUrl = 'https://api.openai.com/v1';
      model = 'gpt-4o-mini';
    } else if (provider === 'anthropic') {
      baseUrl = 'https://api.anthropic.com/v1';
      model = 'claude-3-haiku-20240307';
    }

    setLocalSettings({ ...localSettings, provider, baseUrl, model });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>AI Settings</h2>
          <button className="close-settings" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          <div className="setting-group">
            <label>Provider</label>
            <div className="provider-buttons">
              {['openai', 'anthropic', 'custom'].map(p => (
                <button
                  key={p}
                  className={`provider-btn ${localSettings.provider === p ? 'active' : ''}`}
                  onClick={() => handleProviderChange(p)}
                >
                  {p === 'openai' ? 'OpenAI' : p === 'anthropic' ? 'Anthropic' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <label>Base URL</label>
            <input
              type="text"
              value={localSettings.baseUrl}
              onChange={e => setLocalSettings({ ...localSettings, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div className="setting-group">
            <label>Model</label>
            <input
              type="text"
              value={localSettings.model}
              onChange={e => setLocalSettings({ ...localSettings, model: e.target.value })}
              placeholder="gpt-4o-mini"
            />
          </div>

          <div className="setting-group">
            <label>API Key</label>
            <div className="key-input-row">
              <input
                type={showKey ? 'text' : 'password'}
                value={localSettings.apiKey}
                onChange={e => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                placeholder="sk-..."
              />
              <button 
                className="toggle-key" 
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide' : 'Show'}
              >
                {showKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <p className="settings-note">
            Your API key is stored locally and never sent anywhere except to the configured API endpoint.
          </p>
        </div>

        <div className="settings-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
