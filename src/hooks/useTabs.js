import { useState, useEffect, useRef, useMemo } from 'react';
import { classifyTabs, getCategoryColor } from '../utils/categoryClassifier';
import { callLLM } from './useSettings';

export const useTabs = (llmSettings) => {
  const [tabs, setTabs] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [groupingMode, setGroupingMode] = useState('category');
  const groupedTabsRef = useRef([]);
  const originalOrderRef = useRef([]);

  const fetchTabs = async () => {
    try {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      setTabs(allTabs);
    } catch (error) {
      console.error("Error fetching tabs:", error);
    }
  };

  // Load saved preferences
  useEffect(() => {
    chrome.storage.local.get(['groupingMode'], (result) => {
      if (result.groupingMode) {
        setGroupingMode(result.groupingMode);
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
        if (tab.groupId && tab.groupId !== -1) return;
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
        .filter(t => !t.groupId || t.groupId === -1)
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
    originalOrderRef.current = tabs.map(tab => tab.id);

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
      groupedTabsRef.current = grouped;
      setCanUndo(true);
    }

    await fetchTabs();
  };

  const undoGrouping = async () => {
    if (groupedTabsRef.current.length === 0) return;

    try {
      const existingGroupedTabs = [];
      for (const id of groupedTabsRef.current) {
        try {
          const tab = await chrome.tabs.get(id);
          if (tab) existingGroupedTabs.push(id);
        } catch (e) {}
      }

      if (existingGroupedTabs.length > 0) {
        await chrome.tabs.ungroup(existingGroupedTabs);
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      const currentIds = new Set(currentTabs.map(t => t.id));
      const originalOrder = originalOrderRef.current.filter(id => currentIds.has(id));
      
      for (let targetIndex = 0; targetIndex < originalOrder.length; targetIndex++) {
        const tabId = originalOrder[targetIndex];
        try {
          await chrome.tabs.move(tabId, { index: targetIndex });
        } catch (e) {}
      }

    } catch (error) {
      console.error("Error undoing groups:", error);
    } finally {
      groupedTabsRef.current = [];
      originalOrderRef.current = [];
      setCanUndo(false);
      await fetchTabs();
    }
  };

  const [isFocusMode, setIsFocusMode] = useState(false);
  const focusGroupRef = useRef(null);

  // Focus Mode Logic
  const toggleFocusMode = async () => {
    if (isFocusMode) {
      // Turn OFF: Upgrade "Distractions" group if exists
      if (focusGroupRef.current) {
        try {
          // Check if group still exists
          await chrome.tabGroups.get(focusGroupRef.current);
          
          // Get tabs in group
          const tabsInGroup = await chrome.tabs.query({ groupId: focusGroupRef.current });
          const ids = tabsInGroup.map(t => t.id);
          
          if (ids.length > 0) {
            await chrome.tabs.ungroup(ids);
          }
        } catch (e) {
          // Group might have been closed manually
        }
        focusGroupRef.current = null;
      }
      setIsFocusMode(false);
      await fetchTabs();
    } else {
      // Turn ON: Identify and group distractions
      let distractionIds = [];

      try {
        // 1. Try AI if enabled
        if (llmSettings?.apiKey) {
           const tabInfo = tabs
            .filter(t => !t.groupId || t.groupId === -1)
            .map(t => `[${t.id}] ${t.title} (${new URL(t.url).hostname})`)
            .join('\n');

           const prompt = `Identify which of these tabs are likely non-productive DISTRACTIONS (social media, video streaming, entertainment, shopping, random browsing) vs productive work.
Return valid JSON: { "distractionIds": [id1, id2] }
Be strict. If unsure, assume productive.
Tabs:
${tabInfo}`;

            const response = await callLLM(llmSettings, prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[0]);
              distractionIds = data.distractionIds || [];
            }
        } else {
          // 2. Fallback: Keyword/Domain matching
          const blockedDomains = ['youtube.com', 'netflix.com', 'twitch.tv', 'reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'pinterest.com', '9gag.com', 'imdb.com', 'hulu.com', 'disneyplus.com'];
          
          distractionIds = tabs
            .filter(t => !t.groupId || t.groupId === -1)
            .filter(t => {
              try {
                const hostname = new URL(t.url).hostname;
                return blockedDomains.some(d => hostname.includes(d));
              } catch { return false; }
            })
            .map(t => t.id);
        }

        if (distractionIds.length > 0) {
          const groupId = await chrome.tabs.group({ tabIds: distractionIds });
          await chrome.tabGroups.update(groupId, { 
            title: 'Distractions 🚫', 
            collapsed: true,
            color: 'red'
          });
          focusGroupRef.current = groupId;
        }

      } catch (error) {
        console.error("Focus mode error:", error);
      }
      
      setIsFocusMode(true);
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
    hasApiKey: !!llmSettings?.apiKey,
    isFocusMode,
    toggleFocusMode
  };
};
