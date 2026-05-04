import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../utils/axios';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { getAllCustomers, upsertCustomersBulk } from '../../core/db';
import { createReceipt, fetchReceiptEntries } from '../../services/accountingService';
import { enqueueReceipt } from '../../utils/accountingOffline';
import { collectValidationErrors, firstValidationMessage } from '../../utils/formValidation';
import './Accounts.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
};

const dedupeCustomers = (list = []) => {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw) continue;
    const nameKey = String(raw.name || '').trim().toLowerCase();
    const phoneKey = String(raw.mobile || raw.phone || '').trim().toLowerCase();
    const key = phoneKey ? `np:${nameKey}|${phoneKey}` : `n:${nameKey}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
};

const customerLabel = (customer) => {
  const name = String(customer?.name || '').trim();
  const mobile = String(customer?.mobile || customer?.phone || '').trim();
  return mobile ? `${name} (${mobile})` : name;
};

const ReceiptEntry = () => {
  const { showPopup } = usePopup();
  const location = useLocation();
  const [customers, setCustomers] = useState([]);
  const [customerInput, setCustomerInput] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const cached = await getAllCustomers();
      let list = Array.isArray(cached) ? cached : [];
      setCustomers(dedupeCustomers(list));
      if (!navigator.onLine) return;
      const res = await api.get('/customers', { params: { limit: 200 } });
      const serverList = res?.data?.data?.customers || res?.data?.customers || [];
      if (Array.isArray(serverList) && serverList.length) {
        upsertCustomersBulk(serverList).catch(() => {});
      }
      setCustomers(dedupeCustomers(Array.isArray(serverList) ? serverList : list));
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadHistory = async () => {
    try {
      const payload = await fetchReceiptEntries({ limit: 50 });
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
    const prefill = location?.state?.receiptPrefill || null;
    const params = new URLSearchParams(location?.search || '');
    const partyType = String(params.get('party_type') || '').toLowerCase();
    const prefillCustomerId = prefill?.customerId ?? params.get('customer_id') ?? (partyType === 'customer' ? params.get('party_id') : '') ?? '';
    const prefillOrderId = prefill?.orderId ?? params.get('order_id') ?? '';
    const prefillAmount = prefill?.amount ?? params.get('amount') ?? '';
    if (prefillCustomerId) setCustomerId(String(prefillCustomerId));
    if (prefillOrderId) setOrderId(String(prefillOrderId));
    if (prefillAmount && Number(prefillAmount) > 0) setAmount(String(prefillAmount));
  }, [location?.state, location?.search]);

  const filtered = useMemo(() => {
    const list = customers || [];
    const needle = String(customerInput || '').trim().toLowerCase();
    if (!needle) return list;
    return list.filter((customer) => {
      const name = String(customer?.name || '').toLowerCase();
      const mobile = String(customer?.mobile || customer?.phone || '').toLowerCase();
      return name.includes(needle) || mobile.includes(needle);
    });
  }, [customers, customerInput]);

  const resolveCustomerFromInput = (value) => {
    const needle = String(value || '').trim().toLowerCase();
    if (!needle) return null;
    const pool = customers || [];
    const exact = pool.find((customer) => {
      const name = String(customer?.name || '').trim().toLowerCase();
      const mobile = String(customer?.mobile || customer?.phone || '').trim().toLowerCase();
      const label = `${name}${mobile ? ` (${mobile})` : ''}`;
      return name === needle || mobile === needle || label === needle;
    });
    if (exact) return exact;
    // If user typed number/name fragment and only one match remains, auto-pick it.
    const matches = pool.filter((customer) => {
      const name = String(customer?.name || '').trim().toLowerCase();
      const mobile = String(customer?.mobile || customer?.phone || '').trim().toLowerCase();
      return name.includes(needle) || mobile.includes(needle);
    });
    return matches.length === 1 ? matches[0] : null;
  };

  useEffect(() => {
    if (!customerId) return;
    const selected = (customers || []).find((customer) => String(customer?.id) === String(customerId));
    if (!selected) return;
    const label = customerLabel(selected);
    if (label && label !== customerInput) {
      setCustomerInput(label);
    }
    if (!amount || Number(amount) <= 0) {
      const outstanding = Number(selected?.current_balance || 0);
      if (Number.isFinite(outstanding) && outstanding > 0) {
        setAmount(String(outstanding.toFixed(2)));
      }
    }
  }, [customerId, customers]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    const nextErrors = collectValidationErrors([
      { key: 'customerId', validate: () => Boolean(customerId), message: 'Select a customer.' },
      { key: 'orderId', validate: () => Boolean(String(orderId || '').trim()), message: 'Order ID is required.' },
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
        customer_id: Number(customerId),
        order_id: String(orderId).trim(),
        reference_type: 'order',
        reference_id: String(orderId).trim(),
        amount: numericAmount,
        payment_mode: paymentMode,
        notes,
      };
      if (!navigator.onLine) {
        await enqueueReceipt(payload);
        showPopup('Receipt saved offline. Will sync later.', 'Offline');
      } else {
        await createReceipt(payload);
        showPopup('Receipt saved.', 'Success');
        loadHistory();
      }
      setCustomerInput('');
      setCustomerId('');
      setOrderId('');
      setAmount('');
      setNotes('');
      setErrors({});
    } catch (error) {
      showPopup(error?.response?.data?.message || 'Failed to save receipt.', 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="billing-page accounts-page">
      <div className="customers-header">
        <h3>Receipt Entry</h3>
      </div>
      <form className="accounts-form" onSubmit={handleSubmit}>
        <label>
          Select Customer *
          <input
            list="receipt-customer-options"
            className={`form-control billing-input ${errors.customerId ? 'is-invalid' : ''}`}
            value={customerInput}
            onChange={(event) => {
              const value = event.target.value;
              setCustomerInput(value);
              const matched = resolveCustomerFromInput(value);
              setCustomerId(matched ? String(matched.id) : '');
            }}
            onBlur={() => {
              const matched = resolveCustomerFromInput(customerInput);
              setCustomerId(matched ? String(matched.id) : '');
            }}
            placeholder="Search by customer name or number"
          />
          <datalist id="receipt-customer-options">
            {filtered.map((customer) => (
              <option key={customer.id} value={customerLabel(customer)} />
            ))}
          </datalist>
          {errors.customerId && <small className="text-danger">{errors.customerId}</small>}
          {loading && <small className="text-secondary">Loading customers...</small>}
        </label>
        <label>
          Order ID *
          <input
            className={`form-control billing-input ${errors.orderId ? 'is-invalid' : ''}`}
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="Enter order id"
          />
          {errors.orderId && <small className="text-danger">{errors.orderId}</small>}
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
            <option value="upi">UPI</option>
            <option value="online">Online</option>
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
          {saving ? 'Saving...' : 'Save Receipt'}
        </button>
      </form>
      <div className="billing-table-wrapper mt-3">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Customer</th>
              <th>Mode</th>
              <th>Amount</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan="6" className="billing-empty">No receipt entries.</td>
              </tr>
            )}
            {history.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.created_at)}</td>
                <td>{entry.txn_type || '-'}</td>
                <td>{entry.party_name || entry.party_id || '-'}</td>
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

export default ReceiptEntry;



