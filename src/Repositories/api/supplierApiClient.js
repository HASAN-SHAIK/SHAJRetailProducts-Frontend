import api from '../../utils/axios';
import {
  buildSupplierPayload,
  normalizeApiSupplier,
  normalizeSupplierList,
} from './supplierNormalizer';

const getSelectedBranchId = () => {
  if (typeof window === 'undefined') return null;
  try {
    const branchId = localStorage.getItem('selected_branch_id');
    return branchId && branchId !== 'all' ? branchId : null;
  } catch {
    return null;
  }
};

export const extractSuppliersPayload = (response) => {
  const data = response?.data ?? {};
  if (Array.isArray(data.data?.suppliers)) return data.data.suppliers;
  if (Array.isArray(data.suppliers)) return data.suppliers;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

export const extractSupplierRecord = (response) => {
  const data = response?.data ?? {};
  return (
    data.data?.supplier ||
    data.supplier ||
    data.data?.data?.supplier ||
    (data.data && !Array.isArray(data.data) && data.data.id ? data.data : null) ||
    (data.id ? data : null)
  );
};

export const fetchSuppliers = async ({ search = '', limit = 500, branchId = null, page = 1 } = {}) => {
  const resolvedBranchId = branchId || getSelectedBranchId();
  const params = {
    limit,
    page,
    search: search || undefined,
    branch_id: resolvedBranchId || undefined,
  };
  const headers = resolvedBranchId ? { 'x-branch-id': resolvedBranchId } : undefined;

  try {
    const response = await api.get('/v1/suppliers', { params, headers });
    return normalizeSupplierList(extractSuppliersPayload(response));
  } catch {
    const response = await api.get('/suppliers', {
      params: search ? { search, branch_id: resolvedBranchId || undefined } : { limit, branch_id: resolvedBranchId || undefined },
      headers,
    });
    return normalizeSupplierList(extractSuppliersPayload(response));
  }
};

export const fetchSupplierById = async (supplierId) => {
  const id = encodeURIComponent(String(supplierId || '').trim());
  try {
    const response = await api.get(`/v1/suppliers/${id}`);
    return normalizeApiSupplier(extractSupplierRecord(response));
  } catch {
    const response = await api.get(`/suppliers/${id}`);
    return normalizeApiSupplier(extractSupplierRecord(response));
  }
};

export const fetchSupplierLedger = async (supplierId) => {
  const id = encodeURIComponent(String(supplierId || '').trim());
  const response = await api.get(`/suppliers/${id}/ledger`);
  const payload = response?.data?.data ?? response?.data ?? null;
  if (!payload) return null;
  const supplier = normalizeApiSupplier(payload.supplier ?? payload);
  return {
    supplier,
    ledger: Array.isArray(payload.ledger) ? payload.ledger : [],
  };
};

export const fetchSuppliersDelta = async ({ updatedAfter = null, branchId = null } = {}) => {
  const params = {};
  if (updatedAfter) params.updated_after = updatedAfter;
  if (branchId) params.branch_id = branchId;
  const headers = branchId ? { 'x-branch-id': branchId } : undefined;
  const response = await api.get('/sync/suppliers', { params, headers });
  const payload = response?.data ?? {};
  const data = Array.isArray(payload.data) ? payload.data : [];
  const deletedIds = Array.isArray(payload.deleted_ids) ? payload.deleted_ids : [];
  return {
    data: normalizeSupplierList(data),
    deletedIds,
    serverTime: payload.server_time || new Date().toISOString(),
  };
};

export const createSupplierRemote = async (payload) => {
  const body = buildSupplierPayload(payload);
  try {
    const response = await api.post('/v1/suppliers', body);
    return normalizeApiSupplier(extractSupplierRecord(response));
  } catch {
    const response = await api.post('/suppliers', body);
    return normalizeApiSupplier(extractSupplierRecord(response));
  }
};

export const updateSupplierRemote = async (supplierId, payload) => {
  const id = encodeURIComponent(String(supplierId || '').trim());
  const body = buildSupplierPayload(payload);
  try {
    const response = await api.put(`/v1/suppliers/${id}`, body);
    return normalizeApiSupplier(extractSupplierRecord(response));
  } catch {
    const response = await api.put(`/suppliers/${id}`, body);
    return normalizeApiSupplier(extractSupplierRecord(response));
  }
};

export const deleteSupplierRemote = async (supplierId) => {
  const id = encodeURIComponent(String(supplierId || '').trim());
  try {
    await api.delete(`/v1/suppliers/${id}`);
  } catch {
    await api.delete(`/suppliers/${id}`);
  }
};

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;
