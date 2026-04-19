import api from '../utils/axios';
import { getSyncQueueItems, updateSyncQueueItem, replaceCustomerIdReferences } from '../core/db';

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

export const syncAllCustomers = async () => {
  if (!navigator.onLine) return { processed: 0, failed: 0 };
  const queue = await getSyncQueueItems({ type: 'customer' });
  const pending = queue.filter(shouldRetryNow);
  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    const payload = entry.payload || entry.data || null;
    const action = entry.action || entry.syncAction || 'create';
    if (!payload) {
      await updateSyncQueueItem({
        ...entry,
        status: 'error',
        retryCount: Number(entry.retryCount || 0) + 1,
      });
      failed += 1;
      continue;
    }
    await updateSyncQueueItem({ ...entry, status: 'processing' });
    try {
      if (action === 'update' && entry.entityId) {
        await api.put(`/customers/${entry.entityId}`, payload);
      } else {
        const res = await api.post('/customers', payload);
        const customer =
          res?.data?.data?.customer ||
          res?.data?.customer ||
          res?.data?.data;
        if (customer?.id && entry.entityId && String(entry.entityId).startsWith('temp:')) {
          await replaceCustomerIdReferences(entry.entityId, customer.id);
        }
      }
      await updateSyncQueueItem({ ...entry, status: 'done' });
      processed += 1;
    } catch (err) {
      await updateSyncQueueItem({
        ...entry,
        status: 'error',
        retryCount: Number(entry.retryCount || 0) + 1,
      });
      failed += 1;
    }
  }

  return { processed, failed };
};

export const startCustomerSyncWorker = () => {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    if (!navigator.onLine) return;
    syncAllCustomers().catch(() => {});
  }, 30000);
};

export const stopCustomerSyncWorker = () => {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
};
