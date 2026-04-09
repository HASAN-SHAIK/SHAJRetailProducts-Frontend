import api from '../utils/axios';
import { saveTransactionsBulk, upsertAccountingTransaction, getAccountingTransactions } from '../core/db';

const normalizePaymentMode = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'cash';
  if (raw === 'upi' || raw === 'online') return 'online';
  if (raw === 'bank') return 'bank';
  return raw;
};

const buildLocalTxn = (payload, overrides = {}) => {
  const now = new Date().toISOString();
  return {
    id: overrides.id || `remote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: overrides.created_at || now,
    amount: Number(payload.amount || 0),
    total_price: Number(payload.amount || 0),
    payment_mode: normalizePaymentMode(payload.payment_mode || payload.paymentMode || payload.payment),
    notes: payload.notes || null,
    txn_type: overrides.txn_type || payload.txn_type,
    direction: overrides.direction || payload.direction,
    party_type: overrides.party_type || payload.party_type,
    party_id: overrides.party_id || payload.party_id,
    sync_status: overrides.sync_status || 'synced',
  };
};

export const createReceipt = async (payload) => {
  const res = await api.post('/accounts/receipt', payload);
  const serverId = res?.data?.data?.id ?? res?.data?.id ?? null;
  await upsertAccountingTransaction(
    buildLocalTxn(payload, {
      id: serverId || `receipt_${Date.now()}`,
      txn_type: 'receipt',
      direction: 'in',
      party_type: 'customer',
      party_id: payload.customer_id,
      sync_status: 'synced',
    })
  );
  return res?.data?.data || res?.data;
};

export const createPayment = async (payload) => {
  const res = await api.post('/accounts/payment', payload);
  const serverId = res?.data?.data?.id ?? res?.data?.id ?? null;
  await upsertAccountingTransaction(
    buildLocalTxn(payload, {
      id: serverId || `payment_${Date.now()}`,
      txn_type: 'payment',
      direction: 'out',
      party_type: 'supplier',
      party_id: payload.supplier_id,
      sync_status: 'synced',
    })
  );
  return res?.data?.data || res?.data;
};

const queryParams = (filters = {}) => {
  const params = {};
  if (filters.range) params.range = filters.range;
  if (filters.start_date) params.start_date = filters.start_date;
  if (filters.end_date) params.end_date = filters.end_date;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;
  if (filters.party_type) params.party_type = filters.party_type;
  if (filters.party_id) params.party_id = filters.party_id;
  if (filters.branch_id) params.branch_id = filters.branch_id;
  return params;
};

export const fetchCashBook = async (filters = {}) => {
  if (!navigator.onLine) {
    const cached = await getAccountingTransactions({ paymentModes: ['cash'], startDate: filters.start_date, endDate: filters.end_date });
    return { entries: cached, page: 1, limit: cached.length, total: cached.length };
  }
  const res = await api.get('/accounts/cashbook', { params: queryParams(filters) });
  const payload = res?.data?.data || {};
  if (Array.isArray(payload.entries)) {
    saveTransactionsBulk(payload.entries).catch(() => {});
  }
  return payload;
};

export const fetchBankBook = async (filters = {}) => {
  if (!navigator.onLine) {
    const cached = await getAccountingTransactions({ paymentModes: ['bank', 'upi', 'online'], startDate: filters.start_date, endDate: filters.end_date });
    return { entries: cached, page: 1, limit: cached.length, total: cached.length };
  }
  const res = await api.get('/accounts/bankbook', { params: queryParams(filters) });
  const payload = res?.data?.data || {};
  if (Array.isArray(payload.entries)) {
    saveTransactionsBulk(payload.entries).catch(() => {});
  }
  return payload;
};

export const fetchLedger = async (filters = {}) => {
  if (!navigator.onLine) {
    const cached = await getAccountingTransactions({
      partyType: filters.party_type,
      partyId: filters.party_id,
      startDate: filters.start_date,
      endDate: filters.end_date,
    });
    return { entries: cached, page: 1, limit: cached.length, total: cached.length };
  }
  const res = await api.get('/accounts/ledger', { params: queryParams(filters) });
  return res?.data?.data || {};
};

export const fetchOutstanding = async (filters = {}) => {
  if (!navigator.onLine) {
    return { rows: [] };
  }
  const res = await api.get('/accounts/outstanding', { params: queryParams(filters) });
  return res?.data?.data || {};
};
