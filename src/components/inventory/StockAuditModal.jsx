import React, { useState, useRef, useEffect } from 'react';
import { lookupProductForAudit, submitStockAudit } from '../../services/stockAuditApi';

const StockAuditModal = ({ isOpen, onClose, onAuditApplied }) => {
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('Shelf / Rack Physical Audit');
  const [auditItems, setAuditItems] = useState([]);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'danger' | 'info', text }
  const [submitting, setSubmitting] = useState(false);
  const [lastCommitted, setLastCommitted] = useState(null);

  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScanSubmit = async (e) => {
    if (e) e.preventDefault();
    const barcode = String(scanInput || '').trim();
    if (!barcode) return;

    // Check if barcode/product already scanned in this session
    const existingIndex = auditItems.findIndex(
      (item) => String(item.barcode).toLowerCase() === barcode.toLowerCase() || String(item.productId) === barcode
    );

    if (existingIndex >= 0) {
      setAuditItems((prev) =>
        prev.map((item, idx) => {
          if (idx !== existingIndex) return item;
          const nextCount = item.physicalCount + 1;
          return {
            ...item,
            physicalCount: nextCount,
            variance: Math.round((nextCount - item.bookStock) * 1000) / 1000,
          };
        })
      );
      setStatusMessage({
        type: 'info',
        text: `Incremented count for "${auditItems[existingIndex].name}" (Physical: ${auditItems[existingIndex].physicalCount + 1})`,
      });
      setScanInput('');
      return;
    }

    setScanning(true);
    setStatusMessage(null);
    try {
      const product = await lookupProductForAudit(barcode);
      if (!product) {
        setStatusMessage({
          type: 'danger',
          text: `Barcode / Product "${barcode}" not found in catalog.`,
        });
      } else {
        const bookStock = Number(product.bookStock || 0);
        const physicalCount = 1;
        const variance = Math.round((physicalCount - bookStock) * 1000) / 1000;

        setAuditItems((prev) => [
          {
            productId: product.productId,
            name: product.name,
            barcode: product.barcode || barcode,
            bookStock,
            physicalCount,
            variance,
            price: Number(product.price || 0),
          },
          ...prev,
        ]);

        setStatusMessage({
          type: 'success',
          text: `Scanned: "${product.name}" (Book: ${bookStock}, Physical: 1)`,
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'danger',
        text: `Error looking up "${barcode}": ${err.message}`,
      });
    } finally {
      setScanning(false);
      setScanInput('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleCountChange = (index, value) => {
    const parsed = Math.max(0, Number(value) || 0);
    setAuditItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          physicalCount: parsed,
          variance: Math.round((parsed - item.bookStock) * 1000) / 1000,
        };
      })
    );
  };

  const handleRemoveItem = (index) => {
    setAuditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const totalAudited = auditItems.length;
  const matchedCount = auditItems.filter((i) => i.variance === 0).length;
  const discrepanciesCount = auditItems.filter((i) => i.variance !== 0).length;
  const netVariance = auditItems.reduce((acc, item) => acc + item.variance, 0);

  // Export CSV
  const handleExportCsv = () => {
    if (auditItems.length === 0) return;
    const headers = ['Product ID', 'Product Name', 'Barcode', 'Book Stock', 'Physical Count', 'Variance', 'Unit Price'];
    const rows = auditItems.map((item) => [
      item.productId,
      `"${String(item.name || '').replace(/"/g, '""')}"`,
      `"${item.barcode || ''}"`,
      item.bookStock,
      item.physicalCount,
      item.variance,
      item.price,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `physical_stock_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Commit audit to backend
  const handleCommitAudit = async () => {
    if (auditItems.length === 0) return;
    setSubmitting(true);
    setStatusMessage(null);
    try {
      const payload = {
        notes: sessionNotes.trim() || 'Physical stocktaking barcode audit',
        scans: auditItems.map((item) => ({
          productId: item.productId,
          physicalCount: item.physicalCount,
        })),
      };

      const res = await submitStockAudit(payload);
      if (res && res.success) {
        setLastCommitted(res.summary);
        setStatusMessage({
          type: 'success',
          text: `Audit committed successfully! ${res.summary?.discrepancies || 0} variances adjusted in database.`,
        });
        setAuditItems([]);
        if (typeof onAuditApplied === 'function') {
          onAuditApplied(res.summary);
        }
      } else {
        setStatusMessage({
          type: 'danger',
          text: res?.error || 'Failed to commit stock audit adjustments.',
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'danger',
        text: err?.response?.data?.error || err.message || 'Error committing stock audit.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}
      role="dialog"
      aria-modal="true"
      data-testid="stock-audit-modal"
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content shadow-lg border-0">
          {/* Modal Header */}
          <div className="modal-header bg-dark text-white py-3">
            <h5 className="modal-title d-flex align-items-center gap-2">
              <span>🔍 Quick Physical Stocktaking Barcode Audit</span>
              <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: '0.75rem' }}>
                FEAT-INV-005
              </span>
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={onClose}
              disabled={submitting}
            />
          </div>

          {/* Modal Body */}
          <div className="modal-body p-3">
            {/* Session Notes & Scanner Bar */}
            <div className="row g-2 mb-3">
              <div className="col-md-5">
                <label className="form-label small fw-bold mb-1" htmlFor="audit-session-notes">
                  Audit Rack / Zone Reference
                </label>
                <input
                  id="audit-session-notes"
                  className="form-control form-control-sm"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="e.g. Shelf A4 / Grocery Bay 2"
                  disabled={submitting}
                />
              </div>

              <div className="col-md-7">
                <label className="form-label small fw-bold mb-1 text-primary" htmlFor="barcode-scanner-input">
                  Barcode Scanner (Scan items or type barcode + Enter)
                </label>
                <form onSubmit={handleScanSubmit} className="d-flex gap-2">
                  <input
                    id="barcode-scanner-input"
                    ref={inputRef}
                    className="form-control form-control-sm border-primary"
                    placeholder="Scan barcode or type barcode / SKU here..."
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    disabled={scanning || submitting}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-3"
                    disabled={scanning || submitting || !scanInput.trim()}
                  >
                    {scanning ? 'Scanning...' : 'Scan / Add'}
                  </button>
                </form>
              </div>
            </div>

            {/* Status Notifications */}
            {statusMessage && (
              <div
                className={`alert alert-${statusMessage.type} py-2 px-3 small d-flex justify-content-between align-items-center mb-3`}
                role="alert"
              >
                <span>{statusMessage.text}</span>
                <button
                  type="button"
                  className="btn-close btn-close-sm"
                  aria-label="Close"
                  onClick={() => setStatusMessage(null)}
                />
              </div>
            )}

            {lastCommitted && (
              <div className="alert alert-success py-2 px-3 small mb-3">
                <strong>Audit Recorded:</strong> {lastCommitted.totalScanned} items audited | {lastCommitted.matched} matched | {lastCommitted.discrepancies} variances adjusted in inventory.
              </div>
            )}

            {/* KPI Cards */}
            <div className="row g-2 mb-3">
              <div className="col-3">
                <div className="card bg-light border text-center py-2">
                  <div className="text-muted small">Items Audited</div>
                  <div className="h5 mb-0 fw-bold">{totalAudited}</div>
                </div>
              </div>
              <div className="col-3">
                <div className="card bg-success-subtle border border-success text-center py-2">
                  <div className="text-success small">Matched Stock</div>
                  <div className="h5 mb-0 fw-bold text-success">{matchedCount}</div>
                </div>
              </div>
              <div className="col-3">
                <div className="card bg-danger-subtle border border-danger text-center py-2">
                  <div className="text-danger small">Variances (Discrepancies)</div>
                  <div className="h5 mb-0 fw-bold text-danger">{discrepanciesCount}</div>
                </div>
              </div>
              <div className="col-3">
                <div className="card bg-info-subtle border border-info text-center py-2">
                  <div className="text-info small">Net Variance</div>
                  <div className="h5 mb-0 fw-bold text-info">
                    {netVariance > 0 ? `+${netVariance}` : netVariance}
                  </div>
                </div>
              </div>
            </div>

            {/* Scanned Items Table */}
            <div className="table-responsive border rounded" style={{ maxHeight: '340px' }}>
              <table className="table table-hover table-sm align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    <th style={{ width: '35%' }}>Product Name & Barcode</th>
                    <th style={{ width: '15%' }} className="text-center">Book Stock</th>
                    <th style={{ width: '20%' }} className="text-center">Physical Count</th>
                    <th style={{ width: '20%' }} className="text-center">Variance</th>
                    <th style={{ width: '10%' }} className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {auditItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-5">
                        <div className="mb-1">No items scanned yet in this audit session.</div>
                        <small>Point your barcode scanner at shelf products to begin physical inventory count.</small>
                      </td>
                    </tr>
                  ) : (
                    auditItems.map((item, idx) => {
                      const isMatch = item.variance === 0;
                      const isOverage = item.variance > 0;
                      return (
                        <tr key={`${item.productId}-${idx}`}>
                          <td>
                            <div className="fw-bold">{item.name}</div>
                            <span className="small text-muted font-monospace">{item.barcode}</span>
                          </td>
                          <td className="text-center fw-semibold text-secondary">
                            {item.bookStock}
                          </td>
                          <td className="text-center">
                            <input
                              type="number"
                              className="form-control form-control-sm text-center mx-auto"
                              style={{ maxWidth: '90px' }}
                              value={item.physicalCount}
                              min="0"
                              step="1"
                              onChange={(e) => handleCountChange(idx, e.target.value)}
                              disabled={submitting}
                              aria-label={`Physical count for ${item.name}`}
                            />
                          </td>
                          <td className="text-center">
                            {isMatch && (
                              <span className="badge bg-success">✓ Match (0)</span>
                            )}
                            {isOverage && (
                              <span className="badge bg-info text-dark">+{item.variance} Overage</span>
                            )}
                            {!isMatch && !isOverage && (
                              <span className="badge bg-danger">{item.variance} Shortage</span>
                            )}
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger py-0 px-2"
                              title="Remove item"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={submitting}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer bg-light py-2 d-flex justify-content-between align-items-center">
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={handleExportCsv}
                disabled={submitting || auditItems.length === 0}
              >
                📥 Export Variance CSV
              </button>
              {auditItems.length > 0 && (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => setAuditItems([])}
                  disabled={submitting}
                >
                  Clear Session
                </button>
              )}
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel / Close
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm px-4 fw-bold"
                onClick={handleCommitAudit}
                disabled={submitting || auditItems.length === 0}
              >
                {submitting ? 'Applying Adjustments...' : `Commit Audit (${discrepanciesCount} Adjustments)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockAuditModal;
