import api from '../utils/axios';
import { saveTransactionsBulk, upsertAccountingTransaction, getAccountingTransactions } from '../core/db';

const generateClientTxnId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ctxn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizePaymentMode = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'cash';
  if (raw === 'upi' || raw === 'online') return 'online';
  if (raw === 'bank') return 'bank';
  return raw;
};

const normalizePurchasePaymentMode = (purchase = {}) => {
  const raw = String(
    purchase?.payment_mode ??
    purchase?.paymentMode ??
    purchase?.payment ??
    ''
  ).trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('bank')) return 'bank';
  if (raw === 'upi' || raw === 'online' || raw.includes('upi') || raw.includes('online')) return 'online';
  if (raw.includes('cash')) return 'cash';
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
    order_id: payload.order_id ?? payload.orderId ?? null,
    reference_type: payload.reference_type ?? payload.referenceType ?? null,
    reference_id: payload.reference_id ?? payload.referenceId ?? null,
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
      order_id: payload.order_id ?? null,
      reference_type: payload.reference_type ?? 'order',
      reference_id: payload.reference_id ?? payload.order_id ?? null,
      sync_status: 'synced',
    })
  );
  return res?.data?.data || res?.data;
};

export const createPayment = async (payload) => {
  const requestPayload = {
    type: payload?.type || 'supplier',
    client_txn_id: payload?.client_txn_id || payload?.clientTxnId || generateClientTxnId(),
    ...payload,
  };
  const res = await api.post('/accounts/payment', requestPayload);
  const serverId = res?.data?.data?.id ?? res?.data?.id ?? null;
  await upsertAccountingTransaction(
    buildLocalTxn(requestPayload, {
      id: serverId || `payment_${Date.now()}`,
      txn_type: 'payment',
      direction: 'out',
      party_type: 'supplier',
      party_id: requestPayload.supplier_id,
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
  if (filters.type) params.type = filters.type;
  if (filters.party_id) params.party_id = filters.party_id;
  if (filters.order_id) params.order_id = filters.order_id;
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

export const fetchReceiptEntries = async (filters = {}) => {
  const res = await api.get('/accounts/receipt', { params: queryParams(filters) });
  const payload = res?.data?.data || { entries: [], total: 0 };
  if (Array.isArray(payload.entries)) {
    saveTransactionsBulk(payload.entries).catch(() => {});
  }
  return payload;
};

export const fetchPaymentEntries = async (filters = {}) => {
  const res = await api.get('/accounts/payment', { params: queryParams(filters) });
  const payload = res?.data?.data || { entries: [], total: 0 };
  if (Array.isArray(payload.entries)) {
    saveTransactionsBulk(payload.entries).catch(() => {});
  }
  return payload;
};

const normalizeOrderId = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toArraySafe = (value) => (Array.isArray(value) ? value : []);

const parsePurchaseOrdersFromResponse = (responseData) => {
  const body = responseData?.data ?? responseData ?? {};
  const candidates = [
    body?.data?.purchases,
    body?.purchases,
    body?.data?.orders,
    body?.orders,
    body?.data,
    body,
  ];
  const list = candidates.find((entry) => Array.isArray(entry));
  return toArraySafe(list);
};

const parsePaymentsFromResponse = (responseData) => {
  const body = responseData?.data ?? responseData ?? {};
  const candidates = [
    body?.data?.entries,
    body?.entries,
    body?.data?.payments,
    body?.payments,
    body?.data,
    body,
  ];
  const list = candidates.find((entry) => Array.isArray(entry));
  return toArraySafe(list);
};

const extractPaymentOrderId = (payment) =>
  normalizeOrderId(payment?.order_id ?? payment?.orderId ?? payment?.reference_id ?? payment?.referenceId);

const extractPurchaseOrderId = (purchase = {}) =>
  purchase?.id ??
  purchase?.order_id ??
  purchase?.orderId ??
  purchase?.purchase_id ??
  purchase?.purchaseId ??
  null;

const extractPurchaseSupplierId = (purchase = {}) =>
  purchase?.supplier_id ??
  purchase?.supplierId ??
  purchase?.supplier?.id ??
  purchase?.supplier?.supplier_id ??
  null;

const extractPurchaseAmount = (purchase = {}) => {
  const amount = Number(
    purchase?.total_amount ??
    purchase?.total_price ??
    purchase?.total ??
    purchase?.grand_total ??
    purchase?.net_amount ??
    0
  );
  return Number.isFinite(amount) ? amount : 0;
};

export const backfillPurchasePayments = async ({ dryRun = false, onlyOrderIds = [] } = {}) => {
  const purchasesRes = await api.get('/purchases', { params: { limit: 2000 } });
  const paymentsRes = await api.get('/accounts/payment', { params: { limit: 5000, range: 'all', type: 'supplier' } });

  const listedPurchases = parsePurchaseOrdersFromResponse(purchasesRes?.data);
  const allPurchases = [...listedPurchases];
  const allPayments = parsePaymentsFromResponse(paymentsRes?.data);
  const existingPaymentOrderIds = new Set(
    allPayments
      .map((entry) => extractPaymentOrderId(entry))
      .filter(Boolean)
  );

  const targetOrderIds = new Set(
    (Array.isArray(onlyOrderIds) ? onlyOrderIds : [])
      .map((value) => normalizeOrderId(value))
      .filter(Boolean)
  );

  if (targetOrderIds.size > 0) {
    const listedById = new Map(
      allPurchases
        .map((purchase) => [normalizeOrderId(purchase?.id ?? purchase?.order_id), purchase])
        .filter(([id]) => Boolean(id))
    );
    const missingTargetIds = Array.from(targetOrderIds).filter((id) => !listedById.has(id));
    for (const targetId of missingTargetIds) {
      try {
        const detailRes = await api.get(`/purchases/${targetId}`);
        const detailBody = detailRes?.data?.data ?? detailRes?.data ?? {};
        const detailOrder = detailBody?.order ?? detailBody?.purchase ?? detailBody;
        if (detailOrder && (detailOrder?.id || detailOrder?.order_id)) {
          allPurchases.push(detailOrder);
        }
      } catch {
        // ignore missing/failed detail fetch; validation summary will report if still unresolved
      }
    }
  }

  const affectedOrders = allPurchases.filter((purchase) => {
    const mode = normalizePurchasePaymentMode(purchase);
    const orderId = normalizeOrderId(extractPurchaseOrderId(purchase));
    if (!orderId) return false;
    const isTargeted = targetOrderIds.size > 0 && targetOrderIds.has(orderId);
    if (!isTargeted && (mode !== 'cash' && mode !== 'bank')) return false;
    if (targetOrderIds.size > 0 && !isTargeted) return false;
    return !existingPaymentOrderIds.has(orderId);
  });

  let created = 0;
  let failed = 0;
  const failures = [];
  const affected_order_ids = affectedOrders
    .map((purchase) => normalizeOrderId(extractPurchaseOrderId(purchase)))
    .filter(Boolean);
  const unresolvedTargetIds = Array.from(targetOrderIds).filter((id) => !affected_order_ids.includes(id) && !existingPaymentOrderIds.has(id));

  if (dryRun) {
    return {
      scanned_purchases: allPurchases.length,
      scanned_payments: allPayments.length,
      affected_orders: affectedOrders.length,
      affected_order_ids,
      created: 0,
      failed: 0,
      failures: unresolvedTargetIds.map((order_id) => ({ order_id, reason: 'purchase_not_found_or_not_cash_bank_or_invalid' })),
      dry_run: true,
    };
  }

  for (const purchase of affectedOrders) {
    const orderId = extractPurchaseOrderId(purchase);
    const supplierId = extractPurchaseSupplierId(purchase);
    const amount = extractPurchaseAmount(purchase);
    const normalizedPurchaseMode = normalizePurchasePaymentMode(purchase);
    const paymentMode = normalizedPurchaseMode === 'cash' ? 'cash' : 'bank';
    const createdAt = purchase?.created_at || new Date().toISOString();
    if (!orderId || !supplierId || !(amount > 0)) {
      failed += 1;
      failures.push({ order_id: orderId, reason: 'invalid_purchase_payload' });
      continue;
    }
    try {
      await createPayment({
        type: 'supplier',
        supplier_id: supplierId,
        order_id: orderId,
        amount,
        payment_mode: paymentMode,
        created_at: createdAt,
        note: 'Backfilled payment',
        notes: 'Backfilled payment',
        skip_ledger: true,
      });
      created += 1;
    } catch (error) {
      failed += 1;
      failures.push({
        order_id: orderId,
        reason: error?.response?.data?.message || error?.message || 'payment_create_failed',
      });
    }
  }
  if (unresolvedTargetIds.length) {
    unresolvedTargetIds.forEach((order_id) => {
      failures.push({ order_id, reason: 'purchase_not_found_or_not_cash_bank_or_invalid' });
    });
  }

  return {
    scanned_purchases: allPurchases.length,
    scanned_payments: allPayments.length,
    affected_orders: affectedOrders.length,
    affected_order_ids,
    created,
    failed: failed + unresolvedTargetIds.length,
    failures,
    dry_run: false,
  };
};

export const reconcileSystem = async () => {
  const res = await api.get('/accounts/reconcile');
  return res?.data?.data || {};
};
