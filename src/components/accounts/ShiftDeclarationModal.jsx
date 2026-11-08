import React, { useMemo, useState } from 'react';
import {
  DENOMINATION_MULTIPLIERS,
  calculateDenominationsTotal,
  declareAndCloseShift,
} from '../../services/shiftService';
import { formatInr } from '../../pages/customers/customerHelpers';

const DEFAULT_DENOMINATIONS = {
  '500': '',
  '200': '',
  '100': '',
  '50': '',
  '20': '',
  '10': '',
  '5': '',
  'coins': '',
};

export default function ShiftDeclarationModal({
  isOpen,
  onClose,
  onDeclared,
  expectedCash = 0,
  branchName = 'Store Terminal',
  cashierName = 'Cashier',
}) {
  const [denominations, setDenominations] = useState(DEFAULT_DENOMINATIONS);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  const declaredCash = useMemo(() => {
    return calculateDenominationsTotal(denominations);
  }, [denominations]);

  const variance = useMemo(() => {
    return Math.round((declaredCash - Number(expectedCash || 0)) * 100) / 100;
  }, [declaredCash, expectedCash]);

  if (!isOpen) return null;

  const handleDenominationChange = (key, val) => {
    const cleaned = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    setDenominations((prev) => ({ ...prev, [key]: cleaned }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const result = await declareAndCloseShift({
        declared_cash: declaredCash,
        denominations,
        notes: notes || undefined,
      });

      setSuccessResult(result?.shift || { declared_cash: declaredCash, variance });
      if (onDeclared) onDeclared(result?.shift);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to submit shift cash declaration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setDenominations(DEFAULT_DENOMINATIONS);
    setNotes('');
    setError('');
    setSuccessResult(null);
    onClose();
  };

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1050 }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content text-light" style={{ background: '#0f172a', border: '1px solid #334155' }}>
          <div className="modal-header border-secondary">
            <h5 className="modal-title">
              <i className="bi bi-safe2 me-2 text-info" />
              Cashier Shift Handover & Drawer Cash Declaration
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={handleReset}
              disabled={submitting}
              aria-label="Close"
            />
          </div>

          {successResult ? (
            <div className="modal-body p-4 text-center">
              <div className="mb-3">
                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3rem' }} />
              </div>
              <h4 className="text-light">Shift Successfully Closed & Declared</h4>
              <p className="text-muted">
                Shift handover recorded for <strong>{branchName}</strong> by <strong>{cashierName}</strong>.
              </p>

              <div className="card bg-dark border-secondary my-3 p-3 text-start">
                <div className="d-flex justify-content-between py-1 border-bottom border-secondary">
                  <span className="text-muted">Expected System Cash:</span>
                  <strong className="text-light">{formatInr(expectedCash)}</strong>
                </div>
                <div className="d-flex justify-content-between py-1 border-bottom border-secondary">
                  <span className="text-muted">Declared Physical Cash:</span>
                  <strong className="text-info">{formatInr(successResult.declared_cash || declaredCash)}</strong>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">Shift Cash Variance:</span>
                  <strong
                    className={
                      variance === 0
                        ? 'text-success'
                        : variance < 0
                        ? 'text-danger'
                        : 'text-warning'
                    }
                  >
                    {variance === 0
                      ? '₹0.00 (Balanced)'
                      : variance < 0
                      ? `-${formatInr(Math.abs(variance))} (Shortage)`
                      : `+${formatInr(variance)} (Overage)`}
                  </strong>
                </div>
              </div>

              <div className="d-flex justify-content-center gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-outline-info"
                  onClick={() => window.print()}
                >
                  <i className="bi bi-printer me-1" /> Print Handover Receipt
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleReset}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="modal-body p-4">
                {error && (
                  <div className="alert alert-danger py-2" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2" />
                    {error}
                  </div>
                )}

                {/* Drawer Summary Bar */}
                <div className="row g-2 mb-3">
                  <div className="col-md-4">
                    <div className="p-2 rounded bg-dark border border-secondary text-center">
                      <small className="text-muted d-block text-uppercase">Drawer Terminal</small>
                      <strong className="text-light">{branchName}</strong>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-2 rounded bg-dark border border-secondary text-center">
                      <small className="text-muted d-block text-uppercase">Expected Cash in Hand</small>
                      <strong className="text-info fs-5">{formatInr(expectedCash)}</strong>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div
                      className={`p-2 rounded border text-center ${
                        variance === 0
                          ? 'border-success bg-dark'
                          : variance < 0
                          ? 'border-danger bg-danger bg-opacity-10'
                          : 'border-warning bg-warning bg-opacity-10'
                      }`}
                    >
                      <small className="text-muted d-block text-uppercase">Current Variance</small>
                      <strong
                        className={
                          variance === 0
                            ? 'text-success fs-5'
                            : variance < 0
                            ? 'text-danger fs-5'
                            : 'text-warning fs-5'
                        }
                      >
                        {variance === 0
                          ? 'Balanced'
                          : variance < 0
                          ? `-${formatInr(Math.abs(variance))} (Short)`
                          : `+${formatInr(variance)} (Over)`}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Denomination Counter Grid */}
                <h6 className="text-muted text-uppercase mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  Count Physical Cash Denominations
                </h6>
                <div className="row g-2 mb-3">
                  {Object.keys(DENOMINATION_MULTIPLIERS).map((denom) => {
                    const mult = DENOMINATION_MULTIPLIERS[denom];
                    const count = denominations[denom];
                    const subtotal = (Number(count) || 0) * mult;
                    return (
                      <div className="col-6 col-md-3" key={denom}>
                        <div className="input-group input-group-sm">
                          <span className="input-group-text bg-secondary text-light border-secondary" style={{ width: '60px' }}>
                            ₹{denom}
                          </span>
                          <input
                            type="number"
                            min="0"
                            className="form-control bg-dark text-light border-secondary text-end"
                            placeholder="Count"
                            value={count}
                            onChange={(e) => handleDenominationChange(denom, e.target.value)}
                          />
                        </div>
                        <div className="text-end text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                          = {formatInr(subtotal)}
                        </div>
                      </div>
                    );
                  })}
                  <div className="col-6 col-md-3">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-secondary text-light border-secondary" style={{ width: '60px' }}>
                        Coins
                      </span>
                      <input
                        type="number"
                        min="0"
                        className="form-control bg-dark text-light border-secondary text-end"
                        placeholder="₹ Amount"
                        value={denominations.coins}
                        onChange={(e) => handleDenominationChange('coins', e.target.value)}
                      />
                    </div>
                    <div className="text-end text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                      = {formatInr(denominations.coins || 0)}
                    </div>
                  </div>
                </div>

                {/* Total Declared vs Variance Bar */}
                <div className="p-3 rounded bg-dark border border-secondary mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <span className="text-muted d-block">Total Declared Physical Cash:</span>
                    <span className="text-light fs-4 fw-bold">{formatInr(declaredCash)}</span>
                  </div>
                  <div className="text-end">
                    <span className="text-muted d-block">Drawer Reconciliation Variance:</span>
                    <span
                      className={`fs-5 fw-bold ${
                        variance === 0
                          ? 'text-success'
                          : variance < 0
                          ? 'text-danger'
                          : 'text-warning'
                      }`}
                    >
                      {variance === 0
                        ? '✓ Exact Balance (₹0.00)'
                        : variance < 0
                        ? `⚠ Shortage: -${formatInr(Math.abs(variance))}`
                        : `ℹ Overage: +${formatInr(variance)}`}
                    </span>
                  </div>
                </div>

                {/* Handover Remarks */}
                <div className="mb-2">
                  <label htmlFor="shift-handover-notes" className="form-label text-muted small">
                    Handover Remarks / Relieving Cashier Name
                  </label>
                  <input
                    id="shift-handover-notes"
                    type="text"
                    className="form-control form-control-sm bg-dark text-light border-secondary"
                    placeholder="e.g. Handed over to Evening Cashier Rahul; drawer clean"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleReset}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Submitting Declaration...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-lock me-1" />
                      End Shift & Declare Cash ({formatInr(declaredCash)})
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
