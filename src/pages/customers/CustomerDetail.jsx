import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { getCustomerById, upsertCustomersBulk } from '../../core/db';
import { getCachedOrdersByCustomer, upsertOrders } from '../../db/ordersDb';
import './Customers.css';

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('orders');
  const [loading, setLoading] = useState(true);

  const resolveCustomerId = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  };

  const fetchDetail = async ({ forceRemote = false } = {}) => {
    setLoading(true);
    const cached = await getCustomerById(resolveCustomerId(id));
    if (cached) {
      const cachedOrders = await getCachedOrdersByCustomer(cached);
      setData({ customer: cached, orders: cachedOrders, payments: [] });
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
      if (Array.isArray(payload?.orders) && payload.orders.length) {
        upsertOrders(payload.orders).catch(() => {});
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
          <button
            className="btn btn-success"
            type="button"
            onClick={() => navigate(`/accounts/receipt?party_type=customer&party_id=${id}`)}
          >
            Add Receipt
          </button>

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
