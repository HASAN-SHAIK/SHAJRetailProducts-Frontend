import api from '../../../utils/axios';
import {
  addSyncQueueEntry,
  updateSyncQueueEntry,
  getPendingSyncEntries,
  findPendingSyncEntry,
  getOrderById,
  getOrderItems,
  saveOrder,
} from './indexedDBService';

const SYNC_INTERVAL_MS = 30000;
let syncTimer = null;
let isSyncing = false;

const nowIso = () => new Date().toISOString();

const buildOrderPayload = (order, items) => ({
  transaction_type: 'sale',
  user_id: order?.user_id ?? undefined,
  customer_name: order?.customer_name ?? undefined,
  customer_phone: order?.customer_phone ?? undefined,
  customer_address: order?.customer_address ?? undefined,
  customer_location: order?.customer_location ?? undefined,
  branch_id: order?.branch_id ?? undefined,
  total_amount: order?.total_amount ?? 0,
  payment_method: order?.payment_method ?? 'cash',
  is_gst_enabled: Boolean(order?.is_gst_enabled),
  discount: order?.discount ?? 0,
  gst_amount: order?.gst_amount ?? 0,
  gst_mode: order?.gst_mode ?? undefined,
  status: order?.status ?? undefined,
  products: (Array.isArray(items) ? items : []).map((item) => ({
    product_id: item.product_id,
    quantity: item.qty,
    selling_price: item.price,
    gst_percentage: item.gst_percentage,
  })),
});

export const enqueueOrderSync = async ({ orderId, action }) => {
  if (!orderId) return null;
  const order = await getOrderById(orderId);
  if (!order) return null;
  const resolvedAction = action === 'update' && !order?.server_id ? 'create' : action;
  const finalAction = resolvedAction === 'create' && order?.server_id ? 'update' : resolvedAction;
  const existing = await findPendingSyncEntry(orderId, finalAction);
  const items = await getOrderItems(orderId);
  const payload = buildOrderPayload(order, items);
  const nextEntry = {
    order_id: orderId,
    action: finalAction,
    payload,
    status: 'pending',
    retries: existing?.retries ?? 0,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  if (existing) {
    await updateSyncQueueEntry({ ...existing, ...nextEntry, id: existing.id });
    return { ...existing, ...nextEntry };
  }
  return await addSyncQueueEntry(nextEntry);
};

const syncEntry = async (entry) => {
  const order = await getOrderById(entry.order_id);
  if (!order) {
    return { ...entry, status: 'synced', updated_at: nowIso(), last_error: 'order missing' };
  }
  const payload = entry.payload;
  if (entry.action === 'create') {
    const response = await api.post('/orders', payload);
    const serverId = response?.data?.order_id || response?.data?.order?.id || response?.data?.id || null;
    if (serverId) {
      await saveOrder({ ...order, server_id: serverId, updated_at: nowIso() });
      await updateSyncQueueEntry({ ...entry, status: 'synced', updated_at: nowIso(), server_id: serverId });
    } else {
      await updateSyncQueueEntry({ ...entry, status: 'synced', updated_at: nowIso() });
    }
    return { ...entry, status: 'synced', updated_at: nowIso(), server_id: serverId };
  }
  const targetId = order?.server_id || entry?.server_id || order?.id;
  await api.put(`/orders/${encodeURIComponent(targetId)}`, payload);
  await updateSyncQueueEntry({ ...entry, status: 'synced', updated_at: nowIso() });
  return { ...entry, status: 'synced', updated_at: nowIso() };
};

export const processSyncQueue = async () => {
  if (!navigator.onLine || isSyncing) return [];
  isSyncing = true;
  const synced = [];
  try {
    const pending = await getPendingSyncEntries();
    for (const entry of pending) {
      try {
        const nextEntry = { ...entry, status: 'processing', updated_at: nowIso() };
        await updateSyncQueueEntry(nextEntry);
        const result = await syncEntry(nextEntry);
        synced.push(result);
      } catch (error) {
        const retries = (entry?.retries ?? 0) + 1;
        await updateSyncQueueEntry({
          ...entry,
          status: 'pending',
          retries,
          updated_at: nowIso(),
          last_error: error?.message || 'sync failed',
        });
      }
    }
  } finally {
    isSyncing = false;
  }
  return synced;
};

export const startSyncWorker = () => {
  if (syncTimer) return syncTimer;
  syncTimer = setInterval(() => {
    processSyncQueue().catch(() => {});
  }, SYNC_INTERVAL_MS);
  return syncTimer;
};

export const stopSyncWorker = () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
};
