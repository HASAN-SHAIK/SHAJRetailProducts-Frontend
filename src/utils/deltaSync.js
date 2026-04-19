import api from './axios';
import {
  deleteBatchesCacheByIds,
  deleteProductsCacheByIds,
  deleteSuppliersCacheByIds,
  getConfigValue,
  saveConfigValue,
  updateBatchesBulk,
  updateProductsBulk,
  updateSuppliersCacheBulk,
} from '../core/db';

const SYNC_KEY = 'delta_sync_state_v1';

const parseSyncState = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const getLastSync = async (moduleKey) => {
  const raw = await getConfigValue(SYNC_KEY);
  const state = parseSyncState(raw);
  return state?.[moduleKey] || null;
};

const setLastSync = async (moduleKey, timestamp) => {
  const raw = await getConfigValue(SYNC_KEY);
  const state = parseSyncState(raw);
  state[moduleKey] = timestamp;
  await saveConfigValue(SYNC_KEY, state);
};

const buildSyncParams = (updatedAfter, branchId) => {
  const params = {};
  if (updatedAfter) params.updated_after = updatedAfter;
  if (branchId) params.branch_id = branchId;
  return params;
};

const handleSyncResponse = async ({ moduleKey, response, upsert, drop }) => {
  const payload = response?.data ?? {};
  const data = Array.isArray(payload.data) ? payload.data : [];
  const deletedIds = Array.isArray(payload.deleted_ids) ? payload.deleted_ids : [];
  const serverTime = payload.server_time || new Date().toISOString();

  if (data.length) {
    await upsert(data).catch(() => {});
  }
  if (deletedIds.length) {
    await drop(deletedIds).catch(() => {});
  }
  await setLastSync(moduleKey, serverTime);
  return { data_count: data.length, deleted_count: deletedIds.length, server_time: serverTime };
};

export const runDeltaSync = async (options = {}) => {
  if (!navigator.onLine) return null;
  const branchId = options?.branchId || null;
  const forceFull = options?.forceFull === true;
  const results = {};

  const productsSince = forceFull ? null : await getLastSync('products');
  const productsRes = await api.get('/sync/products', {
    params: buildSyncParams(productsSince, branchId),
    headers: branchId ? { 'x-branch-id': branchId } : undefined,
  });
  results.products = await handleSyncResponse({
    moduleKey: 'products',
    response: productsRes,
    upsert: updateProductsBulk,
    drop: deleteProductsCacheByIds,
  });

  const batchesSince = forceFull ? null : await getLastSync('batches');
  const batchesRes = await api.get('/sync/batches', {
    params: buildSyncParams(batchesSince, branchId),
    headers: branchId ? { 'x-branch-id': branchId } : undefined,
  });
  results.batches = await handleSyncResponse({
    moduleKey: 'batches',
    response: batchesRes,
    upsert: updateBatchesBulk,
    drop: deleteBatchesCacheByIds,
  });

  const suppliersSince = forceFull ? null : await getLastSync('suppliers');
  const suppliersRes = await api.get('/sync/suppliers', {
    params: buildSyncParams(suppliersSince, branchId),
    headers: branchId ? { 'x-branch-id': branchId } : undefined,
  });
  results.suppliers = await handleSyncResponse({
    moduleKey: 'suppliers',
    response: suppliersRes,
    upsert: updateSuppliersCacheBulk,
    drop: deleteSuppliersCacheByIds,
  });

  return results;
};

export const resetDeltaSyncState = async () => {
  await saveConfigValue(SYNC_KEY, {});
};
