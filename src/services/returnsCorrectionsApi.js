import {
  createCorrectionRemote,
  createOrderReturnRemote,
  deleteCorrectionRemote,
  deleteReturnRemote,
  fetchCorrectionsRemote,
  fetchOrderDetailRemote,
  fetchReturnsRemote,
  listOrdersRemote,
  upsertCorrectionRemote,
  upsertReturnRemote,
} from '../Repositories/api/saleApiClient';
import api from '../utils/axios';

export const fetchAllSalesOrders = async () => {
  const limit = 100;
  let page = 1;
  let totalPages = 1;
  const collected = [];

  do {
    const { list, pagination } = await listOrdersRemote({
      page,
      limit,
      range: 'all',
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
    collected.push(...list);
    totalPages = Number(pagination?.total_pages || 1);
    page += 1;
  } while (page <= totalPages);

  return collected.filter((order) => String(order?.transaction_type || '').toLowerCase() !== 'purchase');
};

export const fetchOrderDetails = async (orderId) => fetchOrderDetailRemote(orderId);

export const createOrderReturn = async (orderId, payload) => createOrderReturnRemote(orderId, payload);

export const fetchReturns = async () => fetchReturnsRemote();

export const fetchCorrections = async () => fetchCorrectionsRemote();

export const createCorrection = async (payload) => createCorrectionRemote(payload);

export const deleteReturn = async (returnId) => deleteReturnRemote(returnId);

export const upsertReturn = async (returnId, payload) => upsertReturnRemote(returnId, payload);

export const deleteCorrection = async (correctionId) => deleteCorrectionRemote(correctionId);

export const upsertCorrection = async (correctionId, payload) => upsertCorrectionRemote(correctionId, payload);

export const fetchGstSummary = async () => {
  const res = await api.get('/gst/summary');
  return res?.data?.summary || null;
};

export const fetchGstLedger = async () => {
  const res = await api.get('/gst/ledger');
  return Array.isArray(res?.data?.entries) ? res.data.entries : [];
};

export const fetchGstReports = async ({ from, to } = {}) => {
  const res = await api.get('/gst/reports', { params: { from: from || undefined, to: to || undefined } });
  return Array.isArray(res?.data?.reports) ? res.data.reports : [];
};

export const fetchGstFilingData = async () => {
  const res = await api.get('/gst/filing');
  return res?.data?.data || { b2b: [], b2c: [], credit_notes: [], raw: [] };
};
