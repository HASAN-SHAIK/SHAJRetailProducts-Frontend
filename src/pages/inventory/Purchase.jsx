import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { useBranchStore } from '../../store/branchStore';
import api from '../../utils/axios';
import {
  getAllSuppliersCache,
  getLatestBatchForProduct,
  getLocalPurchases,
  getProductCacheByBarcode,
  updateSuppliersCacheBulk,
  updateProductsBulk,
} from '../../core/db';
import { enqueueOfflinePurchase } from '../../utils/offlinePurchases';
import { findProductByBarcode, searchProducts } from '../../utils/purchaseSearch';
import { processInventorySyncQueue } from '../../utils/inventorySync';

const emptyRow = () => ({
  barcode: '',
  product_id: '',
  name: '',
  category: '',
  company: '',
  mrp: '',
  qty: '',
  purchase_price: '',
  selling_price: '',
  gst_percent: '',
  expiry_date: '',
});

const Purchase = () => {
  const { showPopup } = usePopup();
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;

  const [rows, setRows] = useState([emptyRow()]);
  const [isSaving, setIsSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [rowSuggestions, setRowSuggestions] = useState({});
  const [searchLoadingIndex, setSearchLoadingIndex] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const searchTimerRef = useRef(null);
  const nameRefs = useRef({});
  const barcodeRefs = useRef({});

  const buildBarcodeUrl = (barcode) => `/products/barcode/purchase?barcode=${encodeURIComponent(barcode)}`;

  const extractProductFromResponse = (response) => {
    if (!response) return null;
    const data = response?.data;
    if (!data) return null;
    if (Array.isArray(data)) return data[0] || null;
    if (Array.isArray(data.products)) return data.products[0] || null;
    return data.product || data.data || data;
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index) => setRows((prev) => prev.filter((_, idx) => idx !== index));

  const fetchSuppliers = async () => {
    try {
      if (!navigator.onLine) {
        const cached = await getAllSuppliersCache();
        setSuppliers(Array.isArray(cached) ? cached : []);
        return;
      }
      const res = await api.get('/suppliers', { params: { limit: 500, branch_id: effectiveBranchId } });
      const list = res?.data?.data?.suppliers || res?.data?.suppliers || [];
      if (Array.isArray(list) && list.length) {
        updateSuppliersCacheBulk(list).catch(() => {});
      }
      setSuppliers(Array.isArray(list) ? list : []);
    } catch {
      setSuppliers([]);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [effectiveBranchId]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const mapImportItemsToRows = (items = []) =>
    items.map((item) => ({
      barcode: item.barcode || '',
      product_id: item.product_id || '',
      name: item.product_name || item.name || '',
      category: item.category || '',
      company: item.company || '',
      mrp: item.mrp || '',
      qty: item.quantity || item.qty || '',
      purchase_price: item.purchase_price || '',
      selling_price: item.selling_price || '',
      gst_percent: item.gst_percent || item.gstPercent || '',
      expiry_date: item.expiry_date || '',
      match_status: item.match_status || null
    }));

  const trySelectSupplierByName = (supplierName) => {
    if (!supplierName || !suppliers.length) return;
    const needle = String(supplierName).trim().toLowerCase();
    const match = suppliers.find((s) => String(s.name || '').trim().toLowerCase() === needle);
    if (match) {
      setSupplierId(String(match.id));
    }
  };

  const handleImportPdf = async () => {
    if (!importFile) {
      showPopup('Select a file to import.', 'Import');
      return;
    }
    if (!navigator.onLine) {
      showPopup('Import requires an internet connection.', 'Error');
      return;
    }
    setIsImporting(true);
    setImportError('');
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      if (effectiveBranchId) {
        formData.append('branch_id', effectiveBranchId);
      }
      const res = await api.post('/purchase/import-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const payload = res?.data?.data || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) {
        showPopup('No items detected in import.', 'Import');
        return;
      }
      const mapped = mapImportItemsToRows(items);
      setRows(mapped.length ? mapped : [emptyRow()]);
      if (payload.invoice_number) {
        setInvoiceNumber(String(payload.invoice_number));
      }
      const supplierName = payload.supplier_name || payload.seller?.name || null;
      if (supplierName) {
        trySelectSupplierByName(supplierName);
      }
      showPopup('Import completed.', 'Import');
    } catch (err) {
      const message = err?.response?.data?.message || 'Import failed.';
      setImportError(message);
      showPopup(message, 'Error');
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    const refreshPending = async () => {
      const pending = await getLocalPurchases('pending');
      setPendingSyncCount(Array.isArray(pending) ? pending.length : 0);
    };
    refreshPending();
    const handler = () => refreshPending();
    window.addEventListener('offline-purchase-updated', handler);
    return () => window.removeEventListener('offline-purchase-updated', handler);
  }, []);

  const applyProductToRow = async (index, product) => {
    if (!product) return;
    const productId = product.id || product.product_id || '';
    const latestBatch = productId ? await getLatestBatchForProduct(productId, effectiveBranchId) : null;
    updateRow(index, {
      product_id: productId,
      barcode: product.barcode || '',
      name: product.name || product.product_name || '',
      category: product.category || product.category_name || '',
      company: product.company || product.company_name || '',
      mrp: product.mrp || '',
      purchase_price: latestBatch?.purchase_price ?? product.purchase_price ?? '',
      selling_price: latestBatch?.selling_price ?? product.selling_price ?? '',
      gst_percent: product.gst_percentage ?? product.gst_percent ?? '',
      qty: rows[index]?.qty || '1',
    });
    setRowSuggestions((prev) => ({ ...prev, [index]: [] }));
    const nextIndex = index + 1;
    if (!rows[nextIndex]) {
      addRow();
      setTimeout(() => {
        barcodeRefs.current[nextIndex]?.focus?.();
      }, 0);
    } else {
      barcodeRefs.current[nextIndex]?.focus?.();
    }
  };

  const handleBarcodeLookup = async (index) => {
    const barcode = String(rows[index]?.barcode || '').trim();
    if (!barcode) return;
    const cached = await getProductCacheByBarcode(barcode);
    if (cached) {
      await applyProductToRow(index, cached);
      return;
    }
    const found = await findProductByBarcode(barcode, effectiveBranchId);
    if (found) {
      await applyProductToRow(index, found);
      return;
    }
    if (!navigator.onLine) return;
    try {
      const response = await api.get(buildBarcodeUrl(barcode));
      const product = extractProductFromResponse(response);
      if (product) {
        await updateProductsBulk([product]);
        await applyProductToRow(index, product);
      }
    } catch {
      // ignore
    }
  };

  const handleNameSearch = (index, value) => {
    updateRow(index, { name: value });
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const query = String(value || '').trim();
    if (!query) {
      setRowSuggestions((prev) => ({ ...prev, [index]: [] }));
      setSearchLoadingIndex(null);
      return;
    }
    setSearchLoadingIndex(index);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchProducts(query, effectiveBranchId);
      const suggestions = results.slice(0, 8);
      if (!suggestions.length) {
        setRowSuggestions((prev) => ({
          ...prev,
          [index]: [{ __create: true, name: query }],
        }));
      } else {
        setRowSuggestions((prev) => ({ ...prev, [index]: suggestions }));
      }
      setSearchLoadingIndex(null);
    }, 100);
  };

  const handleSave = async () => {
    if (!effectiveBranchId) {
      showPopup('Select a branch before saving purchase.', 'Validation');
      return;
    }
    if (!supplierId) {
      showPopup('Select a supplier before saving purchase.', 'Validation');
      return;
    }
    const items = rows
      .filter((row) => (row.product_id || row.barcode || row.name) && row.qty && row.purchase_price)
      .map((row) => ({
        product_id: row.product_id,
        barcode: row.barcode || undefined,
        name: row.name || undefined,
        category: row.category || undefined,
        company: row.company || undefined,
        mrp: Number(row.mrp || 0) || undefined,
        quantity: Number(row.qty || 0),
        purchase_price: Number(row.purchase_price || 0),
        selling_price: Number(row.selling_price || 0),
        gst_percent: Number(row.gst_percent || 0),
        expiry_date: row.expiry_date || null,
      }));

    if (!items.length) {
      showPopup('Add at least one valid item.', 'Validation');
      return;
    }

    const payload = {
      branch_id: effectiveBranchId,
      supplier_id: supplierId,
      invoice_number: invoiceNumber || null,
      payment_mode: paymentMode,
      items,
      total_price: totalAmount,
    };

    setIsSaving(true);
    try {
      await enqueueOfflinePurchase(payload);
      showPopup('Saved offline. Will sync in background.', 'Offline');
      setRows([emptyRow()]);
      setInvoiceNumber('');
      if (navigator.onLine) {
        processInventorySyncQueue().catch(() => {});
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to save purchase.';
      showPopup(message, 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const totalAmount = useMemo(() => rows.reduce((sum, row) => {
    const qty = Number(row.qty || 0);
    const price = Number(row.purchase_price || 0);
    return sum + qty * price;
  }, 0), [rows]);

  return (
    <div className="billing-page">
      <div className="billing-center">
        <div className="billing-header">
          <div className="d-flex align-items-center gap-2">
            <h5 className="mb-0">Purchase</h5>
            {isOffline && <span className="badge bg-warning text-dark">Offline Mode</span>}
            {pendingSyncCount > 0 && (
              <span className="badge bg-info text-dark">Pending Sync: {pendingSyncCount}</span>
            )}
          </div>
        </div>
        <div className="billing-filters">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <input
              type="file"
              className="form-control billing-input"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(event) => setImportFile(event.target.files?.[0] || null)}
            />
            <button
              className="btn btn-outline-info"
              type="button"
              onClick={handleImportPdf}
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import Invoice'}
            </button>
            {importError && <span className="text-danger small">{importError}</span>}
          </div>
        </div>
        <div className="billing-filters">
          <select
            className="form-control billing-input"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">Select Supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <input
            className="form-control billing-input"
            placeholder="Invoice Number"
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
          <select
            className="form-control billing-input"
            value={paymentMode}
            onChange={(event) => setPaymentMode(event.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
            <option value="online">Online</option>
          </select>
        </div>
        <div className="billing-table-wrapper">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Name</th>
                <th>Category</th>
                <th>Company</th>
                <th>MRP</th>
                <th>Qty</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>GST %</th>
                <th>Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`purchase-row-${idx}`}>
                  <td>
                    <input
                      className="form-control billing-input"
                      value={row.barcode}
                      onChange={(event) => updateRow(idx, { barcode: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleBarcodeLookup(idx);
                        }
                      }}
                      onBlur={() => handleBarcodeLookup(idx)}
                      ref={(el) => {
                        barcodeRefs.current[idx] = el;
                      }}
                    />
                  </td>
                  <td>
                    <div className="position-relative">
                      <input
                        className="form-control billing-input"
                        value={row.name}
                        onChange={(event) => handleNameSearch(idx, event.target.value)}
                        onFocus={(event) => handleNameSearch(idx, event.target.value)}
                        ref={(el) => {
                          nameRefs.current[idx] = el;
                        }}
                      />
                      {searchLoadingIndex === idx && (
                        <div className="small text-secondary mt-1">Searching...</div>
                      )}
                      {Array.isArray(rowSuggestions[idx]) && rowSuggestions[idx].length > 0 && (
                        <ul className="list-group position-absolute w-100 z-3">
                          {rowSuggestions[idx].map((item, itemIdx) => (
                            <li
                              key={`${idx}-suggestion-${itemIdx}`}
                              className="list-group-item list-group-item-action"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                if (item.__create) {
                                  updateRow(idx, { name: item.name });
                                  setRowSuggestions((prev) => ({ ...prev, [idx]: [] }));
                                  return;
                                }
                                applyProductToRow(idx, item);
                              }}
                            >
                              {item.__create
                                ? `Create "${item.name}"`
                                : `${item.name || '-'}${item.company ? ` Â· ${item.company}` : ''}`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      className="form-control billing-input"
                      value={row.category}
                      onChange={(event) => updateRow(idx, { category: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-control billing-input"
                      value={row.company}
                      onChange={(event) => updateRow(idx, { company: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-control billing-input"
                      type="number"
                      min="0"
                      value={row.mrp}
                      onChange={(event) => updateRow(idx, { mrp: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-control billing-input"
                      type="number"
                      min="0"
                      value={row.qty}
                      onChange={(event) => updateRow(idx, { qty: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-control billing-input"
                      type="number"
                      min="0"
                      value={row.purchase_price}
                      onChange={(event) => updateRow(idx, { purchase_price: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-control billing-input"
                      type="number"
                      min="0"
                      value={row.selling_price}
                      onChange={(event) => updateRow(idx, { selling_price: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-control billing-input"
                      type="number"
                      min="0"
                      value={row.gst_percent}
                      onChange={(event) => updateRow(idx, { gst_percent: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="form-control billing-input"
                      type="date"
                      value={row.expiry_date}
                      onChange={(event) => updateRow(idx, { expiry_date: event.target.value })}
                    />
                  </td>
                  <td>
                    <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => removeRow(idx)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="billing-empty">No items yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="billing-modal-actions">
          <div className="purchase-total">Total: INR {totalAmount.toFixed(2)}</div>
          <button className="btn btn-outline-light" type="button" onClick={addRow}>
            Add Row
          </button>
          <button className="btn btn-success" type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Purchase'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Purchase;

