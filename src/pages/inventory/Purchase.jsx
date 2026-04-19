﻿import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { useBranchStore } from '../../store/branchStore';
import api from '../../utils/axios';
import {
  dedupeSuppliersCache,
  getInventorySyncQueueEntries,
  getLatestBatchForProduct,
  getLocalPurchases,
  getProductCacheByBarcode,
  updateSuppliersCacheBulk,
} from '../../core/db';
import { enqueueOfflinePurchase } from '../../utils/offlinePurchases';
import { findProductByBarcodeLocal, searchProductsLocal } from '../../utils/purchaseSearch';
import { processInventorySyncQueue } from '../../utils/inventorySync';
import { collectValidationErrors, firstValidationMessage } from '../../utils/formValidation';

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
  batch_number: '',
  expiry_date: '',
});

const getAdaptiveInputWidth = (value, base = 260, max = 760) => {
  const length = String(value || '').length;
  const estimated = length * 9 + 36;
  return `${Math.min(max, Math.max(base, estimated))}px`;
};

let pdfJsLoader = null;

const loadPdfJs = async () => {
  if (typeof window === 'undefined') {
    throw new Error('PDF parsing is only available in browser.');
  }
  if (window.pdfjsLib) return window.pdfjsLib;
  if (pdfJsLoader) return pdfJsLoader;
  pdfJsLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.min.js';
    script.onload = () => {
      if (!window.pdfjsLib) {
        reject(new Error('Unable to initialize PDF parser.'));
        return;
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF parser.'));
    document.head.appendChild(script);
  });
  return pdfJsLoader;
};

const normalizeSpaces = (value) =>
  String(value || '')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseInvoiceTextItems = (text) => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);

  const banned = [
    'invoice',
    'gst',
    'cgst',
    'sgst',
    'igst',
    'tax',
    'total',
    'discount',
    'amount',
    'balance',
    'subtotal',
    'grand total',
  ];

  const parsed = [];
  for (const line of lines) {
    const lowered = line.toLowerCase();
    if (banned.some((word) => lowered.includes(word))) continue;
    if (!/\d/.test(line)) continue;

    const normalizedLine = line.replace(/^\d+[).\-\s]+/, '').trim();

    const fourCol = normalizedLine.match(
      /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d{1,2})?)\s+(\d+(?:\.\d{1,2})?)$/
    );
    if (fourCol) {
      const name = normalizeSpaces(fourCol[1]);
      const qty = Number(fourCol[2]);
      const rate = Number(fourCol[3]);
      const amount = Number(fourCol[4]);
      if (!name || !Number.isFinite(qty) || !Number.isFinite(rate)) continue;
      parsed.push({
        name,
        quantity: qty,
        purchase_price: rate,
        line_total: Number.isFinite(amount) ? amount : qty * rate,
      });
      continue;
    }

    const threeCol = normalizedLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d{1,2})?)$/);
    if (threeCol) {
      const name = normalizeSpaces(threeCol[1]);
      const qty = Number(threeCol[2]);
      const rate = Number(threeCol[3]);
      if (!name || !Number.isFinite(qty) || !Number.isFinite(rate)) continue;
      parsed.push({
        name,
        quantity: qty,
        purchase_price: rate,
        line_total: qty * rate,
      });
    }
  }

  return parsed;
};

