import api from '../utils/axios';

export const lookupProductForAudit = async (query) => {
  const q = String(query || '').trim();
  if (!q) return null;
  const res = await api.get('/stock/audit/lookup', {
    params: { query: q },
  });
  return res?.data?.product || null;
};

export const submitStockAudit = async (payload) => {
  const res = await api.post('/stock/audit/submit-scan', payload);
  return res?.data || null;
};
