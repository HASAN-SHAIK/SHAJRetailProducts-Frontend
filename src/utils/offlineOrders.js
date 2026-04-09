import {
  deleteOfflineOrdersByIds,
  getOfflineOrders,
  getProductCacheByBarcode,
  getProductIdMappings,
  saveOfflineOrdersBulk,
  upsertOfflineOrder,
} from '../core/db';
import { deleteOrdersByIds, upsertOrders } from '../db/ordersDb';

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

const emitOrdersCacheUpdated = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('orders-cache-updated'));
  } catch {
    // ignore
  }
};

const emitOrdersSyncRequired = (synced = []) => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('orders-sync-required', {
        detail: { synced },
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
  if (entry.type === 'create') {
    try {
      await upsertOrders([buildLocalOrderFromEntry(withMeta)]);
      emitOrdersCacheUpdated();
    } catch {
      // ignore cache failures
    }
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
    gst_mode: payload.gst_mode,
    client_created_at: payload.client_created_at || entry.createdAt,
    customer_name: payload.customer_name,
    customer_phone: payload.customer_phone || null,
    customer_id: payload.customer_id || null,
    billing_type: payload.billing_type || payload.billingType || null,
    customer_location: payload.customer_location,
    customer_address: payload.customer_address,
    branch_id: payload.branch_id || null,
    products: payload.products || [],
    total_amount: payload.total_amount ?? payload.total_price,
    discount_total: payload.discount_total ?? payload.discount ?? payload.discount_amount,
    discount_type: payload.discount_type ?? payload.discountType,
    payments: Array.isArray(payload.payments) ? payload.payments : [],
  };
};

const isTempId = (value) => {
  const text = String(value || '');
  return text.startsWith('temp:') || text.startsWith('local:') || text.startsWith('tmp:');
};

const resolveProductId = async (product, idMap) => {
  const rawId = product?.product_id ?? product?.productId ?? null;
  if (!rawId) return rawId;
  if (!isTempId(rawId)) return rawId;
  const mapped = idMap.get(String(rawId));
  if (mapped) return mapped;
  const barcode = product?.barcode ? String(product.barcode).trim() : null;
  if (barcode) {
    const cached = await getProductCacheByBarcode(barcode);
    if (cached?.id && !isTempId(cached.id)) {
      return cached.id;
    }
  }
  return rawId;
};

const normalizeTempProductIds = async (entry) => {
  const payload = entry?.payload || {};
  const products = Array.isArray(payload.products) ? payload.products : [];
  if (!products.length) return entry;
  const mappings = await getProductIdMappings();
  const idMap = new Map(
    (Array.isArray(mappings) ? mappings : [])
      .filter((m) => m?.tempId && m?.realId)
      .map((m) => [String(m.tempId), m.realId])
  );
  const updatedProducts = await Promise.all(
    products.map(async (item) => {
      const nextId = await resolveProductId(item, idMap);
      if (nextId === (item?.product_id ?? item?.productId)) return item;
      return {
        ...item,
        product_id: nextId,
      };
    })
  );
  return {
    ...entry,
    payload: {
      ...payload,
      products: updatedProducts,
    },
  };
};

const buildLocalOrderFromEntry = (entry) => {
  const payload = entry.payload || {};
  const clientOrderId = payload.client_order_id || entry.client_order_id;
  const localId = clientOrderId ? `local:${clientOrderId}` : `local:${entry.id}`;
  const products = Array.isArray(payload.products) ? payload.products : [];
  const productNames = products
    .map((item) => item?.name || item?.product_name || item?.product || '')
    .filter(Boolean);
  const productSummary = productNames.length
    ? productNames.slice(0, 3).join(', ')
    : '';
  const computedSubtotal = products.reduce((sum, item) => {
    const qty = Number(item.quantity || item.qty || 0);
    const price = Number(item.price || item.selling_price || 0);
    return sum + qty * price;
  }, 0);
  const computedGst = payload.is_gst_enabled
    ? products.reduce((sum, item) => {
        const qty = Number(item.quantity || item.qty || 0);
        const price = Number(item.price || item.selling_price || 0);
        const gst = Number(item.gst_percent || item.gst || 0);
        return sum + (qty * price * gst) / 100;
      }, 0)
    : 0;
  const totalAmount =
    payload.total_amount ??
    payload.total_price ??
    computedSubtotal + computedGst;
  return {
    id: localId,
    local_id: entry.id,
    client_order_id: clientOrderId || null,
    sync_status: 'pending',
    is_offline: true,
    branch_id: payload.branch_id || null,
    products_summary: productSummary,
    product_names: productNames,
    product_count: products.length,
    customer_name: payload.customer_name || null,
    customer_phone: payload.customer_phone || null,
    total_amount: totalAmount,
    total_paid: 0,
    returned_amount: 0,
    balance: null,
    payment_status: null,
    payment_mode: payload.payment_mode || payload.payment_method || payload.payment || null,
    order_status: payload.order_status || 'pending',
    is_gst_enabled: payload.is_gst_enabled === true,
    created_at: payload.client_created_at || entry.createdAt || new Date().toISOString(),
    products,
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
  const markPaidEntries = queue.filter((item) => item.type === 'mark-paid');

  if (createEntries.length) {
    try {
      for (const entry of createEntries) {
        ensureClientOrderId(entry);
        const normalized = await normalizeTempProductIds(entry);
        entry.payload = normalized.payload;
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
          const localId = clientOrderId ? `local:${clientOrderId}` : `local:${entry.id}`;
          try {
            await deleteOrdersByIds([localId]);
          } catch {
            // ignore cache delete failures
          }
          if (result.order_id) {
            try {
              const orderRes = await api.get(`/orders/${result.order_id}`);
              const orderPayload = orderRes?.data?.order || orderRes?.data || null;
              if (orderPayload) {
                await upsertOrders([orderPayload]);
                emitOrdersCacheUpdated();
              }
            } catch {
              // ignore order fetch failures
            }
          }
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

  for (const item of markPaidEntries) {
    try {
      await api.post('/orders/mark-paid', item.payload);
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
  if (synced.length > 0) {
    emitOrdersSyncRequired(synced);
  }
  return { processed, failed, remaining: remaining.length, synced };
};
