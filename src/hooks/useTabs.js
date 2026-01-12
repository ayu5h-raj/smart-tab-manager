import { useState, useEffect, useRef, useMemo } from 'react';

export const useTabs = () => {
  const [tabs, setTabs] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const groupedTabsRef = useRef([]);
  const originalOrderRef = useRef([]); // Store ALL tabs order before grouping

  const fetchTabs = async () => {
    try {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      setTabs(allTabs);
    } catch (error) {
      console.error("Error fetching tabs:", error);
    }
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

  const groupTabs = async (tabIds, title = "New Group") => {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { title });
    return groupId;
  };

  const autoGroupTabs = async () => {
    // Save original order of ALL tabs (by ID sequence)
    originalOrderRef.current = tabs.map(tab => tab.id);

    const domains = {};
    const tabsToGroup = [];

    tabs.forEach(tab => {
      try {
        if (tab.groupId && tab.groupId !== -1) return;
        
        const url = new URL(tab.url);
        const domain = url.hostname.replace('www.', '');
        if (!domains[domain]) domains[domain] = [];
        domains[domain].push(tab.id);
      } catch (e) {}
    });

    for (const [domain, tabIds] of Object.entries(domains)) {
      if (tabIds.length > 1) {
        await groupTabs(tabIds, domain);
        tabsToGroup.push(...tabIds);
      }
    }

    if (tabsToGroup.length > 0) {
      groupedTabsRef.current = tabsToGroup;
      setCanUndo(true);
    }

    await fetchTabs();
  };

  const undoGrouping = async () => {
    if (groupedTabsRef.current.length === 0) return;

    try {
      // Step 1: Ungroup all tabs
      const existingGroupedTabs = [];
      for (const id of groupedTabsRef.current) {
        try {
          const tab = await chrome.tabs.get(id);
          if (tab) existingGroupedTabs.push(id);
        } catch (e) {
          // Tab closed, ignore
        }
      }

      if (existingGroupedTabs.length > 0) {
        await chrome.tabs.ungroup(existingGroupedTabs);
      }

      // Step 2: Wait for ungroup to settle
      await new Promise(resolve => setTimeout(resolve, 150));

      // Step 3: Restore order by moving tabs one by one
      // Filter to only tabs that still exist
      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      const currentIds = new Set(currentTabs.map(t => t.id));
      
      // Get the original order, but only for tabs that still exist
      const originalOrder = originalOrderRef.current.filter(id => currentIds.has(id));
      
      // Move each tab to its target position (starting from index 0)
      for (let targetIndex = 0; targetIndex < originalOrder.length; targetIndex++) {
        const tabId = originalOrder[targetIndex];
        try {
          await chrome.tabs.move(tabId, { index: targetIndex });
        } catch (e) {
          console.warn('Could not move tab:', tabId, e);
        }
      }

    } catch (error) {
      console.error("Error undoing groups:", error);
    } finally {
      // Always reset state
      groupedTabsRef.current = [];
      originalOrderRef.current = [];
      setCanUndo(false);
      await fetchTabs();
    }
  };

  return { 
    tabs: sortedTabs, 
    closeTab, 
    groupTabs, 
    autoGroupTabs, 
    undoGrouping, 
    canUndo,
    sortBy,
    setSortBy
  };
};
