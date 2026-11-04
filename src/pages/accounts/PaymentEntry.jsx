import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { canAccessPaymentEntry, getStoredSessionUser } from '../../utils/permissions';
import { createPayment, generateClientTxnId } from '../../services/accountingService';
import { searchSuppliers, getSupplierLedgerDetail } from '../../services/local';
import { formatInr, toNumber } from '../customers/customerHelpers';
import './Accounts.css';

const EXPENSE_CATEGORIES = [
  { value: 'Rent', label: 'Rent' },
  { value: 'Salaries', label: 'Salaries' },
  { value: 'Utilities', label: 'Utilities / Electricity / Internet' },
  { value: 'Misc Expense', label: 'Miscellaneous Expense' },
];

export default function PaymentEntry() {
  const storeUser = useSelector((state) => state?.user?.userDetails);
  const user = storeUser || getStoredSessionUser();
  const isAuthorized = canAccessPaymentEntry(user);

  // Connectivity
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Payment Type
  const [paymentType, setPaymentType] = useState('supplier'); // 'supplier' | 'expense' | 'drawings'

  // Supplier Search & Details
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState([]);
  const [isSearchingSuppliers, setIsSearchingSuppliers] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  // Form Inputs
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash'); // Strictly 'cash' or 'bank'
  const [expenseCategory, setExpenseCategory] = useState('Misc Expense');
  const [notes, setNotes] = useState('');
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Submission State & Idempotency
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

  // Search suppliers debounced
  useEffect(() => {
    if (paymentType !== 'supplier' || !supplierSearch.trim() || selectedSupplier?.name === supplierSearch) {
      setSupplierResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingSuppliers(true);
      try {
        const list = await searchSuppliers({ search: supplierSearch.trim(), limit: 10 });
        setSupplierResults(Array.isArray(list) ? list : []);
      } catch {
        setSupplierResults([]);
      } finally {
        setIsSearchingSuppliers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [supplierSearch, selectedSupplier, paymentType]);

  const handleSelectSupplier = async (sup) => {
    setSelectedSupplier(sup);
    setSupplierSearch(sup.name || `Supplier #${sup.id}`);
    setSupplierResults([]);
    setOrderId('');
    setSupplierPurchases([]);
    setErrorMessage('');
    clientTxnIdRef.current = generateClientTxnId();

    if (sup?.id) {
      setLoadingPurchases(true);
      try {
        const detail = await getSupplierLedgerDetail(sup.id);
        const purchases = Array.isArray(detail?.ledger) ? detail.ledger : [];
        const pending = purchases.filter((p) => {
          const type = String(p.type || p.txn_type || '').toLowerCase();
          const total = toNumber(p.total_price || p.total_amount || p.amount);
          const paid = toNumber(p.total_paid || p.paid_amount);
          return (type === 'purchase' || type === 'in') && total - paid > 0;
        });
        setSupplierPurchases(pending);
      } catch {
        setSupplierPurchases([]);
      } finally {
        setLoadingPurchases(false);
      }
    }
  };

  const handleTypeChange = (newType) => {
    setPaymentType(newType);
    setSelectedSupplier(null);
    setSupplierSearch('');
    setSupplierPurchases([]);
    setOrderId('');
    setAmount('');
    setErrorMessage('');
    setSuccessResult(null);
    clientTxnIdRef.current = generateClientTxnId();
    lastSubmittedPayloadRef.current = null;
  };

  const resetForm = () => {
    setSelectedSupplier(null);
    setSupplierSearch('');
    setSupplierPurchases([]);
    setOrderId('');
    setAmount('');
    setPaymentMode('cash');
    setExpenseCategory('Misc Expense');
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
      setErrorMessage('Network connection offline. Accounting payments cannot be submitted while offline.');
      return;
    }

    if (paymentType === 'supplier' && !selectedSupplier?.id) {
      setErrorMessage('Please select a supplier.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0.');
      return;
    }

    // Payment mode validation strictly cash or bank
    if (!['cash', 'bank'].includes(paymentMode)) {
      setErrorMessage('Payment mode must be Cash or Bank for payment entry.');
      return;
    }

    const payload = {
      type: paymentType,
      amount: parsedAmount,
      payment_mode: paymentMode,
      supplier_id: paymentType === 'supplier' ? selectedSupplier.id : null,
      order_id: paymentType === 'supplier' && orderId ? parseInt(orderId, 10) : null,
      notes: notes.trim() || null,
      expense_category: paymentType === 'expense' ? expenseCategory : null,
      date: txnDate ? new Date(txnDate).toISOString() : undefined,
      client_txn_id: clientTxnIdRef.current,
    };

    // If payload changed from a previous submission attempt, generate fresh client_txn_id
    if (lastSubmittedPayloadRef.current) {
      const prev = lastSubmittedPayloadRef.current;
      const changed =
        prev.type !== payload.type ||
        prev.supplier_id !== payload.supplier_id ||
        Math.abs(prev.amount - payload.amount) > 0.001 ||
        prev.payment_mode !== payload.payment_mode ||
        prev.order_id !== payload.order_id ||
        prev.expense_category !== payload.expense_category;
      if (changed) {
        clientTxnIdRef.current = generateClientTxnId();
        payload.client_txn_id = clientTxnIdRef.current;
      }
    }

    lastSubmittedPayloadRef.current = { ...payload };
    setSubmitting(true);

    try {
      const result = await createPayment(payload);
      setSuccessResult({
        id: result?.id || result?.transaction?.id || 'Recorded',
        idempotent: Boolean(result?.idempotent),
        type: paymentType,
        amount: parsedAmount,
        paymentMode,
      });

      if (paymentType === 'supplier' && selectedSupplier) {
        setSelectedSupplier((prev) =>
          prev
            ? {
                ...prev,
                current_balance: Math.max(0, toNumber(prev.current_balance) - parsedAmount),
              }
            : prev
        );
      }
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 || data?.code === 'IDEMPOTENCY_CONFLICT') {
        setErrorMessage(
          data?.message || 'Conflict: This payment was previously submitted with different parameters.'
        );
      } else if (status === 403) {
        setErrorMessage('Access denied: You do not have permission to record payments.');
      } else if (data?.message) {
        setErrorMessage(data.message);
      } else {
        setErrorMessage('Failed to submit payment. Check connection and retry.');
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
          <h2 className="h4 mb-1">Payment Entry</h2>
          <p className="text-muted small mb-0">Record supplier payouts, expenses, and drawings.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={resetForm}
          disabled={submitting}
        >
          New Payment
        </button>
      </div>

      {!isOnline && (
        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
          <div>
            <strong>Offline Mode:</strong> Payment Entry is online-only. Submission is disabled until network connection is restored.
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
            <strong>Payment Recorded Successfully!</strong>
            <div className="small mt-1">
              Transaction ID: #{successResult.id} {successResult.idempotent && '(Idempotent Replay)'} | Type: {successResult.type.toUpperCase()} | Amount: {formatInr(successResult.amount)} | Mode: {successResult.paymentMode}
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-success" onClick={resetForm}>
            Record Another
          </button>
        </div>
      )}

      {/* Payment Type Selection Tabs */}
      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${paymentType === 'supplier' ? 'active' : ''}`}
            onClick={() => handleTypeChange('supplier')}
            disabled={submitting}
          >
            Supplier Payment
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${paymentType === 'expense' ? 'active' : ''}`}
            onClick={() => handleTypeChange('expense')}
            disabled={submitting}
          >
            Expense Payout
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${paymentType === 'drawings' ? 'active' : ''}`}
            onClick={() => handleTypeChange('drawings')}
            disabled={submitting}
          >
            Drawings
          </button>
        </li>
      </ul>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <form onSubmit={handleSubmit} noValidate>
            <div className="row g-3">
              {/* Supplier Search / Selection (Only for type === 'supplier') */}
              {paymentType === 'supplier' && (
                <>
                  <div className="col-md-6 position-relative">
                    <label htmlFor="payment-supplier-input" className="form-label fw-semibold">
                      Supplier <span className="text-danger">*</span>
                    </label>
                    <input
                      id="payment-supplier-input"
                      type="text"
                      className="form-control"
                      placeholder="Search supplier by name or mobile..."
                      value={supplierSearch}
                      onChange={(e) => {
                        setSupplierSearch(e.target.value);
                        if (selectedSupplier && e.target.value !== selectedSupplier.name) {
                          setSelectedSupplier(null);
                          setSupplierPurchases([]);
                          setOrderId('');
                        }
                      }}
                      disabled={!isOnline || submitting}
                      autoComplete="off"
                    />
                    {isSearchingSuppliers && (
                      <div className="small text-muted mt-1">Searching suppliers...</div>
                    )}
                    {supplierResults.length > 0 && (
                      <ul className="list-group position-absolute w-100 shadow-sm mt-1 z-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {supplierResults.map((s) => (
                          <li
                            key={s.id}
                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleSelectSupplier(s)}
                          >
                            <div>
                              <strong>{s.name}</strong> {s.mobile ? `(${s.mobile})` : ''}
                            </div>
                            <span className="badge bg-light text-dark">
                              Bal: {formatInr(s.current_balance || 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedSupplier && (
                      <div className="small text-success mt-1">
                        Selected: <strong>{selectedSupplier.name}</strong> | Outstanding: <strong>{formatInr(selectedSupplier.current_balance || 0)}</strong>
                      </div>
                    )}
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="payment-order-select" className="form-label fw-semibold">
                      Link to Purchase Order (Optional)
                    </label>
                    <select
                      id="payment-order-select"
                      className="form-select"
                      value={orderId}
                      onChange={(e) => {
                        setOrderId(e.target.value);
                        clientTxnIdRef.current = generateClientTxnId();
                      }}
                      disabled={!isOnline || submitting || !selectedSupplier}
                    >
                      <option value="">On Account (General Payment)</option>
                      {loadingPurchases ? (
                        <option disabled>Loading orders...</option>
                      ) : (
                        supplierPurchases.map((p) => (
                          <option key={p.id} value={p.id}>
                            Purchase #{p.id} - Total: {formatInr(p.total_price || p.amount)}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="form-text small">
                      Leave on &quot;On Account&quot; to reduce supplier payable balance generally.
                    </div>
                  </div>
                </>
              )}

              {/* Expense Category (Only for type === 'expense') */}
              {paymentType === 'expense' && (
                <div className="col-md-6">
                  <label htmlFor="payment-category-select" className="form-label fw-semibold">
                    Expense Category <span className="text-danger">*</span>
                  </label>
                  <select
                    id="payment-category-select"
                    className="form-select"
                    value={expenseCategory}
                    onChange={(e) => {
                      setExpenseCategory(e.target.value);
                      clientTxnIdRef.current = generateClientTxnId();
                    }}
                    disabled={!isOnline || submitting}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Drawings Explanation (Only for type === 'drawings') */}
              {paymentType === 'drawings' && (
                <div className="col-md-6">
                  <div className="p-3 bg-light rounded border text-muted small">
                    <strong>Owner Drawings:</strong> Debits Owner Drawings Account and credits Cash/Bank. Does not link to any order or supplier.
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="col-md-4">
                <label htmlFor="payment-amount-input" className="form-label fw-semibold">
                  Payment Amount (INR) <span className="text-danger">*</span>
                </label>
                <input
                  id="payment-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (successResult) clientTxnIdRef.current = generateClientTxnId();
                  }}
                  disabled={!isOnline || submitting}
                  required
                />
              </div>

              {/* Payment Mode: strictly cash or bank only */}
              <div className="col-md-4">
                <label htmlFor="payment-mode-select" className="form-label fw-semibold">
                  Payment Mode <span className="text-danger">*</span>
                </label>
                <select
                  id="payment-mode-select"
                  className="form-select"
                  value={paymentMode}
                  onChange={(e) => {
                    setPaymentMode(e.target.value);
                    if (successResult) clientTxnIdRef.current = generateClientTxnId();
                  }}
                  disabled={!isOnline || submitting}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
                <div className="form-text small">
                  Payment entries strictly restrict payment modes to Cash and Bank.
                </div>
              </div>

              {/* Date */}
              <div className="col-md-4">
                <label htmlFor="payment-date-input" className="form-label fw-semibold">
                  Date
                </label>
                <input
                  id="payment-date-input"
                  type="date"
                  className="form-control"
                  value={txnDate}
                  onChange={(e) => setTxnDate(e.target.value)}
                  disabled={!isOnline || submitting}
                />
              </div>

              {/* Notes */}
              <div className="col-12">
                <label htmlFor="payment-notes-input" className="form-label fw-semibold">
                  Notes
                </label>
                <input
                  id="payment-notes-input"
                  type="text"
                  className="form-control"
                  placeholder="Cheque number, UTR reference, voucher details, or payee remarks..."
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
                  disabled={
                    !isOnline ||
                    submitting ||
                    (paymentType === 'supplier' && !selectedSupplier) ||
                    !amount
                  }
                >
                  {submitting ? 'Recording Payment...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
