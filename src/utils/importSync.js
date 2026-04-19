import api from '../utils/axios';
import {
  addProductIdMapping,
  getSyncQueueItems,
  updateSyncQueueItem,
  updateOfflineImportStatus,
  replaceProductIdReferences,
} from '../core/db';

let workerTimer = null;

const getBackoffDelayMs = (retryCount = 0) => {
  const base = 5000;
  const factor = Math.min(Math.max(Number(retryCount) || 0, 0), 6);
  return base * Math.pow(2, factor);
};

const shouldRetryNow = (entry) => {
  if (!entry) return false;
  if (entry.status === 'pending') return true;
  if (entry.status !== 'error') return false;
  const retryCount = Number(entry.retryCount || 0);
  const updatedAt = entry.updated_at || entry.updatedAt || entry.createdAt;
  if (!updatedAt) return true;
  const lastTime = new Date(updatedAt).getTime();
  if (Number.isNaN(lastTime)) return true;
  return Date.now() - lastTime >= getBackoffDelayMs(retryCount);
};

const extractMappings = (payload) => {
  if (!payload) return [];
  const map =
    payload.id_map ||
    payload.product_id_map ||
    payload.productIdMap ||
    payload.data?.id_map ||
    payload.data?.product_id_map ||
    payload.data?.productIdMap ||
    payload.data?.mappings ||
    payload.mappings ||
    [];
  if (!Array.isArray(map)) return [];
  return map
    .map((entry) => ({
      tempId: entry.tempId || entry.temp_id || entry.local_id || entry.client_id,
      realId: entry.realId || entry.real_id || entry.productId || entry.product_id || entry.id,
    }))
    .filter((entry) => entry.tempId && entry.realId);
};

export const syncAllImports = async () => {
  if (!navigator.onLine) return { processed: 0, failed: 0 };
  const queue = await getSyncQueueItems({ type: 'import' });
  const pending = queue.filter(shouldRetryNow);
  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    const payload = entry.payload || entry.data || null;
    if (!payload) {
      await updateSyncQueueItem({
        ...entry,
        status: 'error',
        retryCount: Number(entry.retryCount || 0) + 1,
      });
      await updateOfflineImportStatus(entry.refId || entry.importId, 'failed');
      failed += 1;
      continue;
    }
    await updateSyncQueueItem({ ...entry, status: 'processing' });
    try {
      const res = await api.post('/imports', payload);
      const mappings = extractMappings(res?.data || {});
      for (const mapping of mappings) {
        await addProductIdMapping(mapping);
        await replaceProductIdReferences(mapping.tempId, mapping.realId);
      }
      await updateSyncQueueItem({ ...entry, status: 'done' });
      await updateOfflineImportStatus(entry.refId || entry.importId, 'synced');
      processed += 1;
    } catch (err) {
      await updateSyncQueueItem({
        ...entry,
        status: 'error',
        retryCount: Number(entry.retryCount || 0) + 1,
      });
      await updateOfflineImportStatus(entry.refId || entry.importId, 'failed');
      failed += 1;
    }
  }

  return { processed, failed };
};

export const startImportSyncWorker = () => {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    if (!navigator.onLine) return;
    syncAllImports().catch(() => {});
  }, 30000);
};

export const stopImportSyncWorker = () => {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
};
