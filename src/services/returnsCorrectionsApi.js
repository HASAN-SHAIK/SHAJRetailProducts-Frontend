import api from '../utils/axios';

export const fetchAllSalesOrders = async () => {
  const limit = 100;
  let page = 1;
  let totalPages = 1;
  const collected = [];

  do {
    const res = await api.get('/orders', {
      params: {
        page,
        limit,
        range: 'all',
        sort_by: 'created_at',
        sort_order: 'desc',
      },
    });
    const payload = res?.data || {};
    const list = Array.isArray(payload.orders) ? payload.orders : [];
    collected.push(...list);
    totalPages = Number(payload?.pagination?.total_pages || 1);
    page += 1;
  } while (page <= totalPages);

  return collected.filter((order) => String(order?.transaction_type || '').toLowerCase() !== 'purchase');
};

export const fetchOrderDetails = async (orderId) => {
  const res = await api.get(`/orders/${orderId}`);
  return res?.data?.order || res?.data || null;
};

export const createOrderReturn = async (orderId, payload) => {
  const res = await api.post(`/orders/${orderId}/returns`, payload);
  return res?.data || {};
};

export const fetchReturns = async () => {
  const res = await api.get('/returns');
  return Array.isArray(res?.data?.returns) ? res.data.returns : [];
};

export const fetchCorrections = async () => {
  const res = await api.get('/corrections');
  return Array.isArray(res?.data?.corrections) ? res.data.corrections : [];
};

export const createCorrection = async (payload) => {
  const res = await api.post('/corrections', payload);
  return res?.data || {};
};

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
