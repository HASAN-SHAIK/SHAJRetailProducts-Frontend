import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { getSupplierCacheById } from '../../core/db';
import './Suppliers.css';

const SupplierDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState({ amount: '', payment_mode: 'cash', notes: '' });
  const [error, setError] = useState('');

  const fetchDetail = async () => {
    setLoading(true);
    try {
      if (!navigator.onLine) throw new Error('offline');
      const res = await api.get(`/suppliers/${id}/ledger`);
      setData(res?.data?.data || null);
    } catch {
      const cached = await getSupplierCacheById(id);
      if (cached) {
        setData({ supplier: cached, ledger: [], offline: true });
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handlePayment = async () => {
    if (!payment.amount) return;
    try {
      if (!navigator.onLine) throw new Error('offline');
      await api.post(`/suppliers/${id}/payments`, payment);
      setPayment({ amount: '', payment_mode: 'cash', notes: '' });
      fetchDetail();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add payment');
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
        {isOffline && <div className="billing-error">Payments are unavailable offline.</div>}
        <div className="customer-form-grid">
          <label>
            Amount
            <input
              className="form-control billing-input"
              type="number"
              min="0"
              value={payment.amount}
              onChange={(event) => setPayment((prev) => ({ ...prev, amount: event.target.value }))}
              disabled={isOffline}
            />
          </label>
          <label>
            Payment Mode
            <select
              className="form-control billing-input"
              value={payment.payment_mode}
              onChange={(event) => setPayment((prev) => ({ ...prev, payment_mode: event.target.value }))}
              disabled={isOffline}
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
              disabled={isOffline}
            />
          </label>
        </div>
        <button className="btn btn-primary" type="button" onClick={handlePayment} disabled={isOffline}>
          Add Payment
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
            {ledger.length === 0 && (
              <tr>
                <td colSpan="5" className="billing-empty">No ledger entries.</td>
              </tr>
            )}
            {ledger.map((entry) => (
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
