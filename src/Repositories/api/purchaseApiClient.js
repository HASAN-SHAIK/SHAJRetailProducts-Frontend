import api from '../../utils/axios';
import {
  extractPurchaseCreateResponse,
  extractPurchaseDetail,
  extractPurchaseReturnResponse,
  extractPurchasesPayload,
  normalizePurchaseList,
} from './inventoryNormalizer';

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

const buildPurchaseParams = ({
  branchId = null,
  limit = 500,
  supplierId = null,
  startDate = null,
  endDate = null,
  page = 1,
} = {}) => {
  const resolvedBranchId = branchId || getSelectedBranchId();
  return {
    params: {
      limit,
      page,
      branch_id: resolvedBranchId || undefined,
      supplier_id: supplierId || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    },
    headers: withBranchHeaders(resolvedBranchId),
  };
};

export const listPurchasesRemote = async (options = {}) => {
  const { params, headers } = buildPurchaseParams(options);
  try {
    const response = await api.get('/v1/purchases', { params, headers });
    return normalizePurchaseList(extractPurchasesPayload(response));
  } catch {
    const response = await api.get('/purchases', { params, headers });
    return normalizePurchaseList(extractPurchasesPayload(response));
  }
};

export const fetchPurchaseDetailRemote = async (purchaseId) => {
  const id = encodeURIComponent(String(purchaseId || '').trim());
  try {
    const response = await api.get(`/v1/purchases/${id}`);
    return extractPurchaseDetail(response);
  } catch {
    const response = await api.get(`/purchases/${id}`);
    return extractPurchaseDetail(response);
  }
};

export const createPurchaseRemote = async (payload) => {
  try {
    const response = await api.post('/v1/purchases', payload);
    return extractPurchaseCreateResponse(response);
  } catch {
    const response = await api.post('/purchases', payload);
    return extractPurchaseCreateResponse(response);
  }
};

export const importPurchasePdfRemote = async (formData) => {
  const response = await api.post('/purchase/import-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response?.data?.data || {};
};

export const createPurchaseReturnRemote = async (payload) => {
  const response = await api.post('/purchase-returns', payload);
  return extractPurchaseReturnResponse(response);
};
