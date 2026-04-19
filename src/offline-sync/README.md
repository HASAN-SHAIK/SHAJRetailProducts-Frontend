# Offline Sync (TypeScript)

This module provides a queue-based offline-first sync layer over IndexedDB (Dexie).

## Core Features
- `sync_queue` table with queue metadata/status/retry fields
- Entity-level sync metadata (`syncStatus`, `lastSyncedAt`)
- Atomic local-write + queue-enqueue pattern
- Background worker with exponential backoff retries
- Modular entity handlers

## Quick Start

```ts
import {
  startDefaultOfflineSync,
  productRepository,
  invoiceRepository,
  customerRepository,
} from './offline-sync';

startDefaultOfflineSync();

await productRepository.create({
  id: 'prod_1',
  name: 'Demo product',
  price: 100,
} as any);

await customerRepository.update('cust_1', {
  phone: '9999999999',
} as any);

await invoiceRepository.remove('inv_1');
```

All mutations are stored locally first and queued for server sync.
