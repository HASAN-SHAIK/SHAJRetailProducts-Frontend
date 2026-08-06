import api from '../../utils/axios';
import {
  buildUpdateProductPayload,
  normalizeApiBatch,
  normalizeApiProduct,
} from './productNormalizer';
import { unwrapList } from '../../utils/apiClient';

const getSelectedBranchId = () => {
  if (typeof window === 'undefined') return null;
  try {
    const branchId = localStorage.getItem('selected_branch_id');
    return branchId && branchId !== 'all' ? branchId : null;
  } catch {
    return null;
  }
};

export const extractProductFromResponse = (response) => {
  const data = response?.data ?? {};
  if (Array.isArray(data.products)) return data.products[0] || null;
  if (data.product) return data.product;
  if (data.data?.product) return data.data.product;
  if (Array.isArray(data.data?.products)) return data.data.products[0] || null;
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) return data.data;
  return null;
};

const withBranchHeaders = (branchId) => {
  const resolved = branchId || getSelectedBranchId();
  return resolved ? { 'x-branch-id': resolved } : undefined;
};

export const fetchProductByBarcode = async (barcode, { branchId = null, context = 'sale' } = {}) => {
  const code = String(barcode || '').trim();
  if (!code) return null;
  const headers = withBranchHeaders(branchId);
  const path =
    context === 'purchase'
      ? `/products/barcode/purchase/${encodeURIComponent(code)}`
      : `/products/barcode/sale/${encodeURIComponent(code)}`;

  try {
    const response = await api.get(path, { headers });
    const product = extractProductFromResponse(response);
    return normalizeApiProduct(product);
  } catch {
    const queryPath = context === 'purchase' ? '/products/barcode/purchase' : '/products/barcode/sale';
    try {
      const response = await api.get(queryPath, { params: { barcode: code }, headers });
      const product = extractProductFromResponse(response);
      return normalizeApiProduct(product);
    } catch {
      try {
        const response = await api.get(`/products/barcode/${encodeURIComponent(code)}`, { headers });
        const product = extractProductFromResponse(response);
        return normalizeApiProduct(product);
      } catch {
        return null;
      }
    }
  }
};

export const fetchProductById = async (productId, branchId = null) => {
  const id = String(productId || '').trim();
  if (!id) return null;
  const headers = withBranchHeaders(branchId);
  const response = await api.get(`/products/${encodeURIComponent(id)}`, { headers });
  const product = extractProductFromResponse(response) || response?.data;
  return normalizeApiProduct(product);
};

export const fetchBatches = async (branchId = null) => {
  const headers = withBranchHeaders(branchId);
  const response = await api.get('/batches', { headers });
  const payload = response?.data ?? {};
  const list = Array.isArray(payload.batches)
    ? payload.batches
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];
  return list.map(normalizeApiBatch).filter(Boolean);
};

export const fetchProductsDelta = async ({ updatedAfter = null, branchId = null } = {}) => {
  const params = {};
  if (updatedAfter) params.updated_after = updatedAfter;
  if (branchId) params.branch_id = branchId;
  const headers = withBranchHeaders(branchId);
  const response = await api.get('/sync/products', { params, headers });
  const payload = response?.data ?? {};
  const data = Array.isArray(payload.data) ? payload.data : [];
  const deletedIds = Array.isArray(payload.deleted_ids) ? payload.deleted_ids : [];
  return {
    data: data.map(normalizeApiProduct).filter(Boolean),
    deletedIds,
    serverTime: payload.server_time || new Date().toISOString(),
  };
};

export const fetchBatchesDelta = async ({ updatedAfter = null, branchId = null } = {}) => {
  const params = {};
  if (updatedAfter) params.updated_after = updatedAfter;
  if (branchId) params.branch_id = branchId;
  const headers = withBranchHeaders(branchId);
  const response = await api.get('/sync/batches', { params, headers });
  const payload = response?.data ?? {};
  const data = Array.isArray(payload.data) ? payload.data : [];
  const deletedIds = Array.isArray(payload.deleted_ids) ? payload.deleted_ids : [];
  return {
    data: data.map(normalizeApiBatch).filter(Boolean),
    deletedIds,
    serverTime: payload.server_time || new Date().toISOString(),
  };
};

export const searchProductsSale = async (query, branchId = null) => {
  const term = String(query || '').trim();
  if (!term) return [];
  const headers = withBranchHeaders(branchId);
  const response = await api.get('/products/search/sale', {
    params: { name: term },
    headers,
  });
  const list = unwrapList(response, ['products']);
  return list.map(normalizeApiProduct).filter(Boolean);
};

export const searchProductsMobile = async (query, branchId = null) => {
  const term = String(query || '').trim();
  if (!term) return [];
  const headers = withBranchHeaders(branchId);
  try {
    const saleList = await searchProductsSale(term, branchId);
    if (saleList.length) return saleList;
  } catch {
    // fall through to mobile view endpoint
  }
  const response = await api.get('/products/search', {
    params: { view: 'mobile', q: term, name: term },
    headers,
  });
  const list = unwrapList(response, ['products']);
  return list.map(normalizeApiProduct).filter(Boolean);
};

export const searchProductsPurchase = async (query, branchId = null) => {
  const term = String(query || '').trim();
  if (!term) return [];
  const headers = withBranchHeaders(branchId);
  const response = await api.get('/products/search/purchase', {
    params: { name: term },
    headers,
  });
  const payload = response?.data?.data ?? response?.data?.products ?? response?.data ?? [];
  const list = Array.isArray(payload) ? payload : [];
  return list.map(normalizeApiProduct).filter(Boolean);
};

export const updateProductRemote = async (productId, product) => {
  const payload = buildUpdateProductPayload(product);
  const response = await api.put(`/products/${encodeURIComponent(productId)}`, payload);
  const updated = extractProductFromResponse(response) || response?.data;
  return normalizeApiProduct(updated);
};

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;
