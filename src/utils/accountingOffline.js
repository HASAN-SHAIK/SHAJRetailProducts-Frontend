import { upsertAccountingTransaction } from '../core/db';
import { enqueueInventorySync, processInventorySyncQueue } from './inventorySync';

const createLocalId = () => `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildBaseTransaction = (payload = {}) => {
  const now = new Date().toISOString();
  return {
    id: createLocalId(),
    created_at: now,
    amount: Number(payload.amount || 0),
    payment_mode: payload.payment_mode || payload.paymentMode || 'cash',
    notes: payload.notes || null,
    sync_status: 'pending',
  };
};

export const enqueueReceipt = async (payload = {}) => {
  const entry = {
    ...buildBaseTransaction(payload),
    txn_type: 'receipt',
    direction: 'in',
    party_type: 'customer',
    party_id: payload.customer_id || payload.customerId,
  };
  await upsertAccountingTransaction(entry);
  await enqueueInventorySync({ type: 'accounting_txn', entityId: entry.id, action: 'create' });
  if (navigator.onLine) {
    processInventorySyncQueue().catch(() => {});
  }
  return entry;
};

export const enqueuePayment = async (payload = {}) => {
  const entry = {
    ...buildBaseTransaction(payload),
    txn_type: 'payment',
    direction: 'out',
    party_type: 'supplier',
    party_id: payload.supplier_id || payload.supplierId,
  };
  await upsertAccountingTransaction(entry);
  await enqueueInventorySync({ type: 'accounting_txn', entityId: entry.id, action: 'create' });
  if (navigator.onLine) {
    processInventorySyncQueue().catch(() => {});
  }
  return entry;
};
