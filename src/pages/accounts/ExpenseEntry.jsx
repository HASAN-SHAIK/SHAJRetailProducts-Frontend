import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { canAccessExpenseEntry, getStoredSessionUser } from '../../utils/permissions';
import { createExpense, generateClientTxnId } from '../../services/accountingService';
import { formatInr } from '../customers/customerHelpers';
import './Accounts.css';

export const EXPENSE_CATEGORIES = [
  { value: 'Utilities', label: 'Utilities (Electricity / Water / Internet)' },
  { value: 'Rent', label: 'Rent' },
  { value: 'Salaries', label: 'Salaries' },
  { value: 'Shop Supplies', label: 'Shop Supplies & Packaging' },
  { value: 'Repairs & Maintenance', label: 'Repairs & Maintenance' },
  { value: 'Tea & Refreshments', label: 'Tea & Refreshments / Pantry' },
  { value: 'Fuel & Transportation', label: 'Fuel & Local Transportation' },
  { value: 'Misc Expense', label: 'Miscellaneous Expense' },
];

export default function ExpenseEntry() {
  const navigate = useNavigate();
  const storeUser = useSelector((state) => state?.user?.userDetails);
  const user = storeUser || getStoredSessionUser();
  const isAuthorized = canAccessExpenseEntry(user);

  // Connectivity
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Form Inputs
  const [expenseCategory, setExpenseCategory] = useState('Utilities');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash'); // Strictly 'cash' or 'bank'
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');

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

  const resetForm = () => {
    setExpenseCategory('Utilities');
    setAmount('');
    setPaymentMode('cash');
    setTxnDate(new Date().toISOString().slice(0, 10));
    setPayee('');
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

    // Online-only authoritative submission guard
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setErrorMessage('Network connection offline. Accounting expenses cannot be submitted while offline.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!expenseCategory.trim()) {
      setErrorMessage('Please select a valid expense category.');
      return;
    }

    // Payment mode validation strictly cash or bank only
    if (!['cash', 'bank'].includes(paymentMode)) {
      setErrorMessage('Payment mode must be Cash or Bank for expense entry.');
      return;
    }

    const resolvedNotes = payee.trim()
      ? `${notes.trim() ? notes.trim() + ' ' : ''}(Paid to: ${payee.trim()})`.trim()
      : notes.trim() || `${expenseCategory} expense`;

    const payload = {
      type: 'expense',
      amount: parsedAmount,
      payment_mode: paymentMode,
      expense_category: expenseCategory,
      notes: resolvedNotes,
      date: txnDate ? new Date(txnDate).toISOString() : undefined,
      client_txn_id: clientTxnIdRef.current,
    };

    // Preserve UUID idempotency across unchanged retries; regenerate if inputs changed
    if (lastSubmittedPayloadRef.current) {
      const prev = lastSubmittedPayloadRef.current;
      const changed =
        Math.abs(prev.amount - payload.amount) > 0.001 ||
        prev.payment_mode !== payload.payment_mode ||
        prev.expense_category !== payload.expense_category ||
        prev.notes !== payload.notes ||
        prev.date !== payload.date;
      if (changed) {
        clientTxnIdRef.current = generateClientTxnId();
        payload.client_txn_id = clientTxnIdRef.current;
      }
    }

    lastSubmittedPayloadRef.current = { ...payload };
    setSubmitting(true);

    try {
      const result = await createExpense(payload);
      setSuccessResult({
        id: result?.id || result?.transaction?.id || 'Recorded',
        idempotent: Boolean(result?.idempotent),
        amount: parsedAmount,
        paymentMode,
        category: expenseCategory,
        notes: resolvedNotes,
      });
      // Generate new client txn id for the next entry
      clientTxnIdRef.current = generateClientTxnId();
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 || data?.code === 'IDEMPOTENCY_CONFLICT') {
        setErrorMessage(
          data?.message || 'Conflict: This expense was previously submitted with different parameters.'
        );
      } else if (status === 403) {
        setErrorMessage('Access denied: You do not have permission to record expense payments.');
      } else if (data?.message) {
        setErrorMessage(data.message);
      } else {
        setErrorMessage('Failed to submit expense. Check connection and retry.');
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
          <h2 className="h4 mb-1">Expense Entry</h2>
          <p className="text-muted small mb-0">Record operational store expenses and petty cash payouts.</p>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate('/accounts/cashbook')}
          >
            View Cash Book
          </button>
        </div>
      </div>

      {/* Offline Mode Alert */}
      {!isOnline && (
        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
          <svg
            className="bi flex-shrink-0 me-2"
            width="20"
            height="20"
            fill="currentColor"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
          </svg>
          <div>
            <strong>Offline Mode:</strong> Accounting expenses cannot be submitted while offline. Please reconnect to record expenses.
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          <strong>Error:</strong> {errorMessage}
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setErrorMessage('')}
          />
        </div>
      )}

      {/* Success Banner */}
      {successResult && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h5 className="alert-heading h6 mb-1">
                Expense Recorded Successfully! {successResult.idempotent && <span className="badge bg-warning text-dark ms-2">(Idempotent Replay)</span>}
              </h5>
              <p className="mb-1 small">
                Ref ID: <strong>{String(successResult.id)}</strong> | Category: <strong>{successResult.category}</strong> | Amount: <strong>{formatInr(successResult.amount)}</strong> ({successResult.paymentMode.toUpperCase()})
              </p>
              <p className="mb-0 small text-muted">
                {successResult.notes}
              </p>
            </div>
            <div className="d-flex gap-2">
              {successResult.paymentMode === 'cash' && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => navigate('/accounts/cashbook')}
                >
                  View in Cash Book
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-success"
                onClick={resetForm}
              >
                Record Another Expense
              </button>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setSuccessResult(null)}
          />
        </div>
      )}

      {/* Expense Entry Form */}
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <form onSubmit={handleSubmit} noValidate>
            <div className="row g-3">
              {/* Category */}
              <div className="col-md-6">
                <label htmlFor="expense-category-select" className="form-label fw-semibold">
                  Expense Category <span className="text-danger">*</span>
                </label>
                <select
                  id="expense-category-select"
                  className="form-select"
                  value={expenseCategory}
                  onChange={(e) => {
                    setExpenseCategory(e.target.value);
                    if (successResult) clientTxnIdRef.current = generateClientTxnId();
                  }}
                  disabled={!isOnline || submitting}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <div className="form-text small">
                  Rent &amp; Salaries debit specific ledgers; other operational expenses debit Misc Expense.
                </div>
              </div>

              {/* Amount */}
              <div className="col-md-6">
                <label htmlFor="expense-amount-input" className="form-label fw-semibold">
                  Expense Amount (INR) <span className="text-danger">*</span>
                </label>
                <input
                  id="expense-amount-input"
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

              {/* Payment Mode */}
              <div className="col-md-4">
                <label htmlFor="expense-mode-select" className="form-label fw-semibold">
                  Payment Mode <span className="text-danger">*</span>
                </label>
                <select
                  id="expense-mode-select"
                  className="form-select"
                  value={paymentMode}
                  onChange={(e) => {
                    setPaymentMode(e.target.value);
                    if (successResult) clientTxnIdRef.current = generateClientTxnId();
                  }}
                  disabled={!isOnline || submitting}
                >
                  <option value="cash">Cash (Cash Drawer)</option>
                  <option value="bank">Bank</option>
                </select>
                <div className="form-text small">
                  Expense entries strictly restrict payment modes to Cash and Bank.
                </div>
              </div>

              {/* Date */}
              <div className="col-md-4">
                <label htmlFor="expense-date-input" className="form-label fw-semibold">
                  Transaction Date
                </label>
                <input
                  id="expense-date-input"
                  type="date"
                  className="form-control"
                  value={txnDate}
                  onChange={(e) => {
                    setTxnDate(e.target.value);
                    if (successResult) clientTxnIdRef.current = generateClientTxnId();
                  }}
                  disabled={!isOnline || submitting}
                />
              </div>

              {/* Paid To / Payee */}
              <div className="col-md-4">
                <label htmlFor="expense-payee-input" className="form-label fw-semibold">
                  Paid To / Payee (Optional)
                </label>
                <input
                  id="expense-payee-input"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Electrician, Vendor, Landlord"
                  value={payee}
                  onChange={(e) => {
                    setPayee(e.target.value);
                    if (successResult) clientTxnIdRef.current = generateClientTxnId();
                  }}
                  disabled={!isOnline || submitting}
                />
              </div>

              {/* Notes */}
              <div className="col-12">
                <label htmlFor="expense-notes-input" className="form-label fw-semibold">
                  Description / Notes
                </label>
                <textarea
                  id="expense-notes-input"
                  className="form-control"
                  rows="2"
                  placeholder="Add details, invoice reference or bill numbers..."
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    if (successResult) clientTxnIdRef.current = generateClientTxnId();
                  }}
                  disabled={!isOnline || submitting}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={resetForm}
                disabled={submitting}
              >
                Reset
              </button>
              <button
                type="submit"
                className="btn btn-primary px-4"
                disabled={!isOnline || submitting || !amount}
              >
                {submitting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    />
                    Recording Expense...
                  </>
                ) : (
                  'Record Expense'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