const parseInvoiceMetaFromText = (text) => {
  const source = String(text || '');
  const invoiceMatch =
    source.match(/invoice\s*(?:no|#|number)\s*[:-]?\s*([A-Za-z0-9/-]+)/i) ||
    source.match(/\binv\s*(?:no|#)\s*[:-]?\s*([A-Za-z0-9/-]+)/i);
  return {
    invoice_number: invoiceMatch?.[1] || '',
  };
};

const Purchase = () => {
  const { showPopup } = usePopup();
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const selectedBranchName = useBranchStore((state) => state.selectedBranchName);
  const branches = useBranchStore((state) => state.branches);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;
  const effectiveBranchName = useMemo(() => {
    if (!effectiveBranchId) return '';
    const byStore = String(selectedBranchName || '').trim();
    if (byStore) return byStore;
    const branch = (Array.isArray(branches) ? branches : []).find(
      (item) => String(item?.id || '') === String(effectiveBranchId)
    );
    return String(branch?.branch_name || branch?.name || branch?.title || effectiveBranchId);
  }, [branches, effectiveBranchId, selectedBranchName]);

  const [rows, setRows] = useState([emptyRow()]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [rowSuggestions, setRowSuggestions] = useState({});
  const [searchLoadingIndex, setSearchLoadingIndex] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncIssueSummary, setSyncIssueSummary] = useState([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importMode, setImportMode] = useState('frontend_pdf');
  const [formErrors, setFormErrors] = useState({});
  const [rowFieldErrors, setRowFieldErrors] = useState({});
  const searchTimerRef = useRef(null);
  const nameRefs = useRef({});
  const barcodeRefs = useRef({});

  const refreshPendingSummary = async () => {
    const pending = await getLocalPurchases('pending');
    setPendingSyncCount(Array.isArray(pending) ? pending.length : 0);
    const queue = await getInventorySyncQueueEntries(['pending', 'failed']);
    const purchaseEntries = (Array.isArray(queue) ? queue : [])
      .filter((entry) => entry?.type === 'purchase')
      .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
    const summary = purchaseEntries
      .map((entry) => ({
        id: entry.entityId,
        status: entry.status || 'pending',
        reason: entry.last_error || null,
        retries: entry.retries || 0,
      }))
      .slice(0, 4);
    setSyncIssueSummary(summary);
    return purchaseEntries;
  };

  const normalizeBarcodeValue = (value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    const lowered = text.toLowerCase();
    if (
      text.startsWith('id:') ||
      lowered.startsWith('temp:') ||
      lowered.startsWith('local:') ||
      lowered.startsWith('tmp:')
    ) {
      return '';
    }
    return text;
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
    showPopup('Row added.', 'Info');
  };
  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
    showPopup('Row removed.', 'Info');
  };

  const fetchSuppliers = async () => {
    try {
      const cached = await dedupeSuppliersCache();
      const cachedList = Array.isArray(cached) ? cached : [];
      if (cachedList.length) {
        setSuppliers(cachedList);
      }
      if (!navigator.onLine) {
        if (!cachedList.length) setSuppliers([]);
        return;
      }
      const res = await api.get('/suppliers', { params: { limit: 500, branch_id: effectiveBranchId } });
      const list = res?.data?.data?.suppliers || res?.data?.suppliers || [];
      if (Array.isArray(list) && list.length) {
        await updateSuppliersCacheBulk(list);
        const latest = await dedupeSuppliersCache();
        setSuppliers(Array.isArray(latest) ? latest : list);
      } else {
        setSuppliers(cachedList.length ? cachedList : []);
      }
    } catch {
      // keep existing cached list if API fails
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
      batch_number: item.batch_number || item.batchNo || '',
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
    if (!effectiveBranchId) {
      showPopup('Select a branch before importing purchase invoice.', 'Validation');
      return;
    }
    const importConfirmed = window.confirm(
      `Please confirm branch before import:\n${effectiveBranchName || effectiveBranchId}\n\nProceed with this branch?`
    );
    if (!importConfirmed) return;
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
      const isPdf = String(importFile?.name || '').toLowerCase().endsWith('.pdf');
      if (importMode === 'frontend_pdf') {
        if (!isPdf) {
          showPopup('Frontend mode supports PDF only. Use API mode for images.', 'Validation');
          return;
        }
        const pdfjsLib = await loadPdfJs();
        const bytes = new Uint8Array(await importFile.arrayBuffer());
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
        const pageTexts = [];
        for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
          const page = await doc.getPage(pageNum);
          const content = await page.getTextContent();
          const text = (content.items || []).map((item) => item.str || '').join(' ');
          pageTexts.push(text);
        }
        const fullText = pageTexts.join('\n');
        const parsedItems = parseInvoiceTextItems(fullText);
        if (!parsedItems.length) {
          throw new Error('No items could be parsed from this PDF.');
        }
        const mapped = mapImportItemsToRows(parsedItems);
        setRows(mapped.length ? mapped : [emptyRow()]);
        const meta = parseInvoiceMetaFromText(fullText);
        if (meta.invoice_number) {
          setInvoiceNumber(String(meta.invoice_number));
        }
        showPopup(`Imported ${mapped.length} item(s) in browser.`, 'Import');
        return;
      }

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
    refreshPendingSummary();
    const handler = () => refreshPendingSummary();
    window.addEventListener('offline-purchase-updated', handler);
    window.addEventListener('online', handler);
    return () => {
      window.removeEventListener('offline-purchase-updated', handler);
      window.removeEventListener('online', handler);
    };
  }, []);

  const handleSyncNow = async ({ showToast = true } = {}) => {
    if (!navigator.onLine) {
      if (showToast) {
        showPopup('You are offline. Connect to internet and retry sync.', 'Sync');
      }
      return;
    }
    try {
      setIsSyncingNow(true);
      await processInventorySyncQueue();
      const purchaseEntries = await refreshPendingSummary();
      if (showToast) {
        if (!purchaseEntries.length) {
          showPopup('Purchase sync completed.', 'Sync');
        } else {
          const first = purchaseEntries[0];
          showPopup(
            `Purchase sync still pending. ${first?.last_error ? `Reason: ${first.last_error}` : 'Check sync notes below.'}`,
            'Sync'
          );
        }
      }
    } finally {
      setIsSyncingNow(false);
    }
  };

  const applyProductToRow = async (index, product) => {
    if (!product) return;
    const productId = product.id || product.product_id || '';
    const latestBatch = productId ? await getLatestBatchForProduct(productId, effectiveBranchId) : null;
    const displayName = product.name || product.product_name || 'Product';
    updateRow(index, {
      product_id: productId,
      barcode: normalizeBarcodeValue(product.barcode),
      name: product.name || product.product_name || '',
      category: product.category || product.category_name || '',
      company: product.company || product.company_name || '',
      mrp: product.mrp || '',
      purchase_price: latestBatch?.purchase_price ?? product.purchase_price ?? '',
      selling_price: latestBatch?.selling_price ?? product.selling_price ?? '',
      gst_percent: product.gst_percentage ?? product.gst_percent ?? '',
      batch_number: rows[index]?.batch_number || '',
      qty: rows[index]?.qty || '1',
    });
    showPopup(`${displayName} selected.`, 'Success');
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
    let matched = false;
    const cached = await getProductCacheByBarcode(barcode);
    if (cached) {
      await applyProductToRow(index, cached);
      matched = true;
      return;
    }
    const found = await findProductByBarcodeLocal(barcode, effectiveBranchId);
    if (found) {
      await applyProductToRow(index, found);
      matched = true;
      return;
    }
    if (!matched) {
      showPopup('No product found in offline cache for this barcode.', 'Warning');
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
      const results = await searchProductsLocal(query, effectiveBranchId);
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
    const preErrors = collectValidationErrors([
      { key: 'branch', validate: () => Boolean(effectiveBranchId), message: 'Select a branch before saving purchase.' },
      { key: 'supplier', validate: () => Boolean(supplierId), message: 'Select a supplier before saving purchase.' }
    ]);
    setFormErrors(preErrors);
    if (Object.keys(preErrors).length > 0) {
      showPopup(firstValidationMessage(preErrors), 'Validation');
      return;
    }
    const saveConfirmed = window.confirm(
      `Please confirm branch before saving purchase:\n${effectiveBranchName || effectiveBranchId}\n\nProceed with this branch?`
    );
    if (!saveConfirmed) return;
    const rowErrors = [];
    const nextRowFieldErrors = {};
    const items = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 1;
      let rowHasError = false;
      const rowKey = String(index);
      nextRowFieldErrors[rowKey] = {};
      const hasAnyValue = [
        row.product_id,
        row.barcode,
        row.name,
        row.category,
        row.company,
        row.mrp,
        row.qty,
        row.purchase_price,
        row.selling_price,
        row.gst_percent,
        row.batch_number,
        row.expiry_date,
      ].some((value) => String(value ?? '').trim() !== '');

      if (!hasAnyValue) return;

      const hasIdentity = Boolean(
        String(row.product_id || '').trim() ||
          String(row.barcode || '').trim() ||
          String(row.name || '').trim()
      );
      const batchNumber = String(row.batch_number || '').trim();
      const quantity = Number(row.qty || 0);
      const purchasePrice = Number(row.purchase_price || 0);
      const sellingPrice =
        row.selling_price === '' || row.selling_price === null || row.selling_price === undefined
          ? null
          : Number(row.selling_price);
      const gstPercent =
        row.gst_percent === '' || row.gst_percent === null || row.gst_percent === undefined
          ? 0
          : Number(row.gst_percent);

      if (!hasIdentity) {
        rowErrors.push(`Row ${rowNumber}: Product name or barcode is required.`);
        nextRowFieldErrors[rowKey].name = 'Product name or barcode is required.';
        rowHasError = true;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        rowErrors.push(`Row ${rowNumber}: Quantity must be greater than 0.`);
        nextRowFieldErrors[rowKey].qty = 'Quantity must be greater than 0.';
        rowHasError = true;
      }
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        rowErrors.push(`Row ${rowNumber}: Cost price is required and must be >= 0.`);
        nextRowFieldErrors[rowKey].purchase_price = 'Cost price must be >= 0.';
        rowHasError = true;
      }
      if (sellingPrice !== null && (!Number.isFinite(sellingPrice) || sellingPrice < 0)) {
        rowErrors.push(`Row ${rowNumber}: Selling price must be >= 0.`);
        nextRowFieldErrors[rowKey].selling_price = 'Selling price must be >= 0.';
        rowHasError = true;
      }
      if (!Number.isFinite(gstPercent) || gstPercent < 0) {
        rowErrors.push(`Row ${rowNumber}: GST % must be >= 0.`);
        nextRowFieldErrors[rowKey].gst_percent = 'GST % must be >= 0.';
        rowHasError = true;
      }

      if (rowHasError) return;

      items.push({
        product_id: row.product_id,
        barcode: row.barcode || undefined,
        name: row.name || undefined,
        category: row.category || undefined,
        company: row.company || undefined,
        mrp: Number(row.mrp || 0) || undefined,
        batch_number: batchNumber || undefined,
        quantity,
        purchase_price: purchasePrice,
        selling_price: sellingPrice ?? 0,
        gst_percent: gstPercent,
        expiry_date: row.expiry_date || null,
      });
    });

    if (rowErrors.length) {
      setRowFieldErrors(nextRowFieldErrors);
      const first = rowErrors[0];
      const remaining = rowErrors.length - 1;
      showPopup(
        remaining > 0 ? `${first} (+${remaining} more issue${remaining > 1 ? 's' : ''})` : first,
        'Validation'
      );
      return;
    }
    setRowFieldErrors({});
    setFormErrors({});

    if (!items.length) {
      showPopup('Add at least one valid item row.', 'Validation');
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
        await handleSyncNow({ showToast: false });
      } else {
        await refreshPendingSummary();
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to save purchase.';
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
            {isSyncingNow && (
              <span className="badge bg-secondary">Syncing...</span>
            )}
            {(pendingSyncCount > 0 || syncIssueSummary.length > 0 || isSyncingNow) && (
              <button className="btn btn-outline-info btn-sm" type="button" onClick={handleSyncNow} disabled={isSyncingNow}>
                {isSyncingNow ? 'Syncing...' : 'Sync Now'}
              </button>
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
            <select
              className="form-control billing-input"
              value={importMode}
              onChange={(event) => setImportMode(event.target.value)}
            >
              <option value="frontend_pdf">Parse in Browser (PDF)</option>
              <option value="api">Parse via API (PDF/Image)</option>
            </select>
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
            className={`form-control billing-input ${formErrors.supplier ? 'is-invalid' : ''}`}
            value={supplierId}
            onChange={(event) => {
              const value = event.target.value;
              setSupplierId(value);
              if (!value) {
                showPopup('Supplier is required for purchase.', 'Validation');
              } else {
                showPopup('Supplier selected.', 'Info');
              }
            }}
          >
            <option value="">Select Supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          {formErrors.supplier && <small className="text-danger">{formErrors.supplier}</small>}
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
        {syncIssueSummary.length > 0 && (
          <div className="alert alert-warning py-2 px-3 mt-2 mb-2">
            <strong>Sync Notes:</strong>
            <div className="small mt-1">
              {syncIssueSummary.map((entry, idx) => (
                <div key={`${entry.id}-${idx}`}>
                  {idx + 1}. {entry.id} ({entry.status}{entry.retries ? `, retry ${entry.retries}` : ''})
                  {entry.reason ? ` - ${entry.reason}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="billing-table-wrapper">
          <table className="billing-table purchase-entry-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Barcode</th>
                <th>Name</th>
                <th>Category</th>
                <th>Company</th>
                <th>MRP</th>
                <th>Qty</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>GST %</th>
                <th>Batch No</th>
                <th>Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`purchase-row-${idx}`}>
                  <td>{idx + 1}</td>
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
                    <div className="position-relative" style={{ minWidth: getAdaptiveInputWidth(row.name, 280, 760) }}>
                      <input
                        className={`form-control billing-input ${rowFieldErrors[String(idx)]?.name ? 'is-invalid' : ''}`}
                        style={{ width: '100%' }}
                        value={row.name}
                        onChange={(event) => handleNameSearch(idx, event.target.value)}
                        onFocus={(event) => handleNameSearch(idx, event.target.value)}
                        ref={(el) => {
                          nameRefs.current[idx] = el;
                        }}
                      />
                      {rowFieldErrors[String(idx)]?.name && <small className="text-danger">{rowFieldErrors[String(idx)].name}</small>}
                      {searchLoadingIndex === idx && (
                        <div className="small text-secondary mt-1">Searching...</div>
                      )}
                      {Array.isArray(rowSuggestions[idx]) && rowSuggestions[idx].length > 0 && (
                        <ul className="list-group position-absolute z-3 purchase-suggestions">
                          {rowSuggestions[idx].map((item, itemIdx) => (
                            <li
                              key={`${idx}-suggestion-${itemIdx}`}
                              className="list-group-item list-group-item-action"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                if (item.__create) {
                                  updateRow(idx, { name: item.name });
                                  setRowSuggestions((prev) => ({ ...prev, [idx]: [] }));
                                  showPopup('New product will be created on save.', 'Info');
                                  return;
                                }
                                applyProductToRow(idx, item);
                              }}
                            >
                              <span className="purchase-suggestion-text">
                                {item.__create
                                  ? `Create "${item.name}"`
                                  : `${item.name || '-'}${item.company ? ` Â· ${item.company}` : ''}`}
                              </span>
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
                      className={`form-control billing-input ${rowFieldErrors[String(idx)]?.qty ? 'is-invalid' : ''}`}
                      type="number"
                      min="0"
                      value={row.qty}
                      onChange={(event) => updateRow(idx, { qty: event.target.value })}
                    />
                    {rowFieldErrors[String(idx)]?.qty && <small className="text-danger">{rowFieldErrors[String(idx)].qty}</small>}
                  </td>
                  <td>
                    <input
                      className={`form-control billing-input ${rowFieldErrors[String(idx)]?.purchase_price ? 'is-invalid' : ''}`}
                      type="number"
                      min="0"
                      value={row.purchase_price}
                      onChange={(event) => updateRow(idx, { purchase_price: event.target.value })}
                    />
                    {rowFieldErrors[String(idx)]?.purchase_price && <small className="text-danger">{rowFieldErrors[String(idx)].purchase_price}</small>}
                  </td>
                  <td>
                    <input
                      className={`form-control billing-input ${rowFieldErrors[String(idx)]?.selling_price ? 'is-invalid' : ''}`}
                      type="number"
                      min="0"
                      value={row.selling_price}
                      onChange={(event) => updateRow(idx, { selling_price: event.target.value })}
                    />
                    {rowFieldErrors[String(idx)]?.selling_price && <small className="text-danger">{rowFieldErrors[String(idx)].selling_price}</small>}
                  </td>
                  <td>
                    <input
                      className={`form-control billing-input ${rowFieldErrors[String(idx)]?.gst_percent ? 'is-invalid' : ''}`}
                      type="number"
                      min="0"
                      value={row.gst_percent}
                      onChange={(event) => updateRow(idx, { gst_percent: event.target.value })}
                    />
                    {rowFieldErrors[String(idx)]?.gst_percent && <small className="text-danger">{rowFieldErrors[String(idx)].gst_percent}</small>}
                  </td>
                  <td>
                    <input
                      className="form-control billing-input"
                      value={row.batch_number}
                      onChange={(event) => updateRow(idx, { batch_number: event.target.value })}
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
                  <td colSpan={13} className="billing-empty">No items yet.</td>
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
