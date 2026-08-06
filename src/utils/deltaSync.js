import { getConfigValue, saveConfigValue } from '../services/local/configLocalService';
import {
  deleteBatchesCacheByIds,
  deleteProductsCacheByIds,
  updateBatchesBulk,
  updateProductsBulk,
} from '../services/local/productLocalService';
import { deleteSuppliersCacheByIds, updateSuppliersCacheBulk } from '../services/local/supplierLocalService';
import { fetchBatchesDelta, fetchProductsDelta } from '../Repositories/api/productApiClient';
import { fetchSuppliersDelta } from '../Repositories/api/supplierApiClient';

const SYNC_KEY = 'delta_sync_state_v1';
let deltaSyncInFlight = null;

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

const buildSyncParams = (updatedAfter, branchId) => ({
  updatedAfter,
  branchId,
});

const handleSyncResponse = async ({ moduleKey, payload, upsert, drop }) => {
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const deletedIds = Array.isArray(payload?.deletedIds) ? payload.deletedIds : [];
  const serverTime = payload?.serverTime || new Date().toISOString();

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
  if (deltaSyncInFlight) return deltaSyncInFlight;

  deltaSyncInFlight = (async () => {
  const branchId = options?.branchId || null;
  const forceFull = options?.forceFull === true;
  const results = {};

  const productsSince = forceFull ? null : await getLastSync('products');
  const productsPayload = await fetchProductsDelta(buildSyncParams(productsSince, branchId));
  results.products = await handleSyncResponse({
    moduleKey: 'products',
    payload: productsPayload,
    upsert: updateProductsBulk,
    drop: deleteProductsCacheByIds,
  });

  const batchesSince = forceFull ? null : await getLastSync('batches');
  const batchesPayload = await fetchBatchesDelta(buildSyncParams(batchesSince, branchId));
  results.batches = await handleSyncResponse({
    moduleKey: 'batches',
    payload: batchesPayload,
    upsert: updateBatchesBulk,
    drop: deleteBatchesCacheByIds,
  });

  const suppliersSince = forceFull ? null : await getLastSync('suppliers');
  const suppliersPayload = await fetchSuppliersDelta(buildSyncParams(suppliersSince, branchId));
  results.suppliers = await handleSyncResponse({
    moduleKey: 'suppliers',
    payload: suppliersPayload,
    upsert: updateSuppliersCacheBulk,
    drop: deleteSuppliersCacheByIds,
  });

  return results;
  })().finally(() => {
    deltaSyncInFlight = null;
  });

  return deltaSyncInFlight;
};

export const resetDeltaSyncState = async () => {
  await saveConfigValue(SYNC_KEY, {});
};
