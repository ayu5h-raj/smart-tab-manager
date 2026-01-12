/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTabs } from '../hooks/useTabs';

describe('useTabs Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('Grouping and Undo', () => {
    it('should enable undo after grouping tabs', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com/page1', title: 'Page 1', groupId: -1, index: 0, windowId: 1 },
        { id: 2, url: 'https://example.com/page2', title: 'Page 2', groupId: -1, index: 1, windowId: 1 },
        { id: 3, url: 'https://google.com', title: 'Google', groupId: -1, index: 2, windowId: 1 },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(100);
      chrome.tabGroups.update.mockResolvedValue({});

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(3);
      });

      expect(result.current.canUndo).toBe(false);

      await act(async () => {
        await result.current.autoGroupTabs();
      });

      expect(result.current.canUndo).toBe(true);
      expect(chrome.tabs.group).toHaveBeenCalled();
    });

    it('should restore tabs to original order on undo', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com/a', title: 'A', groupId: -1, index: 0, windowId: 1 },
        { id: 2, url: 'https://example.com/b', title: 'B', groupId: -1, index: 1, windowId: 1 },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(100);
      chrome.tabs.ungroup.mockResolvedValue(undefined);
      chrome.tabs.get.mockImplementation((id) => 
        Promise.resolve(mockTabs.find(t => t.id === id))
      );
      chrome.tabs.move.mockImplementation((id, props) => 
        Promise.resolve({ ...mockTabs.find(t => t.id === id), ...props })
      );

      const { result } = renderHook(() => useTabs());

      await waitFor(() => {
        expect(result.current.tabs).toHaveLength(2);
      });

      // Group tabs
      await act(async () => {
        await result.current.autoGroupTabs();
      });

      expect(result.current.canUndo).toBe(true);

      // Undo
      await act(async () => {
        await result.current.undoGrouping();
      });

      expect(chrome.tabs.ungroup).toHaveBeenCalled();
      expect(chrome.tabs.move).toHaveBeenCalledWith(2, { index: 1 });
      expect(chrome.tabs.move).toHaveBeenCalledWith(1, { index: 0 });
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('Close Tab', () => {
    it('should close a tab by ID', async () => {
      chrome.tabs.remove.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTabs());

      await act(async () => {
        await result.current.closeTab(123);
      });

      expect(chrome.tabs.remove).toHaveBeenCalledWith(123);
    });
  });
});
