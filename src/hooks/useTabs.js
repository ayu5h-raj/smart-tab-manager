import { useState, useEffect, useMemo } from 'react';
import { classifyTabs, getCategoryColor } from '../utils/categoryClassifier';
import { callLLM } from './useSettings';

const UNDO_EXPIRY_MS = 30 * 1000; // 30 seconds

export const useTabs = (llmSettings) => {
  const [tabs, setTabs] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [groupingMode, setGroupingMode] = useState('category');
  const [undoSnapshot, setUndoSnapshot] = useState(null);

  const fetchTabs = async () => {
    try {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      setTabs(allTabs);
    } catch (error) {
      console.error("Error fetching tabs:", error);
    }
  };

  // Load saved preferences AND undo snapshot
  useEffect(() => {
    chrome.storage.local.get(['groupingMode', 'undoSnapshot'], (result) => {
      if (result.groupingMode) {
        setGroupingMode(result.groupingMode);
      }
      // Check if snapshot exists and is not expired
      if (result.undoSnapshot) {
        const age = Date.now() - result.undoSnapshot.timestamp;
        if (age < UNDO_EXPIRY_MS) {
          setUndoSnapshot(result.undoSnapshot);
          setCanUndo(true);
        } else {
          // Expired, clear it
          chrome.storage.local.remove('undoSnapshot');
        }
      }
    });
  }, []);

  const updateGroupingMode = (mode) => {
    setGroupingMode(mode);
    chrome.storage.local.set({ groupingMode: mode });
  };

  useEffect(() => {
    fetchTabs();

    const handleTabChange = () => fetchTabs();
    
    chrome.tabs.onUpdated.addListener(handleTabChange);
    chrome.tabs.onCreated.addListener(handleTabChange);
    chrome.tabs.onRemoved.addListener(handleTabChange);
    chrome.tabs.onMoved.addListener(handleTabChange);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabChange);
      chrome.tabs.onCreated.removeListener(handleTabChange);
      chrome.tabs.onRemoved.removeListener(handleTabChange);
      chrome.tabs.onMoved.removeListener(handleTabChange);
    };
  }, []);

  const sortedTabs = useMemo(() => {
    const sorted = [...tabs];
    
    switch (sortBy) {
      case 'title':
        return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      case 'domain':
        return sorted.sort((a, b) => {
          try {
            const domainA = new URL(a.url).hostname;
            const domainB = new URL(b.url).hostname;
            return domainA.localeCompare(domainB);
          } catch {
            return 0;
          }
        });
      case 'recent':
        return sorted.sort((a, b) => b.index - a.index);
      default:
        return sorted;
    }
  }, [tabs, sortBy]);

  const closeTab = async (tabId) => {
    await chrome.tabs.remove(tabId);
  };

  const groupTabsWithColor = async (tabIds, title, color = 'grey') => {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { title, color });
    return groupId;
  };

  // Group by domain
  const groupByDomain = async () => {
    const domains = {};
    
    tabs.forEach(tab => {
      try {
        const url = new URL(tab.url);
        const domain = url.hostname.replace('www.', '');
        if (!domains[domain]) domains[domain] = [];
        domains[domain].push(tab.id);
      } catch (e) {}
    });

    const grouped = [];
    for (const [domain, tabIds] of Object.entries(domains)) {
      if (tabIds.length > 1) {
        await groupTabsWithColor(tabIds, domain);
        grouped.push(...tabIds);
      }
    }
    return grouped;
  };

  // Group by category
  const groupByCategory = async () => {
    const categoryGroups = classifyTabs(tabs);
    const grouped = [];
    
    for (const [category, tabIds] of Object.entries(categoryGroups)) {
      if (tabIds.length > 1) {
        const color = getCategoryColor(category);
        await groupTabsWithColor(tabIds, category, color);
        grouped.push(...tabIds);
      }
    }
    return grouped;
  };

  // Group using LLM API
  const groupByAI = async () => {
    if (!llmSettings?.apiKey) {
      console.warn('LLM API key not configured, falling back to category mode');
      return groupByCategory();
    }

    try {
      const tabInfo = tabs
        .map(t => `[${t.id}] ${t.title}`)
        .join('\n');
      
      const prompt = `Categorize these browser tabs into logical groups. Return ONLY valid JSON.
Format: {"GroupName": [tab_ids], ...}
Use 3-6 groups max. Be concise with group names (1-2 words).
Tab IDs are integers, include them as numbers not strings.

Tabs:
${tabInfo}`;

      const response = await callLLM(llmSettings, prompt);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid AI response');
      
      const groups = JSON.parse(jsonMatch[0]);
      const grouped = [];
      
      for (const [groupName, tabIds] of Object.entries(groups)) {
        const validIds = tabIds.filter(id => tabs.some(t => t.id === id));
        if (validIds.length > 1) {
          await groupTabsWithColor(validIds, groupName);
          grouped.push(...validIds);
        }
      }
      
      return grouped;
    } catch (error) {
      console.error('AI grouping failed:', error);
      return groupByCategory();
    }
  };

  // Main grouping function
  const autoGroupTabs = async () => {
    // Get existing group metadata BEFORE ungrouping
    let groupMetadata = {};
    try {
      const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      groups.forEach(g => {
        groupMetadata[g.id] = { title: g.title || '', color: g.color || 'grey' };
      });
    } catch (e) {
      console.warn("Failed to get group metadata:", e);
    }

    // Save full snapshot BEFORE grouping
    const snapshot = {
      tabs: tabs.map(tab => ({
        id: tab.id,
        groupId: tab.groupId || -1,
        index: tab.index
      })),
      groups: groupMetadata,  // { groupId: { title, color } }
      timestamp: Date.now()
    };
    
    // Persist to storage
    await chrome.storage.local.set({ undoSnapshot: snapshot });
    setUndoSnapshot(snapshot);

    // Ungroup all currently grouped tabs first (so they can be regrouped cleanly)
    const groupedTabIds = tabs
      .filter(t => t.groupId && t.groupId !== -1)
      .map(t => t.id);
    
    if (groupedTabIds.length > 0) {
      try {
        await chrome.tabs.ungroup(groupedTabIds);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for Chrome to process
      } catch (e) {
        console.warn("Failed to ungroup existing tabs:", e);
      }
    }

    let grouped = [];
    
    switch (groupingMode) {
      case 'domain':
        grouped = await groupByDomain();
        break;
      case 'ai':
        grouped = await groupByAI();
        break;
      case 'category':
      default:
        grouped = await groupByCategory();
        break;
    }

    if (grouped.length > 0) {
      setCanUndo(true);
    }

    await fetchTabs();
  };

  const undoGrouping = async () => {
    if (!undoSnapshot || !undoSnapshot.tabs) return;

    try {
      // First, ungroup ALL tabs that are currently in groups
      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      const groupedTabIds = currentTabs
        .filter(t => t.groupId && t.groupId !== -1)
        .map(t => t.id);
      
      if (groupedTabIds.length > 0) {
        await chrome.tabs.ungroup(groupedTabIds);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Now restore original groups
      // Group tabs by their original groupId
      const groupMap = {}; // { originalGroupId: [tabIds] }
      
      for (const snapTab of undoSnapshot.tabs) {
        // Check if tab still exists
        try {
          await chrome.tabs.get(snapTab.id);
        } catch {
          continue; // Tab was closed, skip
        }
        
        if (snapTab.groupId !== -1) {
          if (!groupMap[snapTab.groupId]) {
            groupMap[snapTab.groupId] = [];
          }
          groupMap[snapTab.groupId].push(snapTab.id);
        }
      }

      // Recreate groups with original titles and colors
      const groupMetadata = undoSnapshot.groups || {};
      
      for (const [originalGroupId, tabIds] of Object.entries(groupMap)) {
        if (tabIds.length > 0) {
          try {
            const newGroupId = await chrome.tabs.group({ tabIds });
            
            // Restore original title and color if we have metadata
            const meta = groupMetadata[originalGroupId];
            if (meta) {
              await chrome.tabGroups.update(newGroupId, {
                title: meta.title,
                color: meta.color
              });
            }
          } catch (e) {
            console.warn("Failed to restore group:", e);
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Restore original positions
      const currentTabsNow = await chrome.tabs.query({ currentWindow: true });
      const currentIds = new Set(currentTabsNow.map(t => t.id));
      
      // Sort by original index
      const sortedSnapshot = [...undoSnapshot.tabs]
        .filter(t => currentIds.has(t.id))
        .sort((a, b) => a.index - b.index);
      
      for (let i = 0; i < sortedSnapshot.length; i++) {
        try {
          await chrome.tabs.move(sortedSnapshot[i].id, { index: i });
        } catch (e) {}
      }

    } catch (error) {
      console.error("Error undoing groups:", error);
    } finally {
      // Clear snapshot
      await chrome.storage.local.remove('undoSnapshot');
      setUndoSnapshot(null);
      setCanUndo(false);
      await fetchTabs();
    }
  };

  return { 
    tabs: sortedTabs, 
    closeTab, 
    autoGroupTabs, 
    undoGrouping, 
    canUndo,
    sortBy,
    setSortBy,
    groupingMode,
    setGroupingMode: updateGroupingMode,
    hasApiKey: !!llmSettings?.apiKey
  };
};
