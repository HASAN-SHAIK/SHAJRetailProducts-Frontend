import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/axios';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { getAllSuppliersCache, updateSuppliersCacheBulk } from '../../core/db';
import { createPayment } from '../../services/accountingService';
import { enqueuePayment } from '../../utils/accountingOffline';
import './Accounts.css';

const PaymentEntry = () => {
  const { showPopup } = usePopup();
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadSuppliers = async (term = '') => {
    setLoading(true);
    try {
      const cached = await getAllSuppliersCache();
      let list = Array.isArray(cached) ? cached : [];
      if (term) {
        const needle = term.toLowerCase();
        list = list.filter((item) => {
          const name = String(item.name || '').toLowerCase();
          const mobile = String(item.mobile || item.phone || '').toLowerCase();
          const gst = String(item.gst_number || '').toLowerCase();
          return name.includes(needle) || mobile.includes(needle) || gst.includes(needle);
        });
      }
      setSuppliers(list);
      if (!navigator.onLine) return;
      const res = await api.get('/suppliers', { params: term ? { search: term, limit: 200 } : { limit: 200 } });
      const serverList = res?.data?.data?.suppliers || res?.data?.suppliers || [];
      if (Array.isArray(serverList) && serverList.length) {
        updateSuppliersCacheBulk(serverList).catch(() => {});
      }
      setSuppliers(Array.isArray(serverList) ? serverList : list);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuppliers(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadSuppliers('');
  }, []);

  const filtered = useMemo(() => suppliers || [], [suppliers]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!supplierId) {
      showPopup('Select a supplier.', 'Validation');
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
      }
      setSupplierId('');
      setAmount('');
      setNotes('');
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
          Search Supplier
          <input
            className="form-control billing-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or GST"
          />
        </label>
        <label>
          Select Supplier *
          <select
            className="form-control billing-input"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">Select</option>
            {filtered.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name} {supplier.mobile ? `(${supplier.mobile})` : ''}
              </option>
            ))}
          </select>
          {loading && <small className="text-secondary">Loading suppliers...</small>}
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
          {saving ? 'Saving...' : 'Save Payment'}
        </button>
      </form>
    </div>
  );
};

export default PaymentEntry;

