import React, { useState, useCallback } from 'react';
import api from '../../utils/axios';
import { createUnreferencedReturn } from '../../services/returnsCorrectionsApi';
import { usePopup } from '../../components/common/PopUp/PopupProvider';

const REASON_PRESETS = [
  'Customer lost original bill / receipt',
  'Wrong size / fit (purchased previously)',
  'Gift return without bill',
  'Defective / Damaged walk-in item',
  'Customer dissatisfaction',
  'Other (specify)',
];

const UnreferencedReturnTab = ({ onReturnCompleted }) => {
  const { showPopup } = usePopup();

  // Header / Context State
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [refundMode, setRefundMode] = useState('cash');
  const [reason, setReason] = useState(REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState('');
  const [managerApprovedBy, setManagerApprovedBy] = useState('Store Manager');

  // Search & Item State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [returnItems, setReturnItems] = useState([]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [lastCompletedReturn, setLastCompletedReturn] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle Product Search
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    const q = String(query || '').trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      let products = [];
      try {
        const res = await api.get('/products/search/sale', { params: { query: q } });
        products = res?.data?.products || res?.data?.data || [];
      } catch {
        try {
          const res = await api.get('/products/search', { params: { query: q } });
          products = res?.data?.products || res?.data?.data || [];
        } catch {
          products = [];
        }
      }
      setSearchResults(Array.isArray(products) ? products.slice(0, 8) : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Add Product to Return List
  const handleAddProduct = (prod) => {
    const existingIndex = returnItems.findIndex((item) => item.productId === prod.id);
    const basePrice = Number(prod.price || prod.selling_price || 0);

    if (existingIndex >= 0) {
      setReturnItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setReturnItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name || `Product #${prod.id}`,
          barcode: prod.barcode || '',
          standardPrice: basePrice,
          unitPrice: basePrice, // Default manager override price to standard price
          quantity: 1,
          condition: 'good', // 'good' = restock, 'damaged' = quarantine
          gstPercent: Number(prod.gst_percent || 0),
        },
      ]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUpdateItem = (index, field, value) => {
    setReturnItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (index) => {
    setReturnItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Financial Calculations
  const totalRefundAmount = returnItems.reduce((sum, item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    return sum + qty * price;
  }, 0);

  const goodItemsCount = returnItems.filter((i) => i.condition === 'good').length;
  const damagedItemsCount = returnItems.filter((i) => i.condition === 'damaged').length;

  // Submit Unreferenced Return
  const handleSubmitReturn = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (returnItems.length === 0) {
      setErrorMessage('Please add at least one product for walk-in return.');
      return;
    }

    if (!managerApprovedBy.trim()) {
      setErrorMessage('Manager approval / name is required for unreferenced returns.');
      return;
    }

    for (const item of returnItems) {
      if (Number(item.quantity) <= 0) {
        setErrorMessage(`Invalid quantity for ${item.productName}`);
        return;
      }
      if (Number(item.unitPrice) < 0 || isNaN(Number(item.unitPrice))) {
        setErrorMessage(`Invalid override price for ${item.productName}`);
        return;
      }
    }

    const finalReason = reason === 'Other (specify)' ? (customReason.trim() || 'Walk-in return') : reason;

    const payload = {
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim() || undefined,
      refundMode,
      reason: finalReason,
      managerApprovedBy: managerApprovedBy.trim(),
      items: returnItems.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        condition: item.condition,
      })),
    };

    setSubmitting(true);
    try {
      const res = await createUnreferencedReturn(payload);
      if (res && res.success) {
        setLastCompletedReturn(res.return);
        setReturnItems([]);
        setErrorMessage('');
        if (showPopup) {
          showPopup('Unreferenced walk-in return recorded successfully!', 'success');
        }
        if (typeof onReturnCompleted === 'function') {
          onReturnCompleted(res.return);
        }
      } else {
        setErrorMessage(res?.message || res?.error || 'Failed to process return.');
      }
    } catch (err) {
      setErrorMessage(err?.response?.data?.error || err.message || 'Error executing walk-in return.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="unreferenced-return-container" data-testid="unreferenced-return-tab">
      {/* Alert Banners */}
      {errorMessage && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between my-2" role="alert">
          <span>{errorMessage}</span>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setErrorMessage('')} />
        </div>
      )}

      {lastCompletedReturn && (
        <div className="alert alert-success my-2" role="alert">
          <div className="d-flex justify-content-between align-items-center">
            <strong>✅ Return Processed Successfully!</strong>
            <button type="button" className="btn-close" aria-label="Close" onClick={() => setLastCompletedReturn(null)} />
          </div>
          <div className="mt-1 small">
            <span><strong>Return ID:</strong> {lastCompletedReturn.returnId}</span> |{' '}
            <span><strong>Refund Total:</strong> ₹{Number(lastCompletedReturn.refundTotal || 0).toFixed(2)}</span> |{' '}
            <span><strong>Mode:</strong> {String(lastCompletedReturn.refundMode || '').toUpperCase()}</span> |{' '}
            <span><strong>Approved By:</strong> {lastCompletedReturn.managerApprovedBy}</span>
          </div>
        </div>
      )}

      {/* Return Header & Manager Override Controls */}
      <div className="returns-card mb-3">
        <h6 className="fw-bold mb-3 text-primary d-flex align-items-center gap-2">
          <span>Walk-In Customer & Manager Approval</span>
          <span className="badge bg-secondary text-white fw-normal" style={{ fontSize: '0.75rem' }}>
            No Original Bill Required
          </span>
        </h6>

        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label" htmlFor="unref-customer-name">Customer Name</label>
            <input
              id="unref-customer-name"
              className="form-control"
              value={customerName}
              placeholder="e.g. Walk-in Customer"
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="col-md-3">
            <label className="form-label" htmlFor="unref-customer-phone">Customer Phone (Optional)</label>
            <input
              id="unref-customer-phone"
              className="form-control"
              value={customerPhone}
              placeholder="e.g. 9876543210"
              onChange={(e) => setCustomerPhone(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="col-md-3">
            <label className="form-label" htmlFor="unref-refund-mode">Refund Payout Mode</label>
            <select
              id="unref-refund-mode"
              className="form-select"
              value={refundMode}
              onChange={(e) => setRefundMode(e.target.value)}
              disabled={submitting}
            >
              <option value="cash">Cash (Drawer Payout)</option>
              <option value="store_credit">Store Credit / Khata</option>
              <option value="upi">UPI / Bank Transfer</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label" htmlFor="unref-manager-approval">Manager Authorized By</label>
            <input
              id="unref-manager-approval"
              className="form-control"
              value={managerApprovedBy}
              placeholder="Manager name or PIN"
              onChange={(e) => setManagerApprovedBy(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="col-md-6">
            <label className="form-label" htmlFor="unref-reason">Return Reason</label>
            <select
              id="unref-reason"
              className="form-select"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
            >
              {REASON_PRESETS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {reason === 'Other (specify)' && (
            <div className="col-md-6">
              <label className="form-label" htmlFor="unref-custom-reason">Specific Reason Details</label>
              <input
                id="unref-custom-reason"
                className="form-control"
                value={customReason}
                placeholder="Describe reason for unreferenced return"
                onChange={(e) => setCustomReason(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}
        </div>
      </div>

      {/* Product Search & Scanner */}
      <div className="returns-card mb-3">
        <h6 className="fw-bold mb-2">Scan Barcode or Search Products for Return</h6>
        <div className="position-relative">
          <input
            type="text"
            className="form-control"
            placeholder="Type barcode or product name to add..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={submitting}
          />
          {searching && (
            <div className="position-absolute top-50 end-0 translate-middle-y me-3 text-secondary small">
              Searching...
            </div>
          )}

          {searchResults.length > 0 && (
            <ul
              className="list-group position-absolute w-100 shadow-sm mt-1"
              style={{ zIndex: 1050, maxHeight: '220px', overflowY: 'auto' }}
            >
              {searchResults.map((prod) => (
                <li
                  key={prod.id}
                  className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleAddProduct(prod)}
                >
                  <div>
                    <strong>{prod.name}</strong>
                    {prod.barcode && <span className="text-muted ms-2 small">({prod.barcode})</span>}
                  </div>
                  <div>
                    <span className="badge bg-primary rounded-pill">
                      ₹{Number(prod.price || prod.selling_price || 0).toFixed(2)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Return Items Table */}
      <div className="returns-card">
        <h6 className="fw-bold mb-3 d-flex justify-content-between align-items-center">
          <span>Items to Return ({returnItems.length})</span>
          {returnItems.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setReturnItems([])}
              disabled={submitting}
            >
              Clear All Items
            </button>
          )}
        </h6>

        <table className="returns-table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Product Name</th>
              <th style={{ width: '12%' }}>Standard Price</th>
              <th style={{ width: '15%' }}>Override Return Price (₹)</th>
              <th style={{ width: '12%' }}>Return Qty</th>
              <th style={{ width: '18%' }}>Condition</th>
              <th style={{ width: '10%' }}>Line Total</th>
              <th style={{ width: '5%' }}></th>
            </tr>
          </thead>
          <tbody>
            {returnItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  No return items added. Scan a barcode or search above to add items.
                </td>
              </tr>
            ) : (
              returnItems.map((item, idx) => {
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                return (
                  <tr key={`${item.productId}-${idx}`}>
                    <td>
                      <div><strong>{item.productName}</strong></div>
                      {item.barcode && <span className="small text-muted">{item.barcode}</span>}
                    </td>
                    <td>₹{Number(item.standardPrice).toFixed(2)}</td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={item.unitPrice}
                        min="0"
                        step="0.01"
                        onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                        disabled={submitting}
                        aria-label={`Override price for ${item.productName}`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={item.quantity}
                        min="0.001"
                        step="1"
                        onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                        disabled={submitting}
                        aria-label={`Return quantity for ${item.productName}`}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={item.condition}
                        onChange={(e) => handleUpdateItem(idx, 'condition', e.target.value)}
                        disabled={submitting}
                        aria-label={`Condition for ${item.productName}`}
                      >
                        <option value="good">Good / Sellable (Restock)</option>
                        <option value="damaged">Damaged / Defective (Write-off)</option>
                      </select>
                    </td>
                    <td className="fw-bold">₹{lineTotal.toFixed(2)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger p-1"
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

        {/* Financial Summary & Action Bar */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-3 border-top">
          <div className="d-flex gap-3 align-items-center">
            <span className="badge bg-light text-dark border p-2">
              <strong>Total Refund:</strong> ₹{totalRefundAmount.toFixed(2)}
            </span>
            <span className="badge bg-success-subtle text-success border border-success p-2">
              <strong>Sellable Restock:</strong> {goodItemsCount} item(s)
            </span>
            {damagedItemsCount > 0 && (
              <span className="badge bg-warning-subtle text-warning border border-warning p-2">
                <strong>Damaged:</strong> {damagedItemsCount} item(s)
              </span>
            )}
          </div>

          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-primary px-4 py-2"
              onClick={handleSubmitReturn}
              disabled={submitting || returnItems.length === 0}
            >
              {submitting ? 'Processing Walk-In Return...' : `Complete Walk-In Return (₹${totalRefundAmount.toFixed(2)})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnreferencedReturnTab;
