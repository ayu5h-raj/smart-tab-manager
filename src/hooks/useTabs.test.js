/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTabs } from '../hooks/useTabs';

describe('useTabs Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear storage before each test
    chrome.storage.local.get.mockImplementation((keys, cb) => cb({}));
    chrome.storage.local.set.mockImplementation((data) => Promise.resolve());
    chrome.storage.local.remove.mockImplementation((key) => Promise.resolve());
  });

  describe('Duplicate Detection', () => {
    it('should identify duplicate tabs', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com', title: 'Example 1' },
        { id: 2, url: 'https://example.com', title: 'Example 2' },
        { id: 3, url: 'https://google.com', title: 'Google' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(3);
      });

      // Calculate duplicates similar to App.jsx
      const urlSet = new Set();
      const duplicates = [];
      result.current.tabs.forEach(tab => {
        if (urlSet.has(tab.url)) duplicates.push(tab);
        else urlSet.add(tab.url);
      });

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].id).toBe(2);
    });
  });

  describe('Tab Sorting', () => {
    it('should sort tabs alphabetically by title', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com', title: 'Zebra', index: 0 },
        { id: 2, url: 'https://example.com', title: 'Apple', index: 1 },
        { id: 3, url: 'https://example.com', title: 'Middle', index: 2 },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(3);
      });

      act(() => {
        result.current.setSortBy('title');
      });

      expect(result.current.tabs[0].title).toBe('Apple');
      expect(result.current.tabs[1].title).toBe('Middle');
      expect(result.current.tabs[2].title).toBe('Zebra');
    });

    it('should sort tabs by domain', async () => {
      const mockTabs = [
        { id: 1, url: 'https://zebra.com', title: 'Z' },
        { id: 2, url: 'https://apple.com', title: 'A' },
        { id: 3, url: 'https://middle.com', title: 'M' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(3);
      });

      act(() => {
        result.current.setSortBy('domain');
      });

      expect(result.current.tabs[0].url).toBe('https://apple.com');
      expect(result.current.tabs[1].url).toBe('https://middle.com');
      expect(result.current.tabs[2].url).toBe('https://zebra.com');
    });
  });

  describe('Tidy Up (autoGroupTabs)', () => {
    it('should save snapshot to storage before grouping', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com/a', title: 'A', groupId: -1, index: 0 },
        { id: 2, url: 'https://example.com/b', title: 'B', groupId: -1, index: 1 },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(100);
      chrome.tabGroups.update.mockResolvedValue({});

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(2);
      });

      await act(async () => {
        await result.current.autoGroupTabs();
      });

      // Verify snapshot was saved
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          undoSnapshot: expect.objectContaining({
            tabs: expect.arrayContaining([
              expect.objectContaining({ id: 1, groupId: -1, index: 0 }),
              expect.objectContaining({ id: 2, groupId: -1, index: 1 }),
            ]),
            timestamp: expect.any(Number),
          }),
        })
      );
    });

    it('should skip tabs already in groups', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com/a', title: 'A', groupId: 50, index: 0 },  // Already grouped
        { id: 2, url: 'https://example.com/b', title: 'B', groupId: -1, index: 1 },
        { id: 3, url: 'https://example.com/c', title: 'C', groupId: -1, index: 2 },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(100);
      chrome.tabGroups.update.mockResolvedValue({});

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(3);
      });

      await act(async () => {
        await result.current.autoGroupTabs();
      });

      // Tab 1 (already grouped) should not be included in new group
      const groupCall = chrome.tabs.group.mock.calls[0];
      expect(groupCall[0].tabIds).not.toContain(1);
      expect(groupCall[0].tabIds).toContain(2);
      expect(groupCall[0].tabIds).toContain(3);
    });

    it('should enable undo after successful grouping', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com/a', title: 'A', groupId: -1, index: 0 },
        { id: 2, url: 'https://example.com/b', title: 'B', groupId: -1, index: 1 },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(100);
      chrome.tabGroups.update.mockResolvedValue({});

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(2);
      });

      expect(result.current.canUndo).toBe(false);

      await act(async () => {
        await result.current.autoGroupTabs();
      });

      expect(result.current.canUndo).toBe(true);
    });
  });

  describe('Undo (undoGrouping)', () => {
    it('should ungroup all currently grouped tabs', async () => {
      const mockTabs = [
        { id: 1, url: 'https://a.com', title: 'A', groupId: 100, index: 0 },
        { id: 2, url: 'https://b.com', title: 'B', groupId: 100, index: 1 },
      ];

      const snapshot = {
        tabs: [
          { id: 1, groupId: -1, index: 0 },
          { id: 2, groupId: -1, index: 1 },
        ],
        timestamp: Date.now(),
      };

      chrome.storage.local.get.mockImplementation((keys, cb) => cb({ undoSnapshot: snapshot }));
      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);
      chrome.tabs.get.mockImplementation((id) => Promise.resolve(mockTabs.find(t => t.id === id)));
      chrome.tabs.move.mockResolvedValue({});

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      await act(async () => {
        await result.current.undoGrouping();
      });

      expect(chrome.tabs.ungroup).toHaveBeenCalledWith([1, 2]);
    });

    it('should restore tabs to original groups', async () => {
      const mockTabs = [
        { id: 1, url: 'https://a.com', title: 'A', groupId: 999, index: 0 },
        { id: 2, url: 'https://b.com', title: 'B', groupId: 999, index: 1 },
        { id: 3, url: 'https://c.com', title: 'C', groupId: 999, index: 2 },
      ];

      // Snapshot shows tabs 1 & 2 were originally in group 50
      const snapshot = {
        tabs: [
          { id: 1, groupId: 50, index: 0 },
          { id: 2, groupId: 50, index: 1 },
          { id: 3, groupId: -1, index: 2 },  // Tab 3 was ungrouped
        ],
        timestamp: Date.now(),
      };

      chrome.storage.local.get.mockImplementation((keys, cb) => cb({ undoSnapshot: snapshot }));
      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(50);
      chrome.tabs.get.mockImplementation((id) => Promise.resolve(mockTabs.find(t => t.id === id)));
      chrome.tabs.move.mockResolvedValue({});

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      await act(async () => {
        await result.current.undoGrouping();
      });

      // Tabs 1 & 2 should be re-grouped together (they shared groupId 50)
      expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1, 2] });
    });

    it('should skip closed tabs during undo', async () => {
      const mockTabs = [
        { id: 1, url: 'https://a.com', title: 'A', groupId: 100, index: 0 },
        // Tab 2 was closed
      ];

      const snapshot = {
        tabs: [
          { id: 1, groupId: -1, index: 0 },
          { id: 2, groupId: -1, index: 1 },  // This tab no longer exists
        ],
        timestamp: Date.now(),
      };

      chrome.storage.local.get.mockImplementation((keys, cb) => cb({ undoSnapshot: snapshot }));
      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);
      chrome.tabs.get.mockImplementation((id) => {
        const tab = mockTabs.find(t => t.id === id);
        if (tab) return Promise.resolve(tab);
        return Promise.reject(new Error('Tab not found'));
      });
      chrome.tabs.move.mockResolvedValue({});

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      // Should not throw, just skip missing tab
      await expect(act(async () => {
        await result.current.undoGrouping();
      })).resolves.not.toThrow();

      expect(result.current.canUndo).toBe(false);
    });

    it('should clear snapshot after undo', async () => {
      const mockTabs = [
        { id: 1, url: 'https://a.com', title: 'A', groupId: -1, index: 0 },
      ];

      const snapshot = {
        tabs: [{ id: 1, groupId: -1, index: 0 }],
        timestamp: Date.now(),
      };

      chrome.storage.local.get.mockImplementation((keys, cb) => cb({ undoSnapshot: snapshot }));
      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);
      chrome.tabs.get.mockResolvedValue(mockTabs[0]);
      chrome.tabs.move.mockResolvedValue({});

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      await act(async () => {
        await result.current.undoGrouping();
      });

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('undoSnapshot');
      expect(result.current.canUndo).toBe(false);
    });

    it('should restore original tab positions', async () => {
      const mockTabs = [
        { id: 3, url: 'https://c.com', title: 'C', groupId: 100, index: 0 },
        { id: 1, url: 'https://a.com', title: 'A', groupId: 100, index: 1 },
        { id: 2, url: 'https://b.com', title: 'B', groupId: 100, index: 2 },
      ];

      // Original order was 1, 2, 3
      const snapshot = {
        tabs: [
          { id: 1, groupId: -1, index: 0 },
          { id: 2, groupId: -1, index: 1 },
          { id: 3, groupId: -1, index: 2 },
        ],
        timestamp: Date.now(),
      };

      chrome.storage.local.get.mockImplementation((keys, cb) => cb({ undoSnapshot: snapshot }));
      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);
      chrome.tabs.get.mockImplementation((id) => Promise.resolve(mockTabs.find(t => t.id === id)));
      chrome.tabs.move.mockResolvedValue({});

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      await act(async () => {
        await result.current.undoGrouping();
      });

      // Should restore positions: tab 1 → index 0, tab 2 → index 1, tab 3 → index 2
      expect(chrome.tabs.move).toHaveBeenCalledWith(1, { index: 0 });
      expect(chrome.tabs.move).toHaveBeenCalledWith(2, { index: 1 });
      expect(chrome.tabs.move).toHaveBeenCalledWith(3, { index: 2 });
    });
  });

  describe('Undo Persistence', () => {
    it('should restore canUndo state from storage on mount', async () => {
      const snapshot = {
        tabs: [{ id: 1, groupId: -1, index: 0 }],
        timestamp: Date.now(),  // Fresh timestamp
      };

      chrome.storage.local.get.mockImplementation((keys, cb) => cb({ undoSnapshot: snapshot }));
      chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://a.com', title: 'A', groupId: -1, index: 0 }]);

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });
    });

    it('should not restore expired snapshots (> 1 hour old)', async () => {
      const oneHourAgo = Date.now() - (61 * 60 * 1000);  // 61 minutes ago

      const snapshot = {
        tabs: [{ id: 1, groupId: -1, index: 0 }],
        timestamp: oneHourAgo,
      };

      chrome.storage.local.get.mockImplementation((keys, cb) => cb({ undoSnapshot: snapshot }));
      chrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://a.com', title: 'A', groupId: -1, index: 0 }]);

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(1);
      });

      // Expired snapshot should be ignored
      expect(result.current.canUndo).toBe(false);
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('undoSnapshot');
    });
  });

  describe('Close Tab', () => {
    it('should close a tab by ID', async () => {
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabs.query.mockResolvedValue([]);

      const { result } = renderHook(() => useTabs());

      await act(async () => {
        await result.current.closeTab(123);
      });

      expect(chrome.tabs.remove).toHaveBeenCalledWith(123);
    });
  });
});
