import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { getCustomerById, upsertCustomersBulk } from '../../core/db';
import './Customers.css';

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('orders');
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState({ amount: '', payment_mode: 'cash', notes: '' });
  const [error, setError] = useState('');

  const resolveCustomerId = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  };

  const fetchDetail = async ({ forceRemote = false } = {}) => {
    setLoading(true);
    setError('');
    const cached = await getCustomerById(resolveCustomerId(id));
    if (cached) {
      setData({ customer: cached, orders: [], payments: [] });
    }
    if (!navigator.onLine || (cached && !forceRemote)) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/customers/${id}`);
      const payload = res?.data?.data || null;
      setData(payload);
      if (payload?.customer) {
        upsertCustomersBulk([payload.customer]).catch(() => {});
      }
    } catch {
      if (!cached) {
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
      await api.post(`/customers/${id}/payments`, payment);
      setPayment({ amount: '', payment_mode: 'cash', notes: '' });
      fetchDetail();
      setTab('payments');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add payment');
    }
  };

  if (loading) {
    return (
      <div className="billing-page customers-page">
        <div className="billing-empty">Loading...</div>
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <div className="billing-page customers-page">
        <div className="billing-empty">Customer not found.</div>
      </div>
    );
  }

  const { customer, orders = [], payments = [] } = data;
  const balance = Number(customer.current_balance || 0);
  const creditLimit = Number(customer.credit_limit || 0);

  return (
    <div className="billing-page customers-page">
      <div className="customers-header">
        <div>
          <h3>{customer.name}</h3>
          <div>{customer.phone || customer.mobile || '-'}</div>
        </div>
        <div>
          <button className="btn btn-outline-primary" onClick={() => navigate(`/customers/${id}/edit`)}>
            Edit
          </button>
          <button className="btn btn-outline-secondary ms-2" onClick={() => fetchDetail({ forceRemote: true })}>
            Refresh
          </button>
          <button className="btn btn-outline-light ms-2" onClick={() => navigate('/customers')}>
            Back
          </button>
        </div>
      </div>

      <div className="customer-card customer-detail-grid">
        <div>
          <strong>Type</strong>
          <div>{customer.type || 'retail'}</div>
        </div>
        <div>
          <strong>Shop Name</strong>
          <div>{customer.shop_name || '-'}</div>
        </div>
        <div>
          <strong>GST Number</strong>
          <div>{customer.gst_number || '-'}</div>
        </div>
        <div>
          <strong>Balance</strong>
          <div>INR {balance.toFixed(2)}</div>
        </div>
        <div>
          <strong>Credit Limit</strong>
          <div>INR {creditLimit.toFixed(2)}</div>
        </div>
      </div>

      <div className="customer-tabs">
        <button className={`customer-tab${tab === 'orders' ? ' active' : ''}`} onClick={() => setTab('orders')}>
          Orders
        </button>
        <button className={`customer-tab${tab === 'credits' ? ' active' : ''}`} onClick={() => setTab('credits')}>
          Credits
        </button>
        <button className={`customer-tab${tab === 'payments' ? ' active' : ''}`} onClick={() => setTab('payments')}>
          Payments
        </button>
      </div>

      {tab === 'orders' && (
        <div className="billing-table-wrapper">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Billing Type</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan="6" className="billing-empty">No orders.</td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.billing_type || 'retail'}</td>
                  <td>{order.payment_mode || '-'}</td>
                  <td>{order.order_status}</td>
                  <td>INR {Number(order.total_price || 0).toFixed(2)}</td>
                  <td>{new Date(order.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'credits' && (
        <div className="customer-card">
          <div className="billing-option-group">
            <div>Total Credit Limit: INR {creditLimit.toFixed(2)}</div>
            <div>Outstanding Balance: INR {balance.toFixed(2)}</div>
            {creditLimit > 0 && balance > creditLimit && (
              <div className="billing-message">Credit limit exceeded.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="customer-card">
          <div className="customer-form-grid">
            <label className="billing-label">
              Amount
              <input
                className="form-control form-control-sm billing-input"
                type="number"
                value={payment.amount}
                onChange={(event) => setPayment((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </label>
            <label className="billing-label">
              Mode
              <select
                className="form-select form-select-sm"
                value={payment.payment_mode}
                onChange={(event) => setPayment((prev) => ({ ...prev, payment_mode: event.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank</option>
              </select>
            </label>
            <label className="billing-label">
              Notes
              <input
                className="form-control form-control-sm billing-input"
                value={payment.notes}
                onChange={(event) => setPayment((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
            <div style={{ alignSelf: 'end' }}>
              <button className="btn btn-success" type="button" onClick={handlePayment}>
                Add Payment
              </button>
            </div>
            {error && <div className="billing-message">{error}</div>}
          </div>

          <div className="billing-table-wrapper" style={{ marginTop: '16px' }}>
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Notes</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr>
                    <td colSpan="4" className="billing-empty">No payments.</td>
                  </tr>
                )}
                {payments.map((pay) => (
                  <tr key={pay.id}>
                    <td>INR {Number(pay.amount || 0).toFixed(2)}</td>
                    <td>{pay.payment_mode || '-'}</td>
                    <td>{pay.notes || '-'}</td>
                    <td>{new Date(pay.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDetail;
