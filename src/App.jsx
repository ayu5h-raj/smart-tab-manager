import { useState } from 'react';
import { useTabs } from './hooks/useTabs';
import { useSettings } from './hooks/useSettings';
import { SettingsPanel } from './components/SettingsPanel';
import './App.css';

// Simple SVG Icons
const Icons = {
  Group: () => <svg className="icon" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="none"/><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" fill="currentColor"/></svg>,
  Undo: () => <svg className="icon" viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" fill="currentColor"/></svg>,
  Trash: () => <svg className="icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>,
  Globe: () => <svg className="icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>,
  Settings: () => <svg className="icon" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/></svg>
};

function App() {
  const { settings, updateSettings, updateProvider, isLoaded } = useSettings();
  const { tabs, closeTab, autoGroupTabs, undoGrouping, canUndo, sortBy, setSortBy, groupingMode, setGroupingMode, hasApiKey } = useTabs(settings);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tabs by search query
  const filteredTabs = searchQuery.trim()
    ? tabs.filter(tab => 
        tab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tab.url.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabs;

  const handleTidyUp = async () => {
    setIsLoading(true);
    try {
      await autoGroupTabs();
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate duplicates
  const duplicateSet = new Set();
  const urlSet = new Set();
  const duplicateTabs = [];

  tabs.forEach(tab => {
    if (urlSet.has(tab.url)) {
      duplicateSet.add(tab.id);
      duplicateTabs.push(tab);
    } else {
      urlSet.add(tab.url);
    }
  });

  const getDomain = (url) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
  };

  const getModeLabel = () => {
    switch (groupingMode) {
      case 'domain': return '🌐';
      case 'ai': return '✨';
      default: return '📁';
    }
  };

  return (
    <div className="container">
      <div className="header-section">
        {/* Row 1: Title + Stats + Actions */}
        <div className="header-row-1">
          <h1>My Tabs <span className="tab-count">({tabs.length})</span></h1>
          <div className="header-actions">
            {duplicateTabs.length > 0 && (
              <button 
                className="compact-btn danger tooltip" 
                onClick={() => duplicateTabs.forEach(t => closeTab(t.id))}
                data-tip={`Close ${duplicateTabs.length} duplicate(s)`}
              >
                🗑️ {duplicateTabs.length}
              </button>
            )}
            <button 
              className="compact-btn tooltip" 
              onClick={() => setShowSettings(true)}
              data-tip="AI Settings"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-row">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Search tabs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="search-clear" 
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        {/* Row 2: Mode + Tidy Up + Sort */}
        <div className="header-row-2">
          <div className="select-wrapper mode-select">
            <select 
              value={groupingMode} 
              onChange={(e) => setGroupingMode(e.target.value)}
              className="compact-select"
            >
              <option value="category">📁 Category</option>
              <option value="domain">🌐 Domain</option>
              <option value="ai">✨ AI {!hasApiKey ? '⚙️' : ''}</option>
            </select>
          </div>

          {canUndo ? (
            <button className="tidy-btn" onClick={undoGrouping}>
              ↩️ Undo
            </button>
          ) : (
            <button 
              className="tidy-btn primary" 
              onClick={handleTidyUp}
              disabled={isLoading}
            >
              {isLoading ? '⏳' : '✨'} {isLoading ? 'Working...' : 'Tidy Up'}
            </button>
          )}

          <div className="select-wrapper">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)} 
              className="compact-select"
            >
              <option value="default">Default</option>
              <option value="title">A-Z</option>
              <option value="domain">Site</option>
              <option value="recent">Recent</option>
            </select>
          </div>
        </div>
      </div>

      <div className="tab-list">
        {filteredTabs.map((tab) => (
          <div 
            key={tab.id} 
            className={`tab-item ${tab.active ? 'active' : ''} ${duplicateSet.has(tab.id) ? 'duplicate' : ''}`}
            onClick={() => chrome.tabs.update(tab.id, { active: true })}
          >
            {tab.favIconUrl ? (
                <img src={tab.favIconUrl} alt="" className="favicon" />
            ) : (
                <div className="favicon-wrapper"><Icons.Globe /></div>
            )}
            
            <div className="tab-info">
                <div className="tab-title" title={tab.title}>{tab.title}</div>
                <div className="tab-domain">{getDomain(tab.url)}</div>
            </div>

            <button 
                className="close-btn" 
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                title="Close tab"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {showSettings && (
        <SettingsPanel 
          settings={settings}
          updateSettings={updateSettings}
          updateProvider={updateProvider}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
