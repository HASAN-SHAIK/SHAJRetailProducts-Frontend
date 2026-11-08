import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCustomerDetail } from '../../services/local';
import { isLocalPosEnabled } from '../../Repositories/local/posLocalApiClient';
import {
  formatDateTime,
  formatInr,
  getAvailableCredit,
  isOverCreditLimit,
} from './customerHelpers';
import PaymentReminderModal from '../../components/customers/PaymentReminderModal';
import './Customers.css';

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('orders');
  const [reminderModalOpen, setReminderModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getCustomerDetail(id)
      .then((result) => {
        if (!active) return;
        setDetail(result || null);
      })
      .catch(() => {
        if (!active) return;
        setDetail(null);
        setError('Could not load this customer. Check the connection and try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="billing-page customers-page">
        <div className="billing-empty">Loading customer...</div>
      </div>
    );
  }

  if (error || !detail?.customer) {
    return (
      <div className="billing-page customers-page">
        <div className="customers-header">
          <h3>Customer</h3>
          <button type="button" className="btn btn-outline-light" onClick={() => navigate('/customers')}>
            Back
          </button>
        </div>
        <div className={error ? 'billing-error' : 'billing-empty'} role={error ? 'alert' : undefined}>
          {error || 'Customer not found.'}
        </div>
      </div>
    );
  }

  const { customer } = detail;
  const orders = Array.isArray(detail.orders) ? detail.orders : [];
  const payments = Array.isArray(detail.payments) ? detail.payments : [];
  const available = getAvailableCredit(customer);
  const over = isOverCreditLimit(customer);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  // Offline, or when the local POS service is the data source, history is not
  // available; say so instead of implying the customer has no transactions.
  const historyUnavailable = offline || isLocalPosEnabled();
  const emptyMessage = (label) =>
    historyUnavailable
      ? `${label} history is not available on this device right now. Reconnect to view it.`
      : `No ${label.toLowerCase()} yet.`;

  return (
    <div className="billing-page customers-page">
      <div className="customers-header">
        <h3>
          {customer.name || 'Customer'}
          {customer.is_active === false && <span className="ms-2 badge bg-secondary">Inactive</span>}
        </h3>
        <div className="customers-search">
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => navigate(`/customers/${id}/edit`)}
          >
            Edit
          </button>
          {customer.current_balance > 0 && (
            <button
              type="button"
              className="btn btn-outline-success"
              onClick={() => setReminderModalOpen(true)}
              title="Send automated SMS / WhatsApp payment reminder"
            >
              📱 Send Reminder
            </button>
          )}
          <button type="button" className="btn btn-outline-light" onClick={() => navigate('/customers')}>
            Back
          </button>
        </div>
      </div>

      {offline && (
        <div className="billing-error" role="status">
          Offline: balances shown are from the last sync and may be out of date.
        </div>
      )}

      <div className="customer-detail-grid">
        <div className="customer-card">
          <div className="text-muted small">Outstanding balance</div>
          <div className={`fs-4 customer-balance${over ? ' high' : ''}`}>{formatInr(customer.current_balance)}</div>
        </div>
        <div className="customer-card">
          <div className="text-muted small">Credit limit</div>
          <div className="fs-4">{formatInr(customer.credit_limit)}</div>
        </div>
        <div className="customer-card">
          <div className="text-muted small">Available credit</div>
          <div className="fs-4">{available === null ? 'No credit limit set' : formatInr(available)}</div>
        </div>
      </div>
      <div className="text-muted small">
        Balance and credit limit are read-only here. They change only through billing and accounting entries.
      </div>

      <div className="customer-card">
        <div className="customer-detail-grid">
          <div><strong>Mobile:</strong> {customer.mobile || customer.phone || '-'}</div>
          <div><strong>Email:</strong> {customer.email || '-'}</div>
          <div><strong>Shop:</strong> {customer.shop_name || '-'}</div>
          <div><strong>Type:</strong> {customer.type || '-'}</div>
          <div><strong>GSTIN:</strong> {customer.gst_number || '-'}</div>
          <div><strong>Location:</strong> {customer.location || '-'}</div>
          <div><strong>Address:</strong> {customer.address || '-'}</div>
          <div><strong>Notes:</strong> {customer.notes || '-'}</div>
        </div>
      </div>

      <div className="customer-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'orders'}
          className={`customer-tab${tab === 'orders' ? ' active' : ''}`}
          onClick={() => setTab('orders')}
        >
          Orders ({orders.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'payments'}
          className={`customer-tab${tab === 'payments' ? ' active' : ''}`}
          onClick={() => setTab('payments')}
        >
          Payments ({payments.length})
        </button>
      </div>

      <div className="billing-table-wrapper">
        {tab === 'orders' ? (
          <table className="billing-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan="6" className="billing-empty">{emptyMessage('Orders')}</td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="billing-row">
                  <td>{formatDateTime(order.created_at)}</td>
                  <td>#{order.id}</td>
                  <td>{formatInr(order.total_price)}</td>
                  <td>{formatInr(order.total_paid)}</td>
                  <td>{order.payment_mode || '-'}</td>
                  <td>{order.order_status || order.transaction_type || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="billing-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan="4" className="billing-empty">{emptyMessage('Payments')}</td>
                </tr>
              )}
              {payments.map((payment) => (
                <tr key={payment.id} className="billing-row">
                  <td>{formatDateTime(payment.created_at)}</td>
                  <td>{formatInr(payment.amount)}</td>
                  <td>{payment.payment_mode || '-'}</td>
                  <td>{payment.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaymentReminderModal
        isOpen={reminderModalOpen}
        customer={customer}
        onClose={() => setReminderModalOpen(false)}
      />
    </div>
  );
};

export default CustomerDetail;
