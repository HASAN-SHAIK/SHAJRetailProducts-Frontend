import { deleteOfflineOrdersByIds, getOfflineOrders, saveOfflineOrdersBulk, upsertOfflineOrder } from '../core/db';

const STORAGE_KEY = 'offline_order_queue_v1';
let migrationDone = false;

const readLegacyQueue = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const clearLegacyQueue = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

const migrateLegacyQueue = async () => {
  if (migrationDone) return;
  migrationDone = true;
  const legacy = readLegacyQueue();
  if (!legacy.length) return;
  try {
    await saveOfflineOrdersBulk(legacy);
    clearLegacyQueue();
  } catch {
    // fallback: keep legacy localStorage
  }
};

const readQueue = async () => {
  await migrateLegacyQueue();
  try {
    const list = await getOfflineOrders();
    return Array.isArray(list) ? list : [];
  } catch {
    return readLegacyQueue();
  }
};

const writeQueue = async (queue) => {
  const list = Array.isArray(queue) ? queue : [];
  try {
    await saveOfflineOrdersBulk(list);
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }
};

const emitQueueUpdate = (queue) => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('offline-queue-updated', {
        detail: { count: queue.length, queue },
      })
    );
  } catch {
    // ignore
  }
};

export const getOfflineOrderQueue = async () => readQueue();

const generateUuidV4 = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const enqueueOfflineOrder = async (entry) => {
  const payload = { ...(entry.payload || {}) };
  if (entry.type === 'create' && !payload.client_order_id) {
    payload.client_order_id = generateUuidV4();
  }
  const withMeta = {
    id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...entry,
    payload,
  };
  try {
    await upsertOfflineOrder(withMeta);
  } catch {
    const queue = await readQueue();
    queue.push(withMeta);
    await writeQueue(queue);
  }
  return withMeta;
};

const ensureClientOrderId = (entry) => {
  const payload = entry.payload || {};
  if (!payload.client_order_id) {
    const generated = generateUuidV4();
    payload.client_order_id = generated;
    entry.client_order_id = generated;
    entry.payload = payload;
  }
  return payload.client_order_id;
};

const buildOfflineSyncOrder = (entry) => {
  const payload = entry.payload || {};
  const clientOrderId = payload.client_order_id || entry.client_order_id;
  return {
    client_order_id: clientOrderId,
    user_id: payload.user_id,
    transaction_type: payload.transaction_type || payload.type,
    payment_mode: payload.payment_mode || payload.payment_method || payload.payment,
    is_gst_enabled: payload.is_gst_enabled,
    client_created_at: payload.client_created_at || entry.createdAt,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone || null,
    customer_location: payload.customer_location,
    customer_address: payload.customer_address,
    branch_id: payload.branch_id || null,
    products: payload.products || [],
    total_amount: payload.total_amount ?? payload.total_price,
    payments: Array.isArray(payload.payments) ? payload.payments : [],
  };
};

export const processOfflineQueue = async (api) => {
  if (!navigator.onLine) return { processed: 0, failed: 0, remaining: (await readQueue()).length };

  const queue = await readQueue();
  const remaining = [];
  let processed = 0;
  let failed = 0;
  let synced = [];
  const processedIds = [];

  const createEntries = queue.filter((item) => item.type === 'create');
  const updateEntries = queue.filter((item) => item.type === 'update');

  if (createEntries.length) {
    try {
      for (const entry of createEntries) {
        ensureClientOrderId(entry);
      }
      const orders = createEntries.map(buildOfflineSyncOrder);
      const sync_id = generateUuidV4();
      const res = await api.post('/orders/offline-sync', { sync_id, orders });
      const results = res?.data?.results || [];
      synced = Array.isArray(results) ? results : [];
      const resultMap = new Map(
        results.map((r) => [r.client_order_id, r])
      );

      for (const entry of createEntries) {
        const payload = entry.payload || {};
        const clientOrderId = payload.client_order_id || entry.client_order_id;
        const result = resultMap.get(clientOrderId);
        if (result && (result.status === 'created' || result.status === 'duplicate')) {
          processed += 1;
          if (entry.id) processedIds.push(entry.id);
        } else {
          failed += 1;
          remaining.push(entry);
        }
      }
    } catch (err) {
      failed += createEntries.length;
      remaining.push(...createEntries);
    }
  }

  for (const item of updateEntries) {
    try {
      await api.put(`/orders/${item.orderId}`, item.payload);
      processed += 1;
      if (item.id) processedIds.push(item.id);
    } catch (err) {
      failed += 1;
      remaining.push(item);
    }
  }

  if (processedIds.length) {
    try {
      await deleteOfflineOrdersByIds(processedIds);
    } catch {
      // ignore delete failures; writeQueue will still reconcile
    }
  }
  await writeQueue(remaining);
  emitQueueUpdate(remaining);
  return { processed, failed, remaining: remaining.length, synced };
};
