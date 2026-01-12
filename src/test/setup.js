require('@testing-library/jest-dom');

// Mock Chrome APIs
global.chrome = {
  tabs: {
    query: jest.fn(),
    get: jest.fn(),
    remove: jest.fn(),
    group: jest.fn(),
    ungroup: jest.fn(),
    move: jest.fn(),
    update: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onCreated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  tabGroups: {
    update: jest.fn(),
  },
};
