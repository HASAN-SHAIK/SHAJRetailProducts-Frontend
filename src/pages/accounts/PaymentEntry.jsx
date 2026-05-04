import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../utils/axios';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { getAllSuppliersCache, updateSuppliersCacheBulk } from '../../core/db';
import { createPayment, fetchPaymentEntries } from '../../services/accountingService';
import { enqueuePayment } from '../../utils/accountingOffline';
import { collectValidationErrors, firstValidationMessage } from '../../utils/formValidation';
import './Accounts.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
};

const dedupeSuppliers = (list = []) => {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw) continue;
    const nameKey = String(raw.name || '').trim().toLowerCase();
    const mobileKey = String(raw.mobile || raw.phone || '').trim().toLowerCase();
    const gstKey = String(raw.gst_number || '').trim().toLowerCase();
    const key = `n:${nameKey}|m:${mobileKey}|g:${gstKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
};

const supplierLabel = (supplier) => {
  const name = String(supplier?.name || '').trim();
  const mobile = String(supplier?.mobile || supplier?.phone || '').trim();
  const gst = String(supplier?.gst_number || '').trim();
  if (mobile && gst) return `${name} (${mobile}) - ${gst}`;
  if (mobile) return `${name} (${mobile})`;
  if (gst) return `${name} - ${gst}`;
  return name;
};

const PaymentEntry = () => {
  const { showPopup } = usePopup();
  const location = useLocation();
  const [suppliers, setSuppliers] = useState([]);
  const [supplierInput, setSupplierInput] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const cached = await getAllSuppliersCache();
      let list = Array.isArray(cached) ? cached : [];
      setSuppliers(dedupeSuppliers(list));
      if (!navigator.onLine) return;
      const res = await api.get('/suppliers', { params: { limit: 200 } });
      const serverList = res?.data?.data?.suppliers || res?.data?.suppliers || [];
      if (Array.isArray(serverList) && serverList.length) {
        updateSuppliersCacheBulk(serverList).catch(() => {});
      }
      setSuppliers(dedupeSuppliers(Array.isArray(serverList) ? serverList : list));
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location?.search || '');
    const partyType = String(params.get('party_type') || '').toLowerCase();
    const partyId = params.get('party_id');
    if (partyType === 'supplier' && partyId) {
      setSupplierId(String(partyId));
    }
  }, [location?.search]);

  const filtered = useMemo(() => {
    const list = suppliers || [];
    const needle = String(supplierInput || '').trim().toLowerCase();
    if (!needle) return list;
    return list.filter((supplier) => {
      const name = String(supplier?.name || '').toLowerCase();
      const mobile = String(supplier?.mobile || supplier?.phone || '').toLowerCase();
      const gst = String(supplier?.gst_number || '').toLowerCase();
      return name.includes(needle) || mobile.includes(needle) || gst.includes(needle);
    });
  }, [suppliers, supplierInput]);

  const resolveSupplierFromInput = (value) => {
    const needle = String(value || '').trim().toLowerCase();
    if (!needle) return null;
    const pool = suppliers || [];
    const exact = pool.find((supplier) => {
      const name = String(supplier?.name || '').trim().toLowerCase();
      const mobile = String(supplier?.mobile || supplier?.phone || '').trim().toLowerCase();
      const gst = String(supplier?.gst_number || '').trim().toLowerCase();
      const label = supplierLabel(supplier).toLowerCase();
      return name === needle || mobile === needle || gst === needle || label === needle;
    });
    if (exact) return exact;
    const matches = pool.filter((supplier) => {
      const name = String(supplier?.name || '').trim().toLowerCase();
      const mobile = String(supplier?.mobile || supplier?.phone || '').trim().toLowerCase();
      const gst = String(supplier?.gst_number || '').trim().toLowerCase();
      return name.includes(needle) || mobile.includes(needle) || gst.includes(needle);
    });
    return matches.length === 1 ? matches[0] : null;
  };

  const loadHistory = async () => {
    try {
      const payload = await fetchPaymentEntries({ limit: 50, range: 'all' });
      setHistory(Array.isArray(payload.entries) ? payload.entries : []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    if (!navigator.onLine) return;
    loadHistory();
  }, []);

  useEffect(() => {
    if (!supplierId) return;
    const selected = (suppliers || []).find((supplier) => String(supplier?.id) === String(supplierId));
    if (!selected) return;
    const label = supplierLabel(selected);
    if (label && label !== supplierInput) {
      setSupplierInput(label);
    }
  }, [supplierId, suppliers]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    const nextErrors = collectValidationErrors([
      { key: 'supplierId', validate: () => Boolean(supplierId), message: 'Select a supplier.' },
      { key: 'amount', validate: () => Number.isFinite(numericAmount) && numericAmount > 0, message: 'Amount must be greater than 0.' },
      { key: 'paymentMode', validate: () => Boolean(paymentMode), message: 'Select a payment mode.' }
    ]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showPopup(firstValidationMessage(nextErrors), 'Validation');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: 'supplier',
        supplier_id: Number(supplierId),
        amount: numericAmount,
        payment_mode: paymentMode,
        notes,
      };
      if (!navigator.onLine) {
        await enqueuePayment(payload);
        showPopup('Payment saved offline. Will sync later.', 'Offline');
      } else {
        await createPayment(payload);
        showPopup('Payment saved.', 'Success');
        loadHistory();
      }
      setSupplierId('');
      setSupplierInput('');
      setAmount('');
      setNotes('');
      setErrors({});
    } catch (error) {
      showPopup(error?.response?.data?.message || 'Failed to save payment.', 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="billing-page accounts-page">
      <div className="customers-header">
        <h3>Payment Entry</h3>
      </div>
      <form className="accounts-form" onSubmit={handleSubmit}>
        <label>
          Select Supplier *
          <input
            list="payment-supplier-options"
            className={`form-control billing-input ${errors.supplierId ? 'is-invalid' : ''}`}
            value={supplierInput}
            onChange={(event) => {
              const value = event.target.value;
              setSupplierInput(value);
              const matched = resolveSupplierFromInput(value);
              setSupplierId(matched ? String(matched.id) : '');
            }}
            onBlur={() => {
              const matched = resolveSupplierFromInput(supplierInput);
              setSupplierId(matched ? String(matched.id) : '');
            }}
            placeholder="Search by supplier name, number or GST"
          />
          <datalist id="payment-supplier-options">
            {filtered.map((supplier) => (
              <option key={supplier.id} value={supplierLabel(supplier)} />
            ))}
          </datalist>
          {errors.supplierId && <small className="text-danger">{errors.supplierId}</small>}
          {loading && <small className="text-secondary">Loading suppliers...</small>}
        </label>
        <label>
          Amount *
          <input
            className={`form-control billing-input ${errors.amount ? 'is-invalid' : ''}`}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          {errors.amount && <small className="text-danger">{errors.amount}</small>}
        </label>
        <label>
          Payment Mode *
          <select
            className={`form-control billing-input ${errors.paymentMode ? 'is-invalid' : ''}`}
            value={paymentMode}
            onChange={(event) => setPaymentMode(event.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
          </select>
          {errors.paymentMode && <small className="text-danger">{errors.paymentMode}</small>}
        </label>
        <label>
          Notes
          <input
            className="form-control billing-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Payment'}
        </button>
      </form>
      <div className="billing-table-wrapper mt-3">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Party</th>
              <th>Mode</th>
              <th>Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan="6" className="billing-empty">No payment entries.</td>
              </tr>
            )}
            {history.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.created_at)}</td>
                <td>{entry.txn_type || '-'}</td>
                <td>{entry.party_name || (entry.party_type === 'expense' ? 'Expense' : entry.party_id || '-')}</td>
                <td>{entry.payment_mode || '-'}</td>
                <td>INR {Number(entry.amount || 0).toFixed(2)}</td>
                <td>{entry.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentEntry;


