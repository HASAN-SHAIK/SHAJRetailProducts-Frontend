import api from '../../utils/axios';
import {
  extractOfflineSyncResponse,
  extractOrderCreateResponse,
  extractOrderDetail,
  extractOrdersPayload,
} from './saleNormalizer';

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

export const listOrdersRemote = async ({
  page = 1,
  limit = 20,
  range = null,
  sortBy = 'created_at',
  sortOrder = 'desc',
  branchId = null,
  transactionType = null,
  view = null,
} = {}) => {
  const resolvedBranchId = branchId || getSelectedBranchId();
  const params = {
    page,
    limit,
    range: range || undefined,
    sort_by: sortBy || undefined,
    sort_order: sortOrder || undefined,
    branch_id: resolvedBranchId || undefined,
    transaction_type: transactionType || undefined,
    view: view || undefined,
  };
  const headers = withBranchHeaders(resolvedBranchId);

  try {
    const response = await api.get('/v1/sales', { params, headers });
    return extractOrdersPayload(response);
  } catch {
    const response = await api.get('/orders', { params, headers });
    return extractOrdersPayload(response);
  }
};

export const fetchOrderDetailRemote = async (orderId) => {
  const id = encodeURIComponent(String(orderId || '').trim());
  try {
    const response = await api.get(`/v1/sales/${id}`);
    return extractOrderDetail(response);
  } catch {
    const response = await api.get(`/orders/${id}`);
    return extractOrderDetail(response);
  }
};

export const createOrderRemote = async (payload, { timeout = undefined } = {}) => {
  try {
    const response = await api.post('/v1/sales', payload, { ...(timeout ? { timeout } : {}) });
    return extractOrderCreateResponse(response);
  } catch {
    const response = await api.post('/orders', payload, { ...(timeout ? { timeout } : {}) });
    return extractOrderCreateResponse(response);
  }
};

export const updateOrderRemote = async (orderId, payload) => {
  const id = encodeURIComponent(String(orderId || '').trim());
  try {
    const response = await api.put(`/v1/sales/${id}`, payload);
    return extractOrderCreateResponse(response);
  } catch {
    const response = await api.put(`/orders/${id}`, payload);
    return extractOrderCreateResponse(response);
  }
};

export const deleteOrderRemote = async (orderId) => {
  const id = encodeURIComponent(String(orderId || '').trim());
  try {
    await api.delete(`/v1/sales/${id}`);
  } catch {
    await api.delete(`/orders/${id}`);
  }
};

export const syncOfflineOrdersRemote = async ({ syncId, orders = [] }) => {
  const response = await api.post('/orders/offline-sync', {
    sync_id: syncId,
    orders,
  });
  return extractOfflineSyncResponse(response);
};

export const markOrderPaidRemote = async (payload) => {
  const response = await api.post('/orders/mark-paid', payload);
  return response?.data ?? {};
};

export const createOrderReturnRemote = async (orderId, payload) => {
  const id = encodeURIComponent(String(orderId || '').trim());
  const response = await api.post(`/orders/${id}/returns`, payload);
  return response?.data ?? {};
};

export const fetchReturnsRemote = async () => {
  const response = await api.get('/returns');
  return Array.isArray(response?.data?.returns) ? response.data.returns : [];
};

export const fetchCorrectionsRemote = async () => {
  const response = await api.get('/corrections');
  return Array.isArray(response?.data?.corrections) ? response.data.corrections : [];
};

export const createCorrectionRemote = async (payload) => {
  const response = await api.post('/corrections', payload);
  return response?.data ?? {};
};

export const deleteReturnRemote = async (returnId) => {
  await api.delete(`/returns/${encodeURIComponent(String(returnId || '').trim())}`);
};

export const upsertReturnRemote = async (returnId, payload) => {
  const id = encodeURIComponent(String(returnId || '').trim());
  if (returnId) {
    await api.put(`/returns/${id}`, payload);
    return;
  }
  await api.post('/returns', payload);
};

export const deleteCorrectionRemote = async (correctionId) => {
  await api.delete(`/corrections/${encodeURIComponent(String(correctionId || '').trim())}`);
};

export const upsertCorrectionRemote = async (correctionId, payload) => {
  const id = encodeURIComponent(String(correctionId || '').trim());
  if (correctionId) {
    await api.put(`/corrections/${id}`, payload);
    return;
  }
  await api.post('/corrections', payload);
};
