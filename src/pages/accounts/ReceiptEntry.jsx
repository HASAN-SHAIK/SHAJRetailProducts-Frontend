import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { canAccessReceiptEntry, getStoredSessionUser } from '../../utils/permissions';
import { createReceipt, generateClientTxnId } from '../../services/accountingService';
import { searchCustomers, getCustomerDetail } from '../../services/local';
import { formatInr, toNumber } from '../customers/customerHelpers';
import './Accounts.css';

export default function ReceiptEntry() {
  const storeUser = useSelector((state) => state?.user?.userDetails);
  const user = storeUser || getStoredSessionUser();
  const isAuthorized = canAccessReceiptEntry(user);

  // Connectivity
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Customer selection & search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form inputs
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Submission state & Idempotency
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const clientTxnIdRef = useRef(generateClientTxnId());
  const lastSubmittedPayloadRef = useRef(null);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Search customers debounced
  useEffect(() => {
    if (!customerSearch.trim() || selectedCustomer?.name === customerSearch) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingCustomers(true);
      try {
        const list = await searchCustomers({ search: customerSearch.trim(), limit: 10 });
        setCustomerResults(Array.isArray(list) ? list : []);
      } catch {
        setCustomerResults([]);
      } finally {
        setIsSearchingCustomers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearch, selectedCustomer]);

  // Load customer detail & orders when customer selected
  const handleSelectCustomer = async (cust) => {
    setSelectedCustomer(cust);
    setCustomerSearch(cust.name || `Customer #${cust.id}`);
    setCustomerResults([]);
    setOrderId('');
    setCustomerOrders([]);
    setErrorMessage('');
    // Regenerate idempotency key when changing customer
    clientTxnIdRef.current = generateClientTxnId();

    if (cust?.id) {
      setLoadingOrders(true);
      try {
        const detail = await getCustomerDetail(cust.id);
        const orders = Array.isArray(detail?.orders) ? detail.orders : [];
        const pending = orders.filter((o) => {
          const total = toNumber(o.total_price);
          const paid = toNumber(o.total_paid);
          const returned = toNumber(o.returned_amount);
          const remaining = total - paid - returned;
          return remaining > 0 && String(o.order_status || '').toLowerCase() !== 'voided';
        });
        setCustomerOrders(pending);
      } catch {
        setCustomerOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    }
  };

  const handleOrderChange = (e) => {
    const val = e.target.value;
    setOrderId(val);
    clientTxnIdRef.current = generateClientTxnId();
    if (val) {
      const ord = customerOrders.find((o) => String(o.id) === String(val));
      if (ord) {
        const remaining = toNumber(ord.total_price) - toNumber(ord.total_paid) - toNumber(ord.returned_amount);
        if (remaining > 0) setAmount(remaining.toFixed(2));
      }
    }
  };

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    // Payload changed, update idempotency key if previous submit succeeded
    if (successResult) clientTxnIdRef.current = generateClientTxnId();
  };

  const handleModeChange = (e) => {
    setPaymentMode(e.target.value);
    if (successResult) clientTxnIdRef.current = generateClientTxnId();
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerOrders([]);
    setOrderId('');
    setAmount('');
    setPaymentMode('cash');
    setNotes('');
    setErrorMessage('');
    setSuccessResult(null);
    clientTxnIdRef.current = generateClientTxnId();
    lastSubmittedPayloadRef.current = null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessResult(null);

    // Recheck connectivity authoritative check before submit
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setErrorMessage('Network connection offline. Accounting receipts cannot be submitted while offline.');
      return;
    }

    if (!selectedCustomer?.id) {
      setErrorMessage('Please select a customer.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0.');
      return;
    }

    // Build payload
    const payload = {
      customer_id: selectedCustomer.id,
      amount: parsedAmount,
      payment_mode: paymentMode,
      order_id: orderId ? parseInt(orderId, 10) : null,
      notes: notes.trim() || null,
      date: txnDate ? new Date(txnDate).toISOString() : undefined,
      client_txn_id: clientTxnIdRef.current,
    };

    // If payload changed from a previous submission, generate fresh client_txn_id
    if (lastSubmittedPayloadRef.current) {
      const prev = lastSubmittedPayloadRef.current;
      const changed =
        prev.customer_id !== payload.customer_id ||
        Math.abs(prev.amount - payload.amount) > 0.001 ||
        prev.payment_mode !== payload.payment_mode ||
        prev.order_id !== payload.order_id;
      if (changed) {
        clientTxnIdRef.current = generateClientTxnId();
        payload.client_txn_id = clientTxnIdRef.current;
      }
    }

    lastSubmittedPayloadRef.current = { ...payload };
    setSubmitting(true);

    try {
      const result = await createReceipt(payload);
      setSuccessResult({
        id: result?.id || result?.transaction?.id || 'Recorded',
        idempotent: Boolean(result?.idempotent),
        amount: parsedAmount,
        paymentMode,
      });

      // Update customer balance display locally
      setSelectedCustomer((prev) =>
        prev
          ? {
              ...prev,
              current_balance: Math.max(0, toNumber(prev.current_balance) - parsedAmount),
            }
          : prev
      );
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 || data?.code === 'IDEMPOTENCY_CONFLICT') {
        setErrorMessage(
          data?.message || 'Conflict: This receipt was previously submitted with different parameters.'
        );
      } else if (status === 403) {
        setErrorMessage('Access denied: You do not have permission to record receipts.');
      } else if (data?.message) {
        setErrorMessage(data.message);
      } else {
        setErrorMessage('Failed to submit receipt. Check connection and retry.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthorized) {
    return <Navigate to="/billing/retail" replace />;
  }

  return (
    <div className="accounts-page container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="h4 mb-1">Receipt Entry</h2>
          <p className="text-muted small mb-0">Record customer outstanding collections and on-account receipts.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={resetForm}
          disabled={submitting}
        >
          New Receipt
        </button>
      </div>

      {!isOnline && (
        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
          <div>
            <strong>Offline Mode:</strong> Receipt Entry is online-only. Submission is disabled until network connection is restored.
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger mb-3" role="alert">
          {errorMessage}
        </div>
      )}

      {successResult && (
        <div className="alert alert-success d-flex justify-content-between align-items-center mb-3" role="alert">
          <div>
            <strong>Receipt Recorded Successfully!</strong>
            <div className="small mt-1">
              Transaction ID: #{successResult.id} {successResult.idempotent && '(Idempotent Replay)'} | Amount: {formatInr(successResult.amount)} | Mode: {successResult.paymentMode}
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-success" onClick={resetForm}>
            Record Another
          </button>
        </div>
      )}

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <form onSubmit={handleSubmit} noValidate>
            <div className="row g-3">
              {/* Customer Search / Selection */}
              <div className="col-md-6 position-relative">
                <label htmlFor="receipt-customer-input" className="form-label fw-semibold">
                  Customer <span className="text-danger">*</span>
                </label>
                <input
                  id="receipt-customer-input"
                  type="text"
                  className="form-control"
                  placeholder="Search customer by name or phone..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                      setSelectedCustomer(null);
                      setCustomerOrders([]);
                      setOrderId('');
                    }
                  }}
                  disabled={!isOnline || submitting}
                  autoComplete="off"
                />
                {isSearchingCustomers && (
                  <div className="small text-muted mt-1">Searching customers...</div>
                )}
                {customerResults.length > 0 && (
                  <ul className="list-group position-absolute w-100 shadow-sm mt-1 z-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {customerResults.map((c) => (
                      <li
                        key={c.id}
                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSelectCustomer(c)}
                      >
                        <div>
                          <strong>{c.name}</strong> {c.mobile ? `(${c.mobile})` : ''}
                        </div>
                        <span className="badge bg-light text-dark">
                          Bal: {formatInr(c.current_balance || 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedCustomer && (
                  <div className="small text-success mt-1">
                    Selected: <strong>{selectedCustomer.name}</strong> | Outstanding Balance: <strong>{formatInr(selectedCustomer.current_balance || 0)}</strong>
                  </div>
                )}
              </div>

              {/* Order Selection */}
              <div className="col-md-6">
                <label htmlFor="receipt-order-select" className="form-label fw-semibold">
                  Link to Sales Order (Optional)
                </label>
                <select
                  id="receipt-order-select"
                  className="form-select"
                  value={orderId}
                  onChange={handleOrderChange}
                  disabled={!isOnline || submitting || !selectedCustomer}
                >
                  <option value="">On Account (General Receipt)</option>
                  {loadingOrders ? (
                    <option disabled>Loading orders...</option>
                  ) : (
                    customerOrders.map((o) => {
                      const remaining = toNumber(o.total_price) - toNumber(o.total_paid) - toNumber(o.returned_amount);
                      return (
                        <option key={o.id} value={o.id}>
                          Order #{o.id} - Total: {formatInr(o.total_price)} (Pending: {formatInr(remaining)})
                        </option>
                      );
                    })
                  )}
                </select>
                <div className="form-text small">
                  Leave on &quot;On Account&quot; to credit customer balance directly.
                </div>
              </div>

              {/* Amount */}
              <div className="col-md-4">
                <label htmlFor="receipt-amount-input" className="form-label fw-semibold">
                  Receipt Amount (INR) <span className="text-danger">*</span>
                </label>
                <input
                  id="receipt-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control"
                  placeholder="0.00"
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={!isOnline || submitting}
                  required
                />
              </div>

              {/* Payment Mode */}
              <div className="col-md-4">
                <label htmlFor="receipt-mode-select" className="form-label fw-semibold">
                  Payment Mode <span className="text-danger">*</span>
                </label>
                <select
                  id="receipt-mode-select"
                  className="form-select"
                  value={paymentMode}
                  onChange={handleModeChange}
                  disabled={!isOnline || submitting}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="online">Online / UPI</option>
                </select>
              </div>

              {/* Date */}
              <div className="col-md-4">
                <label htmlFor="receipt-date-input" className="form-label fw-semibold">
                  Date
                </label>
                <input
                  id="receipt-date-input"
                  type="date"
                  className="form-control"
                  value={txnDate}
                  onChange={(e) => setTxnDate(e.target.value)}
                  disabled={!isOnline || submitting}
                />
              </div>

              {/* Notes */}
              <div className="col-12">
                <label htmlFor="receipt-notes-input" className="form-label fw-semibold">
                  Notes
                </label>
                <input
                  id="receipt-notes-input"
                  type="text"
                  className="form-control"
                  placeholder="Reference number, cheque details, or transaction remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!isOnline || submitting}
                />
              </div>

              {/* Action Buttons */}
              <div className="col-12 d-flex gap-2 justify-content-end mt-4">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-4"
                  disabled={!isOnline || submitting || !selectedCustomer || !amount}
                >
                  {submitting ? 'Recording Receipt...' : 'Record Receipt'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
