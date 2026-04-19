import {
  updateSuppliersCacheBulk,
  getSupplierCacheById,
  deleteSuppliersCacheByIds,
  upsertLocalSupplier,
} from '../core/db';
import { enqueueInventorySync, processInventorySyncQueue } from './inventorySync';

const createLocalId = () => `temp_${Date.now()}`;

export const createOfflineSupplier = async (payload) => {
  const id = createLocalId();
  const now = new Date().toISOString();
  const supplier = {
    id,
    name: payload.name ?? '',
    name_lower: String(payload.name ?? '').toLowerCase(),
    mobile: payload.mobile ?? '',
    email: payload.email ?? '',
    gst_number: payload.gst_number ?? '',
    credit_limit: payload.credit_limit ?? 0,
    current_balance: payload.current_balance ?? 0,
    address: payload.address ?? '',
    is_active: payload.is_active ?? true,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
  await updateSuppliersCacheBulk([supplier]);
  await upsertLocalSupplier({
    id,
    name: supplier.name,
    phone: supplier.mobile,
    syncStatus: 'pending',
    sync_status: 'pending',
    updatedAt: now,
  });
  await enqueueInventorySync({ type: 'supplier', entityId: id, action: 'create' });
  if (navigator.onLine) {
    processInventorySyncQueue().catch(() => {});
  }
  return supplier;
};

export const updateOfflineSupplier = async (payload) => {
  const id = payload.id;
  if (!id) throw new Error('Missing supplier id');
  const existing = await getSupplierCacheById(id);
  const now = new Date().toISOString();
  const next = {
    ...(existing || {}),
    ...payload,
    id,
    name: payload.name ?? existing?.name ?? '',
    name_lower: String(payload.name ?? existing?.name ?? '').toLowerCase(),
    updated_at: now,
    sync_status: 'pending',
  };
  await updateSuppliersCacheBulk([next]);
  await upsertLocalSupplier({
    id,
    name: next.name,
    phone: next.mobile,
    syncStatus: 'pending',
    sync_status: 'pending',
    updatedAt: now,
  });
  await enqueueInventorySync({ type: 'supplier', entityId: id, action: 'update' });
  if (navigator.onLine) {
    processInventorySyncQueue().catch(() => {});
  }
  return next;
};

export const deleteOfflineSupplier = async (supplierId) => {
  if (!supplierId) return;
  await deleteSuppliersCacheByIds([supplierId]);
  await upsertLocalSupplier({
    id: supplierId,
    syncStatus: 'pending',
    sync_status: 'pending',
    updatedAt: new Date().toISOString(),
    is_deleted: true,
  });
  await enqueueInventorySync({ type: 'supplier', entityId: supplierId, action: 'delete' });
  if (navigator.onLine) {
    processInventorySyncQueue().catch(() => {});
  }
};

