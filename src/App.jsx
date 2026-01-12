import { useTabs } from './hooks/useTabs';
import './App.css';

// Simple SVG Icons
const Icons = {
  Group: () => <svg className="icon" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="none"/><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" fill="currentColor"/></svg>,
  Undo: () => <svg className="icon" viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" fill="currentColor"/></svg>,
  Trash: () => <svg className="icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>,
  Globe: () => <svg className="icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>,
  AI: () => <svg className="icon" viewBox="0 0 24 24"><path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58s9.14-3.47 12.65 0L21 3v7.12z" fill="currentColor"/></svg>
};

function App() {
  const { tabs, closeTab, autoGroupTabs, undoGrouping, canUndo, sortBy, setSortBy, groupingMode, setGroupingMode, aiAvailable } = useTabs();

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
        <div className="title-row">
          <h1>My Tabs</h1>
          <div className="badge-row">
            <span className="badge">{tabs.length}</span>
            {duplicateTabs.length > 0 && (
                <span className="badge warning">{duplicateTabs.length} Dupes</span>
            )}
          </div>
        </div>

        {/* Mode Selector Row */}
        <div className="mode-row">
          <span className="mode-label">Group by:</span>
          <div className="mode-buttons">
            <button 
              className={`mode-btn ${groupingMode === 'category' ? 'active' : ''}`}
              onClick={() => setGroupingMode('category')}
              title="Group by category (Work, Entertainment, etc.)"
            >
              📁 Category
            </button>
            <button 
              className={`mode-btn ${groupingMode === 'domain' ? 'active' : ''}`}
              onClick={() => setGroupingMode('domain')}
              title="Group by website domain"
            >
              🌐 Domain
            </button>
            <button 
              className={`mode-btn ${groupingMode === 'ai' ? 'active' : ''}`}
              onClick={() => setGroupingMode('ai')}
              title={aiAvailable ? "AI-powered grouping" : "AI not available - will use Category"}
            >
              ✨ AI {!aiAvailable && <span className="badge-small">β</span>}
            </button>
          </div>
        </div>

        <div className="toolbar">
           {canUndo ? (
            <button className="btn" onClick={undoGrouping}>
              <Icons.Undo /> Undo
            </button>
          ) : (
            <button className="btn btn-primary" onClick={autoGroupTabs}>
              {getModeLabel()} Tidy Up
            </button>
          )}

          <div className="select-wrapper">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)} 
              className="sort-select"
            >
              <option value="default">Default</option>
              <option value="title">Name</option>
              <option value="domain">Website</option>
              <option value="recent">Recent</option>
            </select>
            <div className="select-arrow">▼</div>
          </div>

          {duplicateTabs.length > 0 && (
            <button 
              className="btn btn-danger" 
              onClick={() => duplicateTabs.forEach(t => closeTab(t.id))}
              title="Close Duplicates"
            >
              <Icons.Trash />
            </button>
          )}
        </div>
      </div>

      <div className="tab-list">
        {tabs.map((tab) => (
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
    </div>
  );
}

export default App;
