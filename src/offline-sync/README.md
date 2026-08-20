# Offline Sync Compatibility

This module is retained only for legacy imports. Browser database storage has been retired; POSService/SQLite is the authoritative local store.

The default worker exports are no-ops in browser builds. New offline persistence and queue work should be implemented in POSService SQLite.
