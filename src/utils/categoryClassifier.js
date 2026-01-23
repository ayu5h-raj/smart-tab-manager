/**
 * Category Classifier for Smart Tab Grouping
 * Classifies tabs based on URL and title keywords
 */

const CATEGORIES = {
  Work: {
    keywords: ['docs.google', 'sheets.google', 'slides.google', 'notion', 'slack', 'jira', 'confluence', 'asana', 'trello', 'figma', 'linear', 'monday', 'zoom', 'meet.google', 'teams', 'outlook', 'calendar', 'drive.google'],
    color: 'blue'
  },
  Entertainment: {
    keywords: ['youtube', 'netflix', 'spotify', 'twitch', 'reddit', 'twitter', 'instagram', 'tiktok', 'disney', 'hulu', 'prime video', 'hianime', 'crunchyroll', 'hotstar', 'jiocinema'],
    color: 'red'
  },
  Shopping: {
    keywords: ['amazon', 'ebay', 'flipkart', 'myntra', 'shop', 'cart', 'checkout', 'buy', 'order', 'aliexpress', 'etsy', 'walmart'],
    color: 'orange'
  },
  Learning: {
    keywords: ['udemy', 'coursera', 'leetcode', 'tutorial', 'learn', 'course', 'documentation', 'edu', 'academy', 'skillshare', 'pluralsight', 'freecodecamp', 'w3schools', 'mdn'],
    color: 'green'
  },
  News: {
    keywords: ['news', 'bbc', 'cnn', 'times', 'guardian', 'medium', 'substack', 'newsletter', 'blog', 'article', 'reuters', 'nyt'],
    color: 'purple'
  },
  Dev: {
    keywords: ['github', 'stackoverflow', 'npm', 'localhost', 'vercel', 'netlify', 'console', 'gitlab', 'bitbucket', 'codepen', 'codesandbox', 'replit', 'api', 'developer'],
    color: 'grey'
  },
  Social: {
    keywords: ['linkedin', 'facebook', 'messenger', 'whatsapp', 'discord', 'telegram', 'signal', 'snapchat'],
    color: 'cyan'
  },
  Search: {
    keywords: ['google.com/search', 'bing.com/search', 'duckduckgo', 'search', 'perplexity'],
    color: 'yellow'
  }
};

/**
 * Classify a single tab into a category
 * @param {chrome.tabs.Tab} tab 
 * @returns {string} Category name or 'Other'
 */
export function classifyTab(tab) {
  const searchText = `${tab.url || ''} ${tab.title || ''}`.toLowerCase();
  
  for (const [category, config] of Object.entries(CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  
  return 'Other';
}

/**
 * Get the color for a category (for Chrome tab groups)
 * @param {string} category 
 * @returns {string} Chrome tab group color
 */
export function getCategoryColor(category) {
  return CATEGORIES[category]?.color || 'grey';
}

/**
 * Classify multiple tabs and group by category
 * @param {chrome.tabs.Tab[]} tabs 
 * @returns {Object} Map of category -> tab IDs
 */
export function classifyTabs(tabs) {
  const groups = {};
  
  tabs.forEach(tab => {
    const category = classifyTab(tab);
    if (!groups[category]) groups[category] = [];
    groups[category].push(tab.id);
  });
  
  return groups;
}

export { CATEGORIES };
