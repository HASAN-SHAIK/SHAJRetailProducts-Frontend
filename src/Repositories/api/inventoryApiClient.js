import api from '../../utils/axios';
import { normalizeBranchStockRows } from './inventoryNormalizer';

const getSelectedBranchId = () => {
  if (typeof window === 'undefined') return null;
  try {
    const branchId = localStorage.getItem('selected_branch_id');
    return branchId && branchId !== 'all' ? branchId : null;
  } catch {
    return null;
  }
};

const withBranchHeaders = (branchId) => {
  const resolved = branchId || getSelectedBranchId();
  return resolved ? { 'x-branch-id': resolved } : undefined;
};

export const fetchBranchStock = async (productId, { branchId = null, timeout = undefined } = {}) => {
  const id = String(productId || '').trim();
  if (!id) return [];
  const headers = withBranchHeaders(branchId);
  const response = await api.get('/stock', {
    params: { product_id: id },
    headers,
    ...(timeout ? { timeout } : {}),
  });
  return normalizeBranchStockRows(response);
};

export const fetchStockConsistencyLatest = async () => {
  const response = await api.get('/data-quality/stock-consistency/latest');
  return response?.data?.data ?? response?.data ?? null;
};

export const runStockConsistencyRemote = async ({ autoHeal = true } = {}) => {
  const response = await api.post('/data-quality/stock-consistency/run', {
    auto_heal: autoHeal,
  });
  return response?.data?.data ?? response?.data ?? {};
};

export const fetchInventoryIntelligenceRemote = async ({
  range = null,
  location = null,
  branchId = null,
} = {}) => {
  const query = new URLSearchParams();
  if (range) query.set('range', range);
  if (location) query.set('location', location);
  const resolvedBranchId = branchId || getSelectedBranchId();
  if (resolvedBranchId) query.set('branch_id', resolvedBranchId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await api.get(`/dashboard/inventory-intelligence${suffix}`);
  return response?.data?.data || response?.data || {};
};

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;
