// Background service worker

const updateBadge = async () => {
  try {
    const tabs = await chrome.tabs.query({});
    const urlMap = new Map();
    let duplicateCount = 0;

    tabs.forEach((tab) => {
      const url = tab.url;
      if (!url) return;

      if (urlMap.has(url)) {
        duplicateCount++;
      } else {
        urlMap.set(url, true);
      }
    });

    if (duplicateCount > 0) {
      await chrome.action.setBadgeText({ text: duplicateCount.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error("Error updating badge:", error);
  }
};

// Listen for tab updates, creations, and removals
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateBadge();
  }
});

chrome.tabs.onCreated.addListener(() => {
  updateBadge();
});

chrome.tabs.onRemoved.addListener(() => {
  updateBadge();
});

// Initialize on load
chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
  console.log("Smart Tab Manager installed.");
});
