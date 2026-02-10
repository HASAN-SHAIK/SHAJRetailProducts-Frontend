const STORAGE_KEY = 'offline_order_queue_v1';

const readQueue = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const getOfflineOrderQueue = () => readQueue();

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

export const enqueueOfflineOrder = (entry) => {
  const queue = readQueue();
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
  queue.push(withMeta);
  writeQueue(queue);
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
    client_created_at: payload.client_created_at || entry.createdAt,
    products: payload.products || [],
    total_amount: payload.total_amount ?? payload.total_price,
  };
};

export const processOfflineQueue = async (api) => {
  if (!navigator.onLine) return { processed: 0, failed: 0, remaining: readQueue().length };

  const queue = readQueue();
  const remaining = [];
  let processed = 0;
  let failed = 0;

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
      const resultMap = new Map(
        results.map((r) => [r.client_order_id, r])
      );

      for (const entry of createEntries) {
        const payload = entry.payload || {};
        const clientOrderId = payload.client_order_id || entry.client_order_id;
        const result = resultMap.get(clientOrderId);
        if (result && (result.status === 'created' || result.status === 'duplicate')) {
          processed += 1;
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
    } catch (err) {
      failed += 1;
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return { processed, failed, remaining: remaining.length };
};
