import { useState } from 'react';

export function SettingsPanel({ settings, updateSettings, onClose }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleProviderChange = (provider) => {
    // Save current settings (including API key) for the current provider before switching
    const updatedProviderSettings = {
      ...localSettings.providerSettings,
      [localSettings.provider]: {
        baseUrl: localSettings.baseUrl,
        model: localSettings.model,
        apiKey: localSettings.apiKey
      }
    };

    // Get settings for new provider (either saved or defaults)
    let newBaseUrl, newModel, newApiKey;
    
    if (updatedProviderSettings[provider]) {
      // Restore saved settings for this provider
      newBaseUrl = updatedProviderSettings[provider].baseUrl;
      newModel = updatedProviderSettings[provider].model;
      newApiKey = updatedProviderSettings[provider].apiKey || '';
    } else {
      // Use defaults (API Key always starts empty for new providers)
      newApiKey = '';
      if (provider === 'openai') {
        newBaseUrl = 'https://api.openai.com/v1';
        newModel = 'gpt-4o-mini';
      } else if (provider === 'anthropic') {
        newBaseUrl = 'https://api.anthropic.com/v1';
        newModel = 'claude-3-haiku-20240307';
      } else if (provider === 'gemini') {
        newBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
        newModel = 'gemini-1.5-flash';
      } else if (provider === 'openrouter') {
        newBaseUrl = 'https://openrouter.ai/api/v1';
        newModel = 'openai/gpt-3.5-turbo';
      } else {
        newBaseUrl = '';
        newModel = '';
      }
    }

    setLocalSettings({
      ...localSettings,
      provider,
      baseUrl: newBaseUrl,
      model: newModel,
      apiKey: newApiKey,
      providerSettings: updatedProviderSettings
    });
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
            <div className="select-wrapper">
              <select
                className="compact-select provider-select"
                value={localSettings.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
                <option value="openrouter">OpenRouter</option>
                <option value="custom">Custom</option>
              </select>
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
