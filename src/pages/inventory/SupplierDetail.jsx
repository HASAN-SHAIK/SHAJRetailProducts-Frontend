import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import {
  getAccountingTransactions,
  getSupplierCacheById,
  getSupplierLedgerBySupplierId,
  getConfigValue,
  saveConfigValue,
  saveTransactionsBulk,
  upsertAccountingTransaction,
  upsertSupplierLedgerBulk,
  upsertSupplierLedgerEntry,
  updateSuppliersCacheBulk,
} from '../../core/db';
import { enqueuePayment } from '../../utils/accountingOffline';
import { processInventorySyncQueue } from '../../utils/inventorySync';
import './Suppliers.css';

const SupplierDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState({ amount: '', payment_mode: 'cash', notes: '' });
  const [error, setError] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const mapLedgerToTransaction = (entry) => {
    if (!entry) return null;
    const type = String(entry.type || entry.txn_type || '').toLowerCase();
    if (type !== 'payment') return null;
    const resolvedId = entry.id || entry.payment_id || entry.transaction_id;
    if (!resolvedId) return null;
    return {
      id: resolvedId,
      txn_type: 'payment',
      direction: 'out',
      party_type: 'supplier',
      party_id: id,
      amount: Number(entry.amount || entry.total_amount || 0),
      payment_mode: entry.payment_mode || 'cash',
      notes: entry.notes || null,
      sync_status: 'synced',
      created_at: entry.created_at || entry.createdAt || new Date().toISOString(),
    };
  };

  const buildLocalLedger = (transactions = []) =>
    transactions.map((entry) => ({
      id: entry.id,
      type: entry.txn_type || 'payment',
      amount: entry.amount,
      payment_mode: entry.payment_mode,
      running_balance: null,
      created_at: entry.created_at,
      sync_status: entry.sync_status,
    }));

  const mergeLedgerLists = (base = [], extras = []) => {
    const merged = new Map();
    base.forEach((entry) => {
      if (!entry?.id) return;
      merged.set(String(entry.id), entry);
    });
    extras.forEach((entry) => {
      if (!entry?.id) return;
      const key = String(entry.id);
      if (!merged.has(key)) {
        merged.set(key, entry);
      }
    });
    return Array.from(merged.values());
  };

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const cachedSupplier = await getSupplierCacheById(id);
      const cachedLedger = await getSupplierLedgerBySupplierId(String(id));
      const cacheKey = `supplier_ledger_cache_${id}`;
      const cacheReady = await getConfigValue(cacheKey);
      const cachedTxns = await getAccountingTransactions({ partyType: 'supplier', partyId: id });
      if (Array.isArray(cachedTxns)) {
        cachedTxns
          .filter((entry) => entry && entry.party_type === 'supplier' && entry.sync_status === 'pending' && !entry.source)
          .forEach((entry) => {
            upsertAccountingTransaction({ ...entry, source: 'supplier_ledger' }).catch(() => {});
          });
      }
      const pendingList = Array.isArray(cachedTxns)
        ? cachedTxns.filter((entry) => String(entry.sync_status || '').toLowerCase() === 'pending')
        : [];
      const pendingLedger = buildLocalLedger(pendingList);

      const hasCachedLedger = Array.isArray(cachedLedger) && cachedLedger.length > 0;
      if (cachedSupplier) {
        setData({
          supplier: cachedSupplier,
          ledger: mergeLedgerLists(cachedLedger, pendingLedger),
          offline: !navigator.onLine,
        });
        setLoading(false);
      }

      if (!navigator.onLine) {
        if (!cachedSupplier) setData(null);
        return;
      }

      if (cachedSupplier && (hasCachedLedger || cacheReady)) {
        processInventorySyncQueue().catch(() => {});
        return;
      }

      processInventorySyncQueue().catch(() => {});

      try {
        const res = await api.get(`/suppliers/${id}/ledger`);
        const serverData = res?.data?.data || null;
        if (serverData?.supplier) {
          updateSuppliersCacheBulk([serverData.supplier]).catch(() => {});
          const ledger = Array.isArray(serverData.ledger) ? serverData.ledger : [];
          const ledgerWithSupplier = ledger.map((entry) => ({
            ...entry,
            supplier_id: String(entry.supplier_id ?? id),
          }));
          const transactions = ledger.map(mapLedgerToTransaction).filter(Boolean);
          if (transactions.length) {
            await saveTransactionsBulk(transactions).catch(() => {});
          }
          await upsertSupplierLedgerBulk(ledgerWithSupplier).catch(() => {});
          if (pendingList.length) {
            const mappedPending = buildLocalLedger(pendingList);
            serverData.ledger = mergeLedgerLists(ledgerWithSupplier, mappedPending);
          }
          await saveConfigValue(cacheKey, { ready: true, updatedAt: new Date().toISOString() }).catch(() => {});
        }
        setData(serverData);
      } catch {
        if (!cachedSupplier) setData(null);
      } finally {
        setLoading(false);
      }
    } catch {
      const cached = await getSupplierCacheById(id);
      const cachedLedger = await getSupplierLedgerBySupplierId(String(id));
      const pendingPayments = await getAccountingTransactions({ partyType: 'supplier', partyId: id });
      if (cached) {
        setData({
          supplier: cached,
          ledger: mergeLedgerLists(cachedLedger, buildLocalLedger(pendingPayments)),
          offline: true,
        });
      } else {
        setData(null);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handlePayment = async () => {
    if (!payment.amount || savingPayment) return;
    setSavingPayment(true);
    setError('');
    try {
      if (data?.supplier?.id) {
        updateSuppliersCacheBulk([data.supplier]).catch(() => {});
      }
      const entry = await enqueuePayment({ ...payment, supplier_id: id, source: 'supplier_ledger' });
      const paidAmount = Number(entry.amount || payment.amount || 0);
      const currentBalance = Number(data?.supplier?.current_balance || 0);
      const nextBalance = currentBalance - paidAmount;
      const localEntry = {
        id: entry.id,
        type: 'payment',
        amount: entry.amount,
        payment_mode: entry.payment_mode,
        running_balance: nextBalance,
        created_at: entry.created_at,
        sync_status: entry.sync_status,
      };
      await upsertSupplierLedgerEntry({ ...localEntry, supplier_id: String(id) }).catch(() => {});
      setPayment({ amount: '', payment_mode: 'cash', notes: '' });
      setData((prev) => {
        if (!prev?.supplier) return prev;
        const ledger = Array.isArray(prev.ledger) ? prev.ledger : [];
        const nextSupplier = {
          ...prev.supplier,
          current_balance: nextBalance,
        };
        updateSuppliersCacheBulk([nextSupplier]).catch(() => {});
        return { ...prev, supplier: nextSupplier, ledger: [localEntry, ...ledger], offline: !navigator.onLine };
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add payment');
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="billing-page suppliers-page">
        <div className="billing-empty">Loading...</div>
      </div>
    );
  }

  if (!data?.supplier) {
    return (
      <div className="billing-page suppliers-page">
        <div className="billing-empty">Supplier not found.</div>
      </div>
    );
  }

  const { supplier, ledger = [] } = data;
  const balance = Number(supplier.current_balance || 0);
  const creditLimit = Number(supplier.credit_limit || 0);
  const isOffline = data?.offline === true || !navigator.onLine;
  const displayLedger = (() => {
    if (!Array.isArray(ledger) || ledger.length === 0) return [];
    const sorted = [...ledger].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
    let running = balance;
    return sorted.map((entry) => {
      const amount = Number(entry.amount || 0);
      const type = String(entry.type || '').toLowerCase();
      const resolvedRunning =
        entry.running_balance !== null && entry.running_balance !== undefined
          ? Number(entry.running_balance || 0)
          : running;
      if (type === 'purchase') {
        running = resolvedRunning - amount;
      } else if (type === 'payment' || type === 'return') {
        running = resolvedRunning + amount;
      } else {
        running = resolvedRunning;
      }
      return { ...entry, running_balance: resolvedRunning };
    });
  })();

  return (
    <div className="billing-page suppliers-page">
      <div className="customers-header">
        <div>
          <h3>{supplier.name}</h3>
          <div>{supplier.mobile || '-'}</div>
        </div>
        <div>
          <button className="btn btn-outline-primary" onClick={() => navigate(`/inventory/suppliers/${id}/edit`)}>
            Edit
          </button>
          <button className="btn btn-outline-light ms-2" onClick={() => navigate('/inventory/suppliers')}>
            Back
          </button>
        </div>
      </div>

      <div className="customer-card customer-detail-grid">
        <div>
          <div className="customer-card__label">GST Number</div>
          <div>{supplier.gst_number || '-'}</div>
        </div>
        <div>
          <div className="customer-card__label">Balance</div>
          <div>INR {balance.toFixed(2)}</div>
        </div>
        <div>
          <div className="customer-card__label">Credit Limit</div>
          <div>INR {creditLimit.toFixed(2)}</div>
        </div>
      </div>

      <div className="customer-card">
        <h5 className="section-title">Add Payment</h5>
        {error && <div className="billing-error">{error}</div>}
        {isOffline && <div className="billing-error">You are offline. Payments will be saved and synced later.</div>}
        <div className="customer-form-grid">
          <label>
            Amount
            <input
              className="form-control billing-input"
              type="number"
              min="0"
              value={payment.amount}
              onChange={(event) => setPayment((prev) => ({ ...prev, amount: event.target.value }))}
              disabled={savingPayment}
            />
          </label>
          <label>
            Payment Mode
            <select
              className="form-control billing-input"
              value={payment.payment_mode}
              onChange={(event) => setPayment((prev) => ({ ...prev, payment_mode: event.target.value }))}
              disabled={savingPayment}
            >
              <option value="cash">Cash</option>
              <option value="online">Online</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
            </select>
          </label>
          <label>
            Notes
            <input
              className="form-control billing-input"
              value={payment.notes}
              onChange={(event) => setPayment((prev) => ({ ...prev, notes: event.target.value }))}
              disabled={savingPayment}
            />
          </label>
        </div>
        <button className="btn btn-primary" type="button" onClick={handlePayment} disabled={savingPayment}>
          {savingPayment ? 'Adding payment...' : 'Add Payment'}
        </button>
      </div>

      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Payment Mode</th>
              <th>Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {displayLedger.length === 0 && (
              <tr>
                <td colSpan="5" className="billing-empty">No ledger entries.</td>
              </tr>
            )}
            {displayLedger.map((entry) => (
              <tr key={`${entry.type}-${entry.id}`}>
                <td>{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '-'}</td>
                <td>{entry.type}</td>
                <td>INR {Number(entry.amount || 0).toFixed(2)}</td>
                <td>{entry.payment_mode || '-'}</td>
                <td>INR {Number(entry.running_balance || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierDetail;
