import { useState, useEffect } from 'react';

const DEFAULT_SETTINGS = {
  provider: 'openai', // 'openai' | 'anthropic' | 'custom'
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKey: ''
};

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['llmSettings'], (result) => {
      if (result.llmSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.llmSettings });
      }
      setIsLoaded(true);
    });
  }, []);

  const updateSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    chrome.storage.local.set({ llmSettings: updated });
  };

  const updateProvider = (provider) => {
    let baseUrl = settings.baseUrl;
    let model = settings.model;

    // Set defaults based on provider
    if (provider === 'openai') {
      baseUrl = 'https://api.openai.com/v1';
      model = 'gpt-4o-mini';
    } else if (provider === 'anthropic') {
      baseUrl = 'https://api.anthropic.com/v1';
      model = 'claude-3-haiku-20240307';
    }

    updateSettings({ provider, baseUrl, model });
  };

  return { settings, updateSettings, updateProvider, isLoaded };
}

export async function callLLM(settings, prompt) {
  if (!settings.apiKey) {
    throw new Error('API key not configured');
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  let body;
  let endpoint = settings.baseUrl;

  if (settings.provider === 'anthropic') {
    headers['x-api-key'] = settings.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    endpoint = `${settings.baseUrl}/messages`;
    
    body = JSON.stringify({
      model: settings.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });
  } else {
    // OpenAI-compatible (works for OpenAI, OpenRouter, local LLMs, etc.)
    headers['Authorization'] = `Bearer ${settings.apiKey}`;
    endpoint = `${settings.baseUrl}/chat/completions`;
    
    body = JSON.stringify({
      model: settings.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024
    });
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract text from response
  if (settings.provider === 'anthropic') {
    return data.content[0].text;
  } else {
    return data.choices[0].message.content;
  }
}
