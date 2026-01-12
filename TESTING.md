# Testing Guide

## Running Tests

The test suite uses Jest with React Testing Library to test tab management functionality.

```bash
npm test
```

**Note**: Tests currently require ESM support configuration. To run tests manually:

1. Remove `"type": "module"` from `package.json` temporarily
2. Run `npm test`
3. Re-add `"type": "module"` after testing

## Test Coverage

### Duplicate Detection Tests
- ✅ Identifies tabs with identical URLs
- ✅ Correctly counts duplicates

### Sorting Tests  
- ✅ Alphabetical sorting (A-Z)
- ✅ Domain-based sorting
- ✅ Recent tab sorting by index

### Grouping & Undo Tests
- ✅ Auto-groups tabs by domain
- ✅ Enables undo after grouping
- ✅ **Restores original tab order on undo** (reverse index sort)
- ✅ Handles missing/closed tabs gracefully

### Tab Management Tests
- ✅ Closes tabs by ID
- ✅ Chrome API mock integration

## Test Files

- `src/hooks/useTabs.test.js` - Main hook tests
- `src/test/setup.js` - Chrome API mocks
- `jest.config.js` - Jest configuration
- `babel.config.json` - Babel transform config
