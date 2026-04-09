import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/axios';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { getAllCustomers, upsertCustomersBulk } from '../../core/db';
import { createReceipt } from '../../services/accountingService';
import { enqueueReceipt } from '../../utils/accountingOffline';
import './Accounts.css';

const ReceiptEntry = () => {
  const { showPopup } = usePopup();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadCustomers = async (term = '') => {
    setLoading(true);
    try {
      const cached = await getAllCustomers();
      let list = Array.isArray(cached) ? cached : [];
      if (term) {
        const needle = term.toLowerCase();
        list = list.filter((item) => {
          const name = String(item.name || '').toLowerCase();
          const mobile = String(item.mobile || '').toLowerCase();
          return name.includes(needle) || mobile.includes(needle);
        });
      }
      setCustomers(list);
      if (!navigator.onLine) return;
      const res = await api.get('/customers', { params: term ? { search: term, limit: 200 } : { limit: 200 } });
      const serverList = res?.data?.data?.customers || res?.data?.customers || [];
      if (Array.isArray(serverList) && serverList.length) {
        upsertCustomersBulk(serverList).catch(() => {});
      }
      setCustomers(Array.isArray(serverList) ? serverList : list);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadCustomers('');
  }, []);

  const filtered = useMemo(() => customers || [], [customers]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!customerId) {
      showPopup('Select a customer.', 'Validation');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showPopup('Amount must be > 0.', 'Validation');
      return;
    }
    if (!paymentMode) {
      showPopup('Select a payment mode.', 'Validation');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_id: Number(customerId),
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
      }
      setCustomerId('');
      setAmount('');
      setNotes('');
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
          Search Customer
          <input
            className="form-control billing-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or mobile"
          />
        </label>
        <label>
          Select Customer *
          <select
            className="form-control billing-input"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="">Select</option>
            {filtered.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.mobile ? `(${customer.mobile})` : ''}
              </option>
            ))}
          </select>
          {loading && <small className="text-secondary">Loading customers...</small>}
        </label>
        <label>
          Amount *
          <input
            className="form-control billing-input"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Payment Mode *
          <select
            className="form-control billing-input"
            value={paymentMode}
            onChange={(event) => setPaymentMode(event.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="upi">UPI</option>
            <option value="online">Online</option>
          </select>
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
    </div>
  );
};

export default ReceiptEntry;

