// JS bridge so App.js can import without requiring TS module resolution.
// Existing sync workers already handle background sync in this app.

export const startDefaultOfflineSync = () => {
  // no-op for JS runtime compatibility
};

export const stopDefaultOfflineSync = () => {
  // no-op for JS runtime compatibility
};
