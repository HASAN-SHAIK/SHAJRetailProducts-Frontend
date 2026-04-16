import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import './ProductsPage.css'; // Custom styles
import api from '../../utils/axios';
import { Modal } from 'bootstrap';
import AddProductModalComponent from './AddModalComponent/AddProductModalComponent';
import { useSelector } from 'react-redux';
import { preloadAllCaches, preloadProductsToIndexedDb } from '../../utils/indexedDb';
import {
  addOfflineImport,
  addSyncQueueItem,
  getAllBatches,
  getAllProducts,
  getProductByBarcode,
  getOfflineImports,
  getSyncQueueItems,
  updateBatchesBulk,
  updateProductsBulk,
  updateSyncQueueItem,
} from '../../core/db';
import { runDeltaSync } from '../../utils/deltaSync';
import { usePopup } from '../common/PopUp/PopupProvider';
import { useBranchStore } from '../../store/branchStore';
import { createOfflineProduct, deleteOfflineProduct, updateOfflineProduct } from '../../utils/offlineProducts';
import { syncAllInventory } from '../../utils/inventorySync';
import { syncAllImports } from '../../utils/importSync';
import { getTenantFeatures, hasFeature } from '../../utils/entitlements';

const ProductsPage = ({ navigate }) => {
//Modal data
 const [productUpdateFlag, setProductUpdateFlag] = useState(false);
 const userDetails = useSelector((state) => state.user.userDetails);
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
 const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
 const features = getTenantFeatures(tenantConfig);
 const weightBasedEnabled =
  features.enable_weight_based !== false &&
  tenantConfig?.enable_weight_based !== false;
 const pieceBasedEnabled =
  features.enable_piece_based !== false &&
  tenantConfig?.enable_piece_based !== false;
 const barcodeEnabled = hasFeature(tenantConfig, 'enable_barcode');
 const defaultWeightValue = weightBasedEnabled && !pieceBasedEnabled ? '1' : '0';
 const { showPopup } = usePopup();
  const [formData, setFormData] = useState({
  product_name: '',
    company: '',
    selling_price: '',
    purchase_price: '',
    mrp: '',
    stock_quantity: '',
    category: '',
    hsn_code: '',
    gst_percentage: '',
    is_batch_enabled: '0',
    batch_number: '',
    expiry_date: '',
    time_for_delivery: '',
    is_weight_based: defaultWeightValue,
    barcode: ''
  });
  const [hsnSuggestions, setHsnSuggestions] = useState([]);
  const [gstTouched, setGstTouched] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'gst_percentage') {
      setGstTouched(true);
    }
    if (name === 'hsn_code') {
      setGstTouched(false);
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pieceBasedEnabled && formData.is_weight_based === '0') {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }
    if (!weightBasedEnabled && formData.is_weight_based === '1') {
      showPopup('Weight-based products are disabled for this tenant.', 'Feature');
      return;
    }

    try {
      setIsAddingProduct(true);
      const payload = { ...formData };
      if (!barcodeEnabled && !payload.barcode) {
        delete payload.barcode;
      }
      if (payload.expiry_date === '') payload.expiry_date = null;
      if (payload.batch_number === '') payload.batch_number = null;
      await createOfflineProduct(payload);
      setFormData({
        product_name: '',
        company: '',
        category:'',
        hsn_code: '',
        gst_percentage: '',
        is_batch_enabled: '0',
        batch_number: '',
        expiry_date: '',
      selling_price: '',
      purchase_price: '',
      mrp: '',
      stock_quantity: '',
      time_for_delivery: '',
      is_weight_based: defaultWeightValue,
        barcode: ''
      });
      const modalElement = document.getElementById('addProductModal');
      const modal = Modal.getInstance(modalElement);
      modal.hide();
      showPopup("Product saved offline. Will sync in background.", "Offline");
      setForceApiFetch(true);
      setProductUpdateFlag((prev) => !prev);
      if (navigator.onLine) {
        preloadProductsToIndexedDb({ branchId: selectedBranchId }).catch(() => {});
      }

    } catch (err) {
      if(err.response.data.message === 'Invalid Token' || err.response.status === 401){
      showPopup("Token Expired Please Login Again!", "Session");
      navigate('/logout');
      }
      else{
      showPopup("Issue while adding please try later", "Error");
      console.error('Error adding product:', err);
      }
    } finally {
      setIsAddingProduct(false);
    }
    
  };

  const productFields = [
    { label: 'Product Name', name: 'product_name' },
    { label: 'Company', name: 'company' },
    { label: 'Barcode', name: 'barcode', required: false, autoFocus: true },
    { label: 'Category', name: 'category', type: 'datalist' },
    { label: 'Selling Price', name: 'selling_price', type: 'number' },
    { label: 'Purchase Price', name: 'purchase_price', type: 'number' },
    { label: 'MRP', name: 'mrp', type: 'number' },
    { label: 'HSN Code', name: 'hsn_code', type: 'hsn', required: false },
    { label: 'GST %', name: 'gst_percentage', type: 'number', required: false },
    { label: 'Batch Enabled', name: 'is_batch_enabled', type: 'select', required: false, options: [
      { label: 'No', value: '0' },
      { label: 'Yes', value: '1' },
    ]},
    { label: 'Batch Number', name: 'batch_number', required: false },
    { label: 'Expiry Date', name: 'expiry_date', type: 'date', required: false },
    { label: 'Quantity', name: 'stock_quantity', type: 'number' },
    { label: 'Time For Delivery', name:'time_for_delivery', type: 'number'},
    { label: 'Type', name: 'is_weight_based', type: 'select', options: [
      ...(pieceBasedEnabled ? [{ label: 'Piece-based', value: '0' }] : []),
      ...(weightBasedEnabled ? [{ label: 'Weight-based', value: '1' }] : [])
    ]},
  ];

 const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
 const [errorMessage, setErrorMessage] = useState('');
 const [pagination, setPagination] = useState({
  page: 1,
  limit: 10,
  total_pages: 1,
  total_records: 0,
 });
 const [searchInput, setSearchInput] = useState('');
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedCategory, setSelectedCategory] = useState('');
 const [sortBy, setSortBy] = useState('created_at');
 const [sortOrder, setSortOrder] = useState('desc');
 const [deleteModalOpen, setDeleteModalOpen] = useState(false);
 const [deleteTarget, setDeleteTarget] = useState(null);
 const [deletingId, setDeletingId] = useState(null);
 const [isAddingProduct, setIsAddingProduct] = useState(false);
 const [forceApiFetch, setForceApiFetch] = useState(false);
 const [extraDetailsByBarcode, setExtraDetailsByBarcode] = useState({});
 const [activeEdit, setActiveEdit] = useState(null);
 const [editedMap, setEditedMap] = useState({});
 const [savingBulk, setSavingBulk] = useState(false);
 const [stockModalOpen, setStockModalOpen] = useState(false);
 const [stockLoading, setStockLoading] = useState(false);
 const [stockRows, setStockRows] = useState([]);
 const [stockTarget, setStockTarget] = useState(null);
 const [expandedProductKey, setExpandedProductKey] = useState(null);
 const [batchRowsByProductKey, setBatchRowsByProductKey] = useState({});
 const [batchLoadingByProductKey, setBatchLoadingByProductKey] = useState({});
 const [importModalOpen, setImportModalOpen] = useState(false);
 const [importFile, setImportFile] = useState(null);
 const [importResult, setImportResult] = useState(null);
 const [importError, setImportError] = useState('');
 const [importing, setImporting] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const [importPreviewError, setImportPreviewError] = useState('');
  const [importParsing, setImportParsing] = useState(false);
  const [autoCategoryEnabled, setAutoCategoryEnabled] = useState(true);
  const [syncingInventory, setSyncingInventory] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const loadImportHistory = useCallback(async () => {
    setImportHistoryLoading(true);
    try {
      const list = await getOfflineImports();
      const safe = Array.isArray(list) ? list : [];
      safe.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setImportHistory(safe);
    } catch {
      setImportHistory([]);
    } finally {
      setImportHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImportHistory();
  }, [loadImportHistory]);

  useEffect(() => {
    if (!formData.product_name) {
      setHsnSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/hsn/search', { params: { q: formData.product_name } });
        const list = res?.data?.results || res?.data?.data?.results || res?.data?.data || [];
        setHsnSuggestions(Array.isArray(list) ? list : []);
      } catch (err) {
        setHsnSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.product_name]);

  useEffect(() => {
    if (!formData.hsn_code) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/hsn/lookup', { params: { hsn: formData.hsn_code } });
        const result = res?.data?.result || res?.data?.data?.result || res?.data?.data || null;
        if (result?.gst_percentage !== undefined && !gstTouched) {
          setFormData((prev) => ({
            ...prev,
            gst_percentage: result.gst_percentage
          }));
        }
      } catch (err) {
        // ignore lookup errors
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.hsn_code, gstTouched]);

  useEffect(() => {
    const fetchExtraDetails = async () => {
      if (!navigator.onLine || window.__serverOffline) return;
      const barcodes = products
        .map((item) => item?.barcode)
        .filter((barcode) => barcode && !String(barcode).startsWith('id:'));
      if (barcodes.length === 0) {
        setExtraDetailsByBarcode({});
        return;
      }
      try {
        const res = await api.post('/products/extra-details', { barcodes });
        const payload = res?.data?.products ?? res?.data ?? [];
        const list = Array.isArray(payload) ? payload : [];
        if (list.length === 0) {
          setExtraDetailsByBarcode({});
          return;
        }
        const map = list.reduce((acc, item) => {
          if (item?.barcode) {
            acc[item.barcode] = item;
          }
          return acc;
        }, {});
        setExtraDetailsByBarcode(map);
      } catch (err) {
        console.warn('[Products] Failed to fetch extra details', err);
      }
    };
    fetchExtraDetails();
  }, [products]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchProducts();
  }, [productUpdateFlag, pagination.page, pagination.limit, searchQuery, selectedCategory, sortBy, sortOrder]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setForceApiFetch(true);
    fetchProducts();
  }, [selectedBranchId]);

  const normalizeValue = (value) => String(value ?? '').toLowerCase();
  const normalizeNumericInput = (value) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const getProductKey = (product) =>
    product?.id ?? product?.product_id ?? product?.productId ?? product?.barcode;

  const getProductId = (product) =>
    product?.id ?? product?.product_id ?? product?.productId ?? null;

  const getProductStockValue = (product) => {
    const raw =
      product?.stock_quantity ??
      product?.stockQuantity ??
      product?.quantity ??
      product?.stock ??
      null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getDisplayBarcode = (barcodeValue) => {
    if (!barcodeValue) return '';
    const value = String(barcodeValue);
    return value.startsWith('id:') ? '' : value;
  };

  const mergeNonEmptyFields = (base, extra) => {
    if (!extra) return base;
    const merged = { ...base };
    Object.entries(extra).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        merged[key] = value;
      }
    });
    return merged;
  };

  const getGstKey = (product) => {
    if (product && Object.prototype.hasOwnProperty.call(product, 'gst_percent')) return 'gst_percent';
    if (product && Object.prototype.hasOwnProperty.call(product, 'gst_percentage')) return 'gst_percentage';
    if (product && Object.prototype.hasOwnProperty.call(product, 'gst')) return 'gst';
    if (product && Object.prototype.hasOwnProperty.call(product, 'gstPercent')) return 'gstPercent';
    if (product && Object.prototype.hasOwnProperty.call(product, 'gstPercentage')) return 'gstPercentage';
    return 'gst_percent';
  };

  const getProductFieldValue = (product, field) => {
    if (!product) return null;
    if (field === 'purchase_price') {
      return product.purchase_price ?? null;
    }
    if (field === 'mrp') {
      return product.mrp ?? product.mrp_price ?? null;
    }
    if (field === 'selling_price') {
      return product.selling_price ?? product.sellingPrice ?? null;
    }
    if (field === 'gst_percent') {
      return (
        product.gst_percent ??
        product.gst_percentage ??
        product.gst ??
        product.gstPercent ??
        product.gstPercentage ??
        null
      );
    }
    return product[field] ?? null;
  };

  const getDraftValue = (product, field) => {
    const key = getProductKey(product);
    if (key && editedMap[key] && Object.prototype.hasOwnProperty.call(editedMap[key], field)) {
      return editedMap[key][field];
    }
    return getProductFieldValue(product, field);
  };

  const commitEditValue = (product, field, rawValue) => {
    const key = getProductKey(product);
    if (!key) return;
    const normalized = normalizeNumericInput(rawValue);
    const original = normalizeNumericInput(getProductFieldValue(product, field));
    setEditedMap((prev) => {
      const next = { ...prev };
      const existing = next[key]
        ? { ...next[key] }
        : {
            id: product?.id ?? product?.product_id ?? product?.productId ?? null,
            barcode: product?.barcode ?? null,
            gstKey: getGstKey(product),
            source: product ?? null,
          };
      if (product) {
        existing.source = product;
      }
      if (normalized === original) {
        delete existing[field];
      } else {
        existing[field] = normalized;
      }
      const hasEdits = ['purchase_price', 'mrp', 'selling_price', 'gst_percent'].some((entry) =>
        Object.prototype.hasOwnProperty.call(existing, entry)
      );
      if (!hasEdits) {
        delete next[key];
      } else {
        next[key] = existing;
      }
      return next;
    });
  };

  const applyLocalFilters = useCallback((items) => {
    let filtered = Array.isArray(items) ? items : [];

    if (searchQuery) {
      const query = normalizeValue(searchQuery);
      filtered = filtered.filter((item) => {
        const name = normalizeValue(item.name ?? item.product_name);
        const barcode = normalizeValue(item.barcode);
        return name.includes(query) || barcode.includes(query);
      });
    }

    if (selectedCategory) {
      const categoryKey = normalizeValue(selectedCategory);
      filtered = filtered.filter((item) => {
        const categoryId = normalizeValue(item.category_id ?? item.categoryId);
        const categoryName = normalizeValue(item.category ?? item.category_name);
        return categoryId === categoryKey || categoryName === categoryKey;
      });
    }

    const sortField = sortBy;
    const direction = sortOrder === 'asc' ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const aValue = a?.[sortField];
      const bValue = b?.[sortField];
      const aNumeric = Number(aValue);
      const bNumeric = Number(bValue);
      if (!Number.isNaN(aNumeric) && !Number.isNaN(bNumeric)) {
        return (aNumeric - bNumeric) * direction;
      }
      return normalizeValue(aValue).localeCompare(normalizeValue(bValue)) * direction;
    });

    return sorted;
  }, [searchQuery, selectedCategory, sortBy, sortOrder]);

  const paginateItems = (items) => {
    const totalRecords = items.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.limit));
    const page = Math.min(Math.max(1, pagination.page), totalPages);
    const start = (page - 1) * pagination.limit;
    const paged = items.slice(start, start + pagination.limit);
    return { paged, totalRecords, totalPages, page };
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      let localAll = await getAllProducts();
      let localList = (Array.isArray(localAll) ? localAll : []).filter(
        (item) => !item?.is_deleted
      );

      if (navigator.onLine && (forceApiFetch || localList.length === 0)) {
        await runDeltaSync({ branchId: effectiveBranchId });
        localAll = await getAllProducts();
        localList = (Array.isArray(localAll) ? localAll : []).filter(
          (item) => !item?.is_deleted
        );
      }

      const localFiltered = applyLocalFilters(localList);
      const { paged, totalRecords, totalPages, page } = paginateItems(localFiltered);
      setProducts(paged);
      setPagination((prev) => ({
        ...prev,
        page,
        total_pages: totalPages,
        total_records: totalRecords,
      }));
    } catch (err) {
      if (err.response?.data?.message === 'Invalid Token' || err.response?.status === 401) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        setErrorMessage('Unable to load products. Please try again.');
      }
    } finally {
      if (forceApiFetch) {
        setForceApiFetch(false);
      }
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/orders/getcategories');
      const raw = res?.data?.categories || res?.data?.data || res?.data || [];
      const list = Array.isArray(raw) ? raw : [];
      const normalized = list.map((item) => {
        if (typeof item === 'string') {
          return { id: item, name: item };
        }
        return {
          id: item.id ?? item.category_id ?? item.value ?? item.category ?? item.name,
          name: item.name ?? item.category ?? item.label ?? item.title ?? '',
        };
      }).filter((item) => item.name);
      setCategories(normalized);
    } catch (err) {
      if (err.response?.data?.message === 'Invalid Token' || err.response?.status === 401) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        console.log("Failed to load categories", err);
      }
    }
  };

  const categoryOptions = useMemo(
    () => categories,
    [categories]
  );

  const formatDate = (value) => {
    if (!value) return '-';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatMoney = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  };

  const formatPercent = (value) => {
    const amount = Number(value);
    if (Number.isNaN(amount)) return '-';
    return `${amount}%`;
  };

  const formatBatchDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const loadProductBatches = useCallback(async (product) => {
    const productId = getProductId(product);
    if (!productId) return [];
    const productStock = getProductStockValue(product);
    const allBatches = await getAllBatches();
    const scoped = (Array.isArray(allBatches) ? allBatches : []).filter((batch) => {
      if (!batch || batch.is_deleted) return false;
      if (String(batch.product_id) !== String(productId)) return false;
      if (effectiveBranchId && batch?.branch_id && String(batch.branch_id) !== String(effectiveBranchId)) return false;
      return true;
    });
    const mergedMap = new Map();
    scoped.forEach((batch) => {
      const signature = [
        String(batch.batch_number || '').trim().toLowerCase(),
        String(batch.expiry_date || ''),
        String(batch.purchase_price ?? ''),
        String(batch.selling_price ?? ''),
        String(batch.mrp ?? ''),
      ].join('|');
      const available = Number(batch.quantity_remaining ?? batch.quantity ?? 0);
      const existing = mergedMap.get(signature);
      if (!existing) {
        mergedMap.set(signature, {
          ...batch,
          quantity_remaining: available,
          quantity: Number(batch.quantity ?? available),
        });
        return;
      }
      mergedMap.set(signature, {
        ...existing,
        quantity_remaining: Number(existing.quantity_remaining || 0) + available,
        quantity: Number(existing.quantity || 0) + Number(batch.quantity ?? available),
      });
    });
    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
    if (!Number.isFinite(productStock) || productStock < 0) {
      return merged;
    }
    let remainingCap = productStock;
    return merged
      .map((batch) => {
        const available = Number(batch.quantity_remaining ?? batch.quantity ?? 0);
        if (remainingCap <= 0) {
          return { ...batch, quantity_remaining: 0 };
        }
        const allowed = Math.min(available, remainingCap);
        remainingCap -= allowed;
        return { ...batch, quantity_remaining: allowed };
      })
      .filter((batch) => Number(batch.quantity_remaining ?? 0) > 0);
  }, [effectiveBranchId]);

  const toggleProductBatchRow = async (product) => {
    const key = getProductKey(product);
    if (!key) return;
    if (expandedProductKey === key) {
      setExpandedProductKey(null);
      return;
    }
    setExpandedProductKey(key);
    if (batchRowsByProductKey[key]) return;
    setBatchLoadingByProductKey((prev) => ({ ...prev, [key]: true }));
    try {
      const rows = await loadProductBatches(product);
      setBatchRowsByProductKey((prev) => ({ ...prev, [key]: rows }));
    } catch {
      setBatchRowsByProductKey((prev) => ({ ...prev, [key]: [] }));
      showPopup('Failed to load batch details.', 'Error');
    } finally {
      setBatchLoadingByProductKey((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleBulkSave = async () => {
    if (savingBulk) return;
    const pendingKeys = Object.keys(editedMap);
    if (!pendingKeys.length) return;
    const hydratedEntries = await Promise.all(
      pendingKeys.map(async (key) => {
        const entry = editedMap[key];
        if (!entry) return null;
        if (entry.id || !entry.barcode || String(entry.barcode).startsWith('id:')) return { key, entry };
        try {
          const cached = await getProductByBarcode(entry.barcode);
          if (cached?.id) {
            return {
              key,
              entry: {
                ...entry,
                id: cached.id,
                source: entry.source || cached,
              },
            };
          }
        } catch (err) {
          // ignore lookup failure
        }
        return { key, entry };
      })
    );

    const updates = hydratedEntries
      .map((item) => {
        if (!item?.entry) return null;
        const entry = item.entry;
        const payload = {};
        if (entry.id) payload.id = entry.id;
        if (entry.barcode && !String(entry.barcode).startsWith('id:')) {
          payload.barcode = entry.barcode;
        }
          if (Object.prototype.hasOwnProperty.call(entry, 'purchase_price')) {
            payload.purchase_price = entry.purchase_price;
          }
          if (Object.prototype.hasOwnProperty.call(entry, 'mrp')) {
            payload.mrp = entry.mrp;
          }
          if (Object.prototype.hasOwnProperty.call(entry, 'selling_price')) {
            payload.selling_price = entry.selling_price;
          }
        if (Object.prototype.hasOwnProperty.call(entry, 'gst_percent')) {
          payload.gst_percentage = entry.gst_percent;
        }
        if (!payload.id) return null;
        return Object.keys(payload).length ? payload : null;
      })
      .filter(Boolean);

    if (!updates.length) return;

    setSavingBulk(true);
    try {
      for (const update of updates) {
        await updateOfflineProduct(update);
      }
      setProducts((prev) =>
        prev.map((product) => {
          const key = getProductKey(product);
          const draft = editedMap[key];
          if (!draft) return product;
          const updated = { ...product };
            if (Object.prototype.hasOwnProperty.call(draft, 'purchase_price')) {
              updated.purchase_price = draft.purchase_price;
            }
            if (Object.prototype.hasOwnProperty.call(draft, 'mrp')) {
              updated.mrp = draft.mrp;
            }
            if (Object.prototype.hasOwnProperty.call(draft, 'selling_price')) {
              updated.selling_price = draft.selling_price;
            }
          if (Object.prototype.hasOwnProperty.call(draft, 'gst_percent')) {
            updated.gst_percentage = draft.gst_percent;
          }
          return updated;
        })
      );
      showPopup('Products saved offline. Will sync in background.', 'Offline');
      setEditedMap({});
      setForceApiFetch(true);
      setProductUpdateFlag((prev) => !prev);
    } catch (err) {
      console.error('Bulk update failed', err);
      showPopup('Failed to save product updates.', 'Error');
    } finally {
      setSavingBulk(false);
    }
  };

  const handleSyncNow = async () => {
    if (syncingInventory) return;
    setSyncingInventory(true);
    try {
      await syncAllInventory();
      setForceApiFetch(true);
      setProductUpdateFlag((prev) => !prev);
    } finally {
      setSyncingInventory(false);
    }
  };

  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getSortIndicator = (field) => {
    if (sortBy !== field) return '';
    return sortOrder === 'asc' ? '^' : 'v';
  };

  const handleOpenModal = () => {
    if (!pieceBasedEnabled && !weightBasedEnabled) {
      showPopup('Product types are disabled for this tenant.', 'Feature');
      return;
    }
    const modalElement = document.getElementById('addProductModal');
    const bootstrapModal = new Modal(modalElement);
    bootstrapModal.show();
  };

  const openDeleteModal = (product) => {
    setDeleteTarget(product);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  const handleDeleteProduct = async () => {
    const productId = deleteTarget?.id;
    if (!productId) return;
    setDeletingId(productId);
    try {
      await deleteOfflineProduct(productId);
      showPopup('Product deleted. Will sync in background.', 'Offline');
      closeDeleteModal();
      setForceApiFetch(true);
      setProductUpdateFlag((prev) => !prev);
    } catch (err) {
      showPopup('Failed to delete product', 'Error');
    } finally {
      setDeletingId(null);
    }
  };
  const openStockModal = async (product) => {
    if (!product?.id) return;
    setStockTarget(product);
    setStockModalOpen(true);
    setStockLoading(true);
    try {
      const res = await api.get('/stock', { params: { product_id: product.id } });
      const payload = res?.data?.stock || res?.data?.data || res?.data || [];
      setStockRows(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setStockRows([]);
      showPopup('Failed to load branch stock.', 'Error');
    } finally {
      setStockLoading(false);
    }
  };

  const closeStockModal = () => {
    setStockModalOpen(false);
    setStockTarget(null);
    setStockRows([]);
  };
  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setImportResult(null);
    setImportError('');
    setImportPreviewRows([]);
    setImportPreviewError('');
  };
  const normalizeImportHeader = (value) =>
    String(value || '')
      .replace(/[\uFEFF\u200B-\u200D\u2060\u00A0]/g, '')
      .trim()
      .toLowerCase();
  const IMPORT_HEADER_MAP = {
    'product name': 'name',
    product_name: 'name',
    name: 'name',
    id: 'id',
    product_id: 'id',
    'product id': 'id',
    barcode: 'barcode',
    category: 'category',
    company: 'company',
    company_name: 'company',
    brand: 'company',
    mrp: 'mrp',
    mrp_price: 'mrp',
    'selling price': 'selling_price',
    selling_price: 'selling_price',
    sellingprice: 'selling_price',
    price: 'selling_price',
    rate: 'purchase_price',
    'purchase price': 'purchase_price',
    purchase_price: 'purchase_price',
    purchaseprice: 'purchase_price',
    'Purchase Price': 'purchase_price',
    purchase_price: 'purchase_price',
    quantity: 'stock_quantity',
    qty: 'stock_quantity',
    stock: 'stock_quantity',
    stock_quantity: 'stock_quantity',
    hsn: 'hsn_code',
    hsn_code: 'hsn_code',
    gst: 'gst_percentage',
    gst_percentage: 'gst_percentage',
    gstpercent: 'gst_percentage',
    'gst %': 'gst_percentage',
    'gst%': 'gst_percentage',
    'gst rate': 'gst_percentage',
    gst_rate: 'gst_percentage',
    batch: 'batch_number',
    batch_number: 'batch_number',
    batchno: 'batch_number',
    'batch no': 'batch_number',
    expiry: 'expiry_date',
    'expiry date': 'expiry_date',
    expiry_date: 'expiry_date',
    exp: 'expiry_date',
    'exp date': 'expiry_date'
  };
  const pickValueByHeaderPattern = (row = {}, patterns = []) => {
    const keys = Object.keys(row || {});
    for (const key of keys) {
      const normalized = normalizeImportHeader(key).replace(/[^a-z0-9]/g, '');
      if (patterns.some((pattern) => normalized.includes(pattern))) {
        const value = row[key];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          return value;
        }
      }
    }
    return null;
  };

  const normalizeImportRow = (row = {}) => {
    const mapped = {};
    Object.keys(row || {}).forEach((key) => {
      const header = normalizeImportHeader(key);
      let normalized = IMPORT_HEADER_MAP[header];
      if (!normalized) {
        const compact = header.replace(/[^a-z0-9]/g, '');
        if (compact.includes('selling') && compact.includes('price')) {
          normalized = 'selling_price';
        } else if (compact.includes('sale') && compact.includes('price')) {
          normalized = 'selling_price';
        } else if (compact === 'sp' || compact === 'selling') {
          normalized = 'selling_price';
        }
      }
      if (normalized) mapped[normalized] = row[key];
    });
    // Strong fallbacks for unusual spreadsheet headers
    if (mapped.selling_price === undefined || mapped.selling_price === null || mapped.selling_price === '') {
      const sellingFromHeader = pickValueByHeaderPattern(row, [
        'sellingprice',
        'saleprice',
        'sellprice',
        'sellingrate',
      ]);
      if (sellingFromHeader !== null) {
        mapped.selling_price = sellingFromHeader;
      }
    }
    if (mapped.purchase_price === undefined || mapped.purchase_price === null || mapped.purchase_price === '') {
      const purchaseFromHeader = pickValueByHeaderPattern(row, [
        'purchaseprice',
        'buyprice',
        'costprice',
      ]);
      if (purchaseFromHeader !== null) {
        mapped.purchase_price = purchaseFromHeader;
      }
    }
    return mapped;
  };
  const toNumber = (value) => {
    if (value === null || value === undefined) return null;
    let trimmed = String(value).trim();
    if (!trimmed) return null;
    trimmed = trimmed.replace(/[^0-9.-]/g, '');
    if (!trimmed || trimmed === '-' || trimmed === '.' || trimmed === '-.') return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  };
  const resolveImportSellingPrice = (row = {}) => {
    const explicitSelling =
      toNumber(row.selling_price) ??
      toNumber(row.sellingPrice) ??
      toNumber(row.price) ??
      toNumber(row.rate);
    if (Number.isFinite(explicitSelling) && explicitSelling > 0) {
      return explicitSelling;
    }
    const mrp = toNumber(row.mrp);
    if (Number.isFinite(mrp) && mrp > 0) {
      return mrp;
    }
    const purchase = toNumber(row.purchase_price);
    if (Number.isFinite(purchase) && purchase > 0) {
      return purchase;
    }
    return null;
  };
  const toDateInput = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const parsed = XLSX.SSF?.parse_date_code
        ? XLSX.SSF.parse_date_code(value)
        : null;
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const month = String(parsed.m).padStart(2, '0');
        const day = String(parsed.d).padStart(2, '0');
        return `${parsed.y}-${month}-${day}`;
      }
      const excelEpoch = new Date(Math.round((value - 25569) * 86400 * 1000));
      if (!Number.isNaN(excelEpoch.valueOf())) {
        return excelEpoch.toISOString().slice(0, 10);
      }
    }
    const raw = String(value).trim();
    if (!raw) return '';
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString().slice(0, 10);
    }
    return raw;
  };
  const parseImportFile = async (file) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!Array.isArray(matrix) || matrix.length === 0) return [];

    const scoreHeaderRow = (row = []) => {
      const normalizedHeaders = row.map((cell) =>
        normalizeImportHeader(cell).replace(/[^a-z0-9]/g, '')
      );
      const headerHits = normalizedHeaders.filter((header) => {
        if (!header) return false;
        return (
          IMPORT_HEADER_MAP[header] ||
          header.includes('productname') ||
          header.includes('name') ||
          header.includes('sellingprice') ||
          header.includes('saleprice') ||
          header.includes('purchaseprice') ||
          header.includes('stock') ||
          header.includes('qty') ||
          header.includes('category')
        );
      }).length;
      return headerHits;
    };

    let headerRowIndex = 0;
    let bestScore = -1;
    const scanLimit = Math.min(matrix.length, 10);
    for (let i = 0; i < scanLimit; i += 1) {
      const score = scoreHeaderRow(matrix[i]);
      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = i;
      }
    }

    const rawHeaders = matrix[headerRowIndex] || [];
    const dataRows = matrix.slice(headerRowIndex + 1);
    const rawRows = dataRows
      .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim() !== ''))
      .map((row) => {
        const obj = {};
        rawHeaders.forEach((headerCell, idx) => {
          const key = String(headerCell || '').trim();
          if (!key) return;
          obj[key] = row[idx] ?? '';
        });
        return obj;
      });

    const normalized = rawRows.map(normalizeImportRow);
    const inferCategoryFromName = (nameValue) => {
      const name = String(nameValue || '').toLowerCase();
      if (!name) return '';
      const rules = [
        { category: 'Dairy', keywords: ['milk', 'cheese', 'butter', 'yogurt', 'paneer', 'curd'] },
        { category: 'Snacks', keywords: ['chips', 'namkeen', 'biscuit', 'cookie', 'snack', 'chocolate'] },
        { category: 'Beverages', keywords: ['juice', 'cola', 'soda', 'tea', 'coffee', 'drink', 'water'] },
        { category: 'Personal Care', keywords: ['soap', 'shampoo', 'toothpaste', 'deo', 'cream', 'lotion'] },
        { category: 'Household', keywords: ['detergent', 'cleaner', 'mop', 'phenyl', 'disinfectant'] },
        { category: 'Produce', keywords: ['apple', 'banana', 'tomato', 'onion', 'potato', 'vegetable', 'fruit'] },
        { category: 'Bakery', keywords: ['bread', 'bun', 'cake', 'pastry', 'rusk'] },
        { category: 'Stationery', keywords: ['pen', 'pencil', 'notebook', 'paper', 'marker'] },
        { category: 'Electronics', keywords: ['battery', 'charger', 'cable', 'earphone', 'bulb'] },
        { category: 'Pharma', keywords: ['tablet', 'capsule', 'syrup', 'ointment', 'medicine'] },
        { category: 'Baby Care', keywords: ['diaper', 'baby', 'feeding', 'wipes'] },
        { category: 'Pet Care', keywords: ['pet', 'dog', 'cat', 'litter'] },
        { category: 'Frozen', keywords: ['ice cream', 'frozen', 'ice'] },
        { category: 'Meat', keywords: ['chicken', 'mutton', 'fish', 'meat', 'egg'] }
      ];
      for (const rule of rules) {
        if (rule.keywords.some((kw) => name.includes(kw))) {
          return rule.category;
        }
      }
      return '';
    };
    const resolveFallbackCategory = () => {
      const names = Array.isArray(categoryOptions) ? categoryOptions.map((cat) => String(cat?.name || '').trim()) : [];
      const lowered = names.map((name) => name.toLowerCase());
      const preferred = ['misc', 'miscellaneous', 'others', 'other', 'general', 'uncategorized'];
      for (const label of preferred) {
        const idx = lowered.findIndex((name) => name === label);
        if (idx >= 0) return names[idx];
      }
      return '';
    };
    const fallbackCategory = resolveFallbackCategory();
    const isCategoryMissing = (value) => {
      const trimmed = String(value || '').trim().toLowerCase();
      if (!trimmed) return true;
      return ['na', 'n/a', 'none', '-', '--', 'null', 'undefined'].includes(trimmed);
    };
    const applyAutoCategories = (rows) =>
      rows.map((row) => {
        if (!isCategoryMissing(row.category)) {
          return { ...row, category: String(row.category || '').trim() };
        }
        const inferred = inferCategoryFromName(row.name);
        if (inferred) {
          return { ...row, category: inferred };
        }
        return fallbackCategory ? { ...row, category: fallbackCategory } : row;
      });
    const parsedRows = normalized
      .map((row) => {
        const id = toNumber(row.id);
        const name = String(row.name || '').trim();
        const company = row.company ? String(row.company).trim() : '';
        const categoryRaw = row.category ? String(row.category).trim() : '';
        const category = categoryRaw ? categoryRaw : '';
        const barcode = row.barcode ? String(row.barcode).trim() : '';
        const stock_quantity = toNumber(row.stock_quantity) ?? 0;
        const mrp = toNumber(row.mrp);
        const purchase_price = toNumber(row.purchase_price);
        const selling_price = resolveImportSellingPrice(row);
        const hsn_code = row.hsn_code ? String(row.hsn_code).trim() : '';
        const gst_percentage = toNumber(row.gst_percentage);
        const batch_number = row.batch_number ? String(row.batch_number).trim() : '';
        const expiry_date = toDateInput(row.expiry_date);
        return {
          id,
          name,
          company,
          category,
          barcode,
          stock_quantity,
          purchase_price,
          mrp,
          hsn_code,
          gst_percentage,
          batch_number,
          expiry_date,
          selling_price
        };
      })
      .filter((row) =>
        Object.values(row).some((value) => String(value || '').trim() !== '')
      );
    return autoCategoryEnabled ? applyAutoCategories(parsedRows) : parsedRows;
  };
  const autoFillCategories = () => {
    setImportPreviewRows((prev) => {
      if (!prev.length) return prev;
      const names = Array.isArray(categoryOptions) ? categoryOptions.map((cat) => String(cat?.name || '').trim()) : [];
      const lowered = names.map((name) => name.toLowerCase());
      const preferred = ['misc', 'miscellaneous', 'others', 'other', 'general', 'uncategorized'];
      let fallbackCategory = '';
      for (const label of preferred) {
        const idx = lowered.findIndex((name) => name === label);
        if (idx >= 0) {
          fallbackCategory = names[idx];
          break;
        }
      }
      const inferCategoryFromName = (nameValue) => {
        const name = String(nameValue || '').toLowerCase();
        if (!name) return '';
        const rules = [
          { category: 'Dairy', keywords: ['milk', 'cheese', 'butter', 'yogurt', 'paneer', 'curd'] },
          { category: 'Snacks', keywords: ['chips', 'namkeen', 'biscuit', 'cookie', 'snack', 'chocolate'] },
          { category: 'Beverages', keywords: ['juice', 'cola', 'soda', 'tea', 'coffee', 'drink', 'water'] },
          { category: 'Personal Care', keywords: ['soap', 'shampoo', 'toothpaste', 'deo', 'cream', 'lotion'] },
          { category: 'Household', keywords: ['detergent', 'cleaner', 'mop', 'phenyl', 'disinfectant'] },
          { category: 'Produce', keywords: ['apple', 'banana', 'tomato', 'onion', 'potato', 'vegetable', 'fruit'] },
          { category: 'Bakery', keywords: ['bread', 'bun', 'cake', 'pastry', 'rusk'] },
          { category: 'Stationery', keywords: ['pen', 'pencil', 'notebook', 'paper', 'marker'] },
          { category: 'Electronics', keywords: ['battery', 'charger', 'cable', 'earphone', 'bulb'] },
          { category: 'Pharma', keywords: ['tablet', 'capsule', 'syrup', 'ointment', 'medicine'] },
          { category: 'Baby Care', keywords: ['diaper', 'baby', 'feeding', 'wipes'] },
          { category: 'Pet Care', keywords: ['pet', 'dog', 'cat', 'litter'] },
          { category: 'Frozen', keywords: ['ice cream', 'frozen', 'ice'] },
          { category: 'Meat', keywords: ['chicken', 'mutton', 'fish', 'meat', 'egg'] }
        ];
        for (const rule of rules) {
          if (rule.keywords.some((kw) => name.includes(kw))) {
            return rule.category;
          }
        }
        return '';
      };
      const isCategoryMissing = (value) => {
        const trimmed = String(value || '').trim().toLowerCase();
        if (!trimmed) return true;
        return ['na', 'n/a', 'none', '-', '--', 'null', 'undefined'].includes(trimmed);
      };
      return prev.map((row) => {
        if (!isCategoryMissing(row.category)) {
          return { ...row, category: String(row.category || '').trim() };
        }
        const inferred = inferCategoryFromName(row.name);
        if (inferred) return { ...row, category: inferred };
        return fallbackCategory ? { ...row, category: fallbackCategory } : row;
      });
    });
  };
  const updatePreviewRow = (index, field, value) => {
    setImportPreviewRows((prev) =>
      prev.map((row, idx) =>
        idx === index ? { ...row, [field]: value } : row
      )
    );
  };
  const preventNumberWheel = (event) => {
    event.currentTarget.blur();
  };
  const handleImportFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setImportFile(file);
    setImportResult(null);
    setImportError('');
    setImportPreviewRows([]);
    setImportPreviewError('');
  };
  const handleImportSubmit = async () => {
    if (importing || importParsing) return;
    if (!importFile) {
      showPopup('Select a file to import.', 'Validation');
      return;
    }
    const name = importFile.name.toLowerCase();
    const allowed = ['.xlsx', '.xls', '.csv'];
    const isAllowed = allowed.some((ext) => name.endsWith(ext));
    if (!isAllowed) {
      showPopup('Only .xlsx, .xls, or .csv files are supported for preview.', 'Validation');
      return;
    }
    if (importFile.size > 25 * 1024 * 1024) {
      showPopup('File size must be 25MB or less.', 'Validation');
      return;
    }
    setImportParsing(true);
    setImportPreviewError('');
    try {
      const rows = await parseImportFile(importFile);
      if (!rows.length) {
        setImportPreviewError('No valid rows found in file.');
        return;
      }
      setImportPreviewRows(rows);
    } catch (err) {
      const message = err?.message || 'Failed to parse file.';
      setImportPreviewError(message);
      showPopup(message, 'Error');
    } finally {
      setImportParsing(false);
    }
  };
  const handleImportConfirm = async () => {
    if (importing || importPreviewRows.length === 0) return;
    if (!effectiveBranchId) {
      showPopup('Select a branch before importing products.', 'Validation');
      return;
    }
    const importConfirmed = window.confirm(
      `Please confirm branch before importing products:\n${effectiveBranchName || effectiveBranchId}\n\nProceed with this branch?`
    );
    if (!importConfirmed) return;
    const payloadRows = importPreviewRows.map((row) => ({
      id: toNumber(row.id),
      name: String(row.name || '').trim(),
      company: row.company ? String(row.company).trim() : null,
      category: row.category ? String(row.category).trim() : null,
      barcode: row.barcode ? String(row.barcode).trim() : null,
      stock_quantity: toNumber(row.stock_quantity) ?? 0,
      purchase_price: toNumber(row.purchase_price),
      mrp: toNumber(row.mrp),
      hsn_code: row.hsn_code ? String(row.hsn_code).trim() : null,
      gst_percentage: toNumber(row.gst_percentage),
      batch_number: row.batch_number ? String(row.batch_number).trim() : null,
      expiry_date: row.expiry_date ? String(row.expiry_date).trim() : null,
      selling_price: resolveImportSellingPrice(row),
      sellingPrice: resolveImportSellingPrice(row),
      sale_price: resolveImportSellingPrice(row),
      rate: resolveImportSellingPrice(row)
    }));

    const makeUuid = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    };

    setImporting(true);
    setImportError('');
    try {
      const importId = makeUuid();
      const createdAt = new Date().toISOString();
      const localProducts = await getAllProducts();
      const productsList = Array.isArray(localProducts) ? localProducts : [];
      const barcodeMap = new Map(
        productsList
          .filter((item) => item?.barcode)
          .map((item) => [String(item.barcode), item])
      );
      const nameMap = new Map(
        productsList
          .filter((item) => item?.name || item?.product_name)
          .map((item) => [String(item.name || item.product_name).toLowerCase(), item])
      );

      const items = [];
      const batchesMap = new Map();
      const productsToUpsert = new Map();

      payloadRows.forEach((row) => {
        const qty = Number(row.stock_quantity || 0);
        const name = String(row.name || '').trim();
        const barcode = row.barcode ? String(row.barcode).trim() : null;
        let existing =
          (barcode && barcodeMap.get(barcode)) ||
          (name && nameMap.get(name.toLowerCase())) ||
          null;

        if (!existing) {
          const tempId = `temp:${makeUuid()}`;
          existing = {
            id: tempId,
            name,
            product_name: name,
            barcode: barcode || `id:${tempId}`,
            company: row.company || null,
            category: row.category || null,
            hsn_code: row.hsn_code || null,
            gst_percentage: row.gst_percentage ?? null,
            selling_price: row.selling_price ?? null,
            purchase_price: row.purchase_price ?? null,
            mrp: row.mrp ?? null,
            stock_quantity: 0,
            branch_id: effectiveBranchId || null,
            is_batch_enabled: row.batch_number ? 1 : 0,
          };
        }

        const updated = {
          ...existing,
          name: name || existing.name,
          product_name: name || existing.product_name,
          company: row.company ?? existing.company ?? null,
          category: row.category ?? existing.category ?? null,
          hsn_code: row.hsn_code ?? existing.hsn_code ?? null,
          gst_percentage: row.gst_percentage ?? existing.gst_percentage ?? null,
          selling_price: row.selling_price ?? existing.selling_price ?? null,
          purchase_price: row.purchase_price ?? existing.purchase_price ?? null,
          mrp: row.mrp ?? existing.mrp ?? null,
          stock_quantity: Number(existing.stock_quantity || 0) + qty,
          branch_id: existing.branch_id ?? effectiveBranchId ?? null,
          is_batch_enabled: row.batch_number ? 1 : existing.is_batch_enabled ?? 0,
        };

        productsToUpsert.set(updated.id, updated);

        items.push({
          id: makeUuid(),
          importId,
          productId: updated.id,
          productName: updated.name || updated.product_name || name,
          qty: qty,
          costPrice: row.purchase_price ?? null,
          mrp: row.mrp ?? null,
          batchNo: row.batch_number || null,
          expiryDate: row.expiry_date || null,
          barcode: barcode || updated.barcode || null,
          company: row.company || updated.company || null,
          category: row.category || updated.category || null,
          hsnCode: row.hsn_code || updated.hsn_code || null,
          gstPercent: row.gst_percentage ?? updated.gst_percentage ?? null,
          sellingPrice: row.selling_price ?? updated.selling_price ?? null,
        });

        const batchKey = `${updated.id}::${row.batch_number || 'no-batch'}::${row.expiry_date || ''}`;
        const existingBatch = batchesMap.get(batchKey);
        const nextBatch = {
          id: existingBatch?.id || `local:import-batch:${makeUuid()}`,
          productId: updated.id,
          batchNo: row.batch_number || null,
          qty: (existingBatch?.qty || 0) + qty,
          costPrice: row.purchase_price ?? existingBatch?.costPrice ?? null,
          sellingPrice: row.selling_price ?? existingBatch?.sellingPrice ?? null,
          mrp: row.mrp ?? existingBatch?.mrp ?? null,
          expiryDate: row.expiry_date || existingBatch?.expiryDate || null,
          branchId: updated.branch_id ?? effectiveBranchId ?? null,
        };
        batchesMap.set(batchKey, nextBatch);
      });

      const importEntry = {
        id: importId,
        createdAt,
        totalItems: items.length,
        status: 'pending',
      };

      await addOfflineImport({
        importEntry,
        items,
        batches: Array.from(batchesMap.values()),
      });

      if (productsToUpsert.size > 0) {
        await updateProductsBulk(Array.from(productsToUpsert.values()));
      }

      if (batchesMap.size > 0) {
        const batchesForCache = Array.from(batchesMap.values()).map((batch) => ({
          id: batch.id,
          product_id: batch.productId,
          branch_id: batch.branchId ?? effectiveBranchId ?? null,
          batch_number: batch.batchNo || null,
          expiry_date: batch.expiryDate || null,
          purchase_price: batch.costPrice ?? null,
          selling_price: batch.sellingPrice ?? null,
          quantity: Number(batch.qty || 0),
          quantity_remaining: Number(batch.qty || 0),
          sync_version: 1,
          updated_at: createdAt,
          created_at: createdAt,
          sync_status: 'pending',
          is_deleted: false,
        }));
        await updateBatchesBulk(batchesForCache);
      }

      await addSyncQueueItem({
        type: 'import',
        refId: importId,
        payload: {
          importId,
          createdAt,
          items: items.map((item) => ({
            productId: item.productId,
            name: item.productName,
            qty: item.qty,
            costPrice: item.costPrice,
            mrp: item.mrp,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            barcode: item.barcode,
            company: item.company,
            category: item.category,
            hsnCode: item.hsnCode,
            gstPercent: item.gstPercent,
            sellingPrice: item.sellingPrice,
          })),
          branchId: effectiveBranchId || undefined,
        },
        status: 'pending',
        retryCount: 0,
      });

      setImportResult({
        total: items.length,
        inserted: items.length,
        updated: 0,
        skipped: 0,
        errors: [],
      });
      showPopup('Imported Successfully', 'Offline');
      setForceApiFetch(true);
      setProductUpdateFlag((prev) => !prev);
      loadImportHistory();
      if (navigator.onLine) {
        syncAllImports().catch(() => {});
      }
    } catch (err) {
      const message = err?.message || 'Import failed.';
      setImportError(message);
      showPopup(message, 'Error');
    } finally {
      setImporting(false);
    }
  };
  const dirtyCount = Object.keys(editedMap).length;
  const importMissingDetails = importPreviewRows
    .map((row, index) => {
      const missing = [];
      const name = String(row.name || '').trim();
      const actual = toNumber(row.purchase_price);
      if (!name) missing.push('Name');
      if (!Number.isFinite(actual) || actual <= 0) missing.push('Purchase Price');
      if (missing.length === 0) return null;
      return {
        row: index + 1,
        missing,
      };
    })
    .filter(Boolean);
  const importMissingRequired = importMissingDetails.length;
  const importMissingByRow = importMissingDetails.reduce((acc, entry) => {
    acc[entry.row] = entry.missing;
    return acc;
  }, {});
  const importDisableReason =
    importMissingRequired > 0
      ? `Please fill required fields. Missing in ${importMissingRequired} row(s).`
      : '';

  const handleRetryImport = async (importId) => {
    if (!importId) return;
    try {
      const queue = await getSyncQueueItems({ type: 'import' });
      const entry = queue.find((item) => item.refId === importId || item.importId === importId);
      if (entry) {
        await updateSyncQueueItem({
          ...entry,
          status: 'pending',
          retryCount: Number(entry.retryCount || 0),
        });
      }
      await loadImportHistory();
      if (navigator.onLine) {
        syncAllImports().catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const renderEditableCell = (product, field, formatter) => {
    const key = getProductKey(product);
    if (userDetails.role !== 'admin') {
      const readonlyValue = getDraftValue(product, field);
      return <span>{formatter ? formatter(readonlyValue) : readonlyValue ?? '-'}</span>;
    }
    if (!key) {
      const readonlyValue = getDraftValue(product, field);
      return <span>{formatter ? formatter(readonlyValue) : readonlyValue ?? '-'}</span>;
    }
    const isEditing =
      activeEdit &&
      activeEdit.key === key &&
      activeEdit.field === field;
    const value = isEditing ? activeEdit.value : getDraftValue(product, field);
    const displayValue = formatter ? formatter(value) : value ?? '-';
    if (!isEditing) {
      return (
        <button
          type="button"
          className="editable-cell"
          onClick={() =>
            setActiveEdit({
              key,
              field,
              value: value ?? '',
            })
          }
        >
          {displayValue || '-'}
        </button>
      );
    }
    return (
      <input
        className="editable-input"
        type="number"
        step="0.01"
        value={value ?? ''}
        onChange={(event) =>
          setActiveEdit((prev) =>
            prev ? { ...prev, value: event.target.value } : prev
          )
        }
        onBlur={() => {
          commitEditValue(product, field, value);
          setActiveEdit(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitEditValue(product, field, value);
            setActiveEdit(null);
          }
          if (event.key === 'Escape') {
            setActiveEdit(null);
          }
        }}
        autoFocus
      />
    );
  };
  return (
    <div className="wow-page products-page">
      <div className="wow-motion-layer" aria-hidden="true">
        <span className="wow-orb orb-a"></span>
        <span className="wow-orb orb-b"></span>
        <span className="wow-orb orb-c"></span>
        <span className="wow-orb orb-d"></span>
        <span className="wow-ring ring-a"></span>
        <span className="wow-ring ring-b"></span>
        <span className="wow-pulse"></span>
      </div>
      <div className="wow-content container-fluid pt-4">
        <div className="products-header">
          <div>
            {/* <h2 className="products-title">Products</h2> */}
            <p className="products-subtitle">Search, filter, and manage inventory.</p>
          </div>
          <div className="d-flex gap-2">
            {userDetails.role === 'admin' && (
              <button
                className="btn btn-primary"
                onClick={handleBulkSave}
                type="button"
                disabled={dirtyCount === 0 || savingBulk}
              >
                {savingBulk
                  ? 'Saving...'
                  : `Save All Changes${dirtyCount ? ` (${dirtyCount})` : ''}`}
              </button>
            )}
            <button
              className="btn btn-outline-light"
              onClick={() => {
                setForceApiFetch(true);
                setProductUpdateFlag((prev) => !prev);
                preloadAllCaches({ branchId: selectedBranchId }).catch(() => {});
              }}
              type="button"
            >
              Refresh from Server
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={handleSyncNow}
              type="button"
              disabled={syncingInventory}
            >
              {syncingInventory ? 'Syncing...' : 'Sync Now'}
            </button>
            {userDetails.role === 'admin' && (
              <button className="btn btn-outline-info" onClick={() => setImportModalOpen(true)}>
                Import Products
              </button>
            )}
            {userDetails.role === 'admin' && (
              <button className="btn btn-success" onClick={handleOpenModal}>
                Add Product
              </button>
            )}
          </div>
        </div>

        <div className="products-controls">
          <input
            className="form-control search-input"
            placeholder="Search by product name or barcode"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            className="form-select category-select"
            value={selectedCategory}
            onChange={(event) => {
              setSelectedCategory(event.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <div className="sort-controls">
            <select
              className="form-select sort-select"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value);
                setSortOrder('asc');
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <option value="created_at">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="mrp">Sort by MRP</option>
              <option value="purchase_price">Sort by Purchase Price</option>
              <option value="selling_price">Sort by Selling Price</option>
              <option value="gst_percent">Sort by GST</option>
              <option value="stock_quantity">Sort by Stock</option>
            </select>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              type="button"
            >
              {sortOrder === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>


        <div className="products-card">
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th role="button" onClick={() => handleSortToggle('name')} className="sortable">
                    Product <span className="sort-indicator">{getSortIndicator('name')}</span>
                  </th>
                  <th>Company</th>
                  <th>Barcode</th>
                    <th role="button" onClick={() => handleSortToggle('mrp')} className="sortable">
                      MRP <span className="sort-indicator">{getSortIndicator('mrp')}</span>
                    </th>
                    <th role="button" onClick={() => handleSortToggle('purchase_price')} className="sortable">
                      Purchase Price <span className="sort-indicator">{getSortIndicator('purchase_price')}</span>
                    </th>
                    <th role="button" onClick={() => handleSortToggle('selling_price')} className="sortable">
                      Selling Price <span className="sort-indicator">{getSortIndicator('selling_price')}</span>
                    </th>
                  <th role="button" onClick={() => handleSortToggle('gst_percent')} className="sortable">
                    GST % <span className="sort-indicator">{getSortIndicator('gst_percent')}</span>
                  </th>
                  <th role="button" onClick={() => handleSortToggle('stock_quantity')} className="sortable">
                    Stock <span className="sort-indicator">{getSortIndicator('stock_quantity')}</span>
                  </th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Sync</th>
                  {userDetails.role === 'admin' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="skeleton-row">
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    {userDetails.role === 'admin' && <td><span className="skeleton-block" /></td>}
                  </tr>
                ))}
                {!isLoading && errorMessage && (
                  <tr>
                    <td colSpan={userDetails.role === 'admin' ? 12 : 11} className="empty-state">
                      {errorMessage}
                    </td>
                  </tr>
                )}
                {!isLoading && !errorMessage && products.length === 0 && (
                  <tr>
                    <td colSpan={userDetails.role === 'admin' ? 12 : 11} className="empty-state">
                      No products found.
                    </td>
                  </tr>
                )}
                {!isLoading && !errorMessage && products.map((product) => {
                  const extra = extraDetailsByBarcode?.[product?.barcode] || {};
                  const displayProduct = mergeNonEmptyFields(product, extra);
                  const rowKey = getProductKey(displayProduct);
                  const isExpanded = expandedProductKey === rowKey;
                  const batchRows = batchRowsByProductKey[rowKey] || [];
                  const batchLoading = Boolean(batchLoadingByProductKey[rowKey]);
                  const rowColSpan = userDetails.role === 'admin' ? 12 : 11;
                  const stock = Number(displayProduct.stock_quantity ?? displayProduct.quantity ?? 0);
                  const minStock = Number(displayProduct.min_stock_level ?? 0);
                  const lowStock = minStock > 0 && stock <= minStock;
                  return (
                    <React.Fragment key={displayProduct.id || displayProduct.barcode}>
                    <tr
                      className={`products-row ${rowKey && editedMap[rowKey] ? 'dirty-row' : ''} ${isExpanded ? 'expanded' : ''}`}
                      onClick={(event) => {
                        if (event.target.closest('button, input, select, textarea, a, .editable-cell, .editable-input')) {
                          return;
                        }
                        toggleProductBatchRow(displayProduct);
                      }}
                      title="Click to view batch-wise details"
                    >
                      <td className="product-name-cell">
                        <span className="batch-toggle-icon">{isExpanded ? '▾' : '▸'}</span>
                        <span className="product-name-text">{displayProduct.name || displayProduct.product_name || '-'}</span>
                        {String(displayProduct.is_weight_based ?? displayProduct.isWeightBased ?? displayProduct.weight_based ?? '0') === '1' ? (
                          <span className="product-type-tag weight">Weighted</span>
                        ) : (
                          <span className="product-type-tag piece">Piece</span>
                        )}
                      </td>
                      <td>{displayProduct.company || displayProduct.company_name || '-'}</td>
                      <td>{getDisplayBarcode(displayProduct.barcode) || '-'}</td>
                      <td>{renderEditableCell(displayProduct, 'mrp', formatMoney)}</td>
                      <td>{renderEditableCell(displayProduct, 'purchase_price', formatMoney)}</td>
                      <td>{renderEditableCell(displayProduct, 'selling_price', formatMoney)}</td>
                      <td>{renderEditableCell(displayProduct, 'gst_percent', formatPercent)}</td>
                      <td>{stock}</td>
                      <td>{formatDate(displayProduct.expiry_date || displayProduct.expiryDate)}</td>
                      <td>
                        <span className={`stock-badge ${lowStock ? 'low' : 'ok'}`}>
                          {lowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const status = (displayProduct.sync_status || displayProduct.syncStatus || 'synced').toLowerCase();
                          if (status === 'pending') return '🟡 Pending';
                          if (status === 'failed') return '🔴 Failed';
                          return '🟢 Synced';
                        })()}
                      </td>
                      {userDetails.role === 'admin' && (
                        <td className="actions-cell">
                          <button className="btn btn-outline-info btn-sm" onClick={() => openStockModal(displayProduct)}>
                            Stock by Branch
                          </button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => openDeleteModal(product)}>
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr className="products-batch-row">
                        <td colSpan={rowColSpan}>
                          <div className="products-batch-panel">
                            <div className="products-batch-title">
                              Batch-wise details for {displayProduct.name || displayProduct.product_name || '-'}
                            </div>
                            <div className="products-batch-table-wrap">
                              <table className="products-batch-table">
                                <thead>
                                  <tr>
                                    <th>Batch</th>
                                    <th>Available</th>
                                    <th>Total Qty</th>
                                    <th>Purchase Price</th>
                                    <th>Selling Price</th>
                                    <th>MRP</th>
                                    <th>Expiry</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batchLoading && (
                                    <tr>
                                      <td colSpan={7} className="empty-state">Loading batch details...</td>
                                    </tr>
                                  )}
                                  {!batchLoading && batchRows.length === 0 && (
                                    <tr>
                                      <td colSpan={7} className="empty-state">No batches found for this product.</td>
                                    </tr>
                                  )}
                                  {!batchLoading && batchRows.map((batch, index) => (
                                    <tr key={`${rowKey}-batch-${batch.id || batch.batch_number || index}`}>
                                      <td>{batch.batch_number || '-'}</td>
                                      <td>{Number(batch.quantity_remaining ?? batch.quantity ?? 0)}</td>
                                      <td>{Number(batch.quantity ?? batch.quantity_remaining ?? 0)}</td>
                                      <td>{formatMoney(batch.purchase_price ?? 0)}</td>
                                      <td>{formatMoney(batch.selling_price ?? 0)}</td>
                                      <td>{formatMoney(batch.mrp ?? 0)}</td>
                                      <td>{formatBatchDate(batch.expiry_date)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="products-pagination">
            <button
              className="page-btn"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Prev
            </button>
            <div className="page-list">
              {Array.from({ length: pagination.total_pages || 1 }, (_, idx) => idx + 1).map((page) => (
                <button
                  key={`page-${page}`}
                  className={`page-btn ${page === pagination.page ? 'active' : ''}`}
                  onClick={() => setPagination((prev) => ({ ...prev, page }))}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              className="page-btn"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>

        <div className="products-card import-history-card">
          <div className="import-history-header">
            <div>
              <h4>Import History</h4>
              <p className="import-history-subtitle">Offline-first imports with sync status.</p>
            </div>
            <button
              className="btn btn-outline-primary btn-sm"
              type="button"
              onClick={() => syncAllImports().then(loadImportHistory)}
              disabled={!navigator.onLine}
            >
              Sync Now
            </button>
          </div>
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {importHistoryLoading && (
                  <tr>
                    <td colSpan={4} className="empty-state">Loading...</td>
                  </tr>
                )}
                {!importHistoryLoading && importHistory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">No imports yet.</td>
                  </tr>
                )}
                {!importHistoryLoading && importHistory.map((entry) => {
                  const status = String(entry.status || 'pending').toLowerCase();
                  return (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>{entry.totalItems || 0}</td>
                      <td>
                        {status === 'synced' && <span className="import-status synced">🟢 Synced</span>}
                        {status === 'failed' && <span className="import-status failed">🔴 Failed</span>}
                        {status !== 'synced' && status !== 'failed' && (
                          <span className="import-status pending">🟡 Pending Sync</span>
                        )}
                      </td>
                      <td>
                        {status === 'failed' && (
                          <button
                            className="btn btn-outline-warning btn-sm"
                            onClick={() => handleRetryImport(entry.id)}
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {userDetails.role === 'admin' && (
          <AddProductModalComponent
            navigate={navigate}
            setProductUpdateFlag={setProductUpdateFlag}
            modalId="addProductModal"
            title="Add Product"
            fields={productFields}
            formData={formData}
            hsnOptions={hsnSuggestions}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isSubmitting={isAddingProduct}
            onProductAdded={fetchProducts}
          />
        )}
        {deleteModalOpen && (
          <div className="delete-modal-overlay" onClick={closeDeleteModal}>
            <div className="delete-modal" onClick={(event) => event.stopPropagation()}>
              <h4>Delete product?</h4>
              <p>Are you sure you want to delete {deleteTarget?.name || deleteTarget?.product_name}?</p>
              <div className="delete-actions">
                <button className="btn btn-outline-secondary" onClick={closeDeleteModal}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleDeleteProduct} disabled={deletingId === deleteTarget?.id}>
                  {deletingId === deleteTarget?.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
        {stockModalOpen && (
          <div className="delete-modal-overlay" onClick={closeStockModal}>
            <div className="delete-modal stock-modal" onClick={(event) => event.stopPropagation()}>
              <h4>Stock by Branch</h4>
              <p className="mb-2">{stockTarget?.name || stockTarget?.product_name || '-'}</p>
              <div className="expenses-table-wrapper">
                <table className="expenses-table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th className="text-end">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockLoading && (
                      <tr>
                        <td colSpan={2} className="text-center">Loading...</td>
                      </tr>
                    )}
                    {!stockLoading && stockRows.length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-center">No stock data.</td>
                      </tr>
                    )}
                    {!stockLoading && stockRows.map((row) => (
                      <tr key={row.branch_id || row.branch}>
                        <td>{row.branch || '-'}</td>
                        <td className="text-end">{row.quantity ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="delete-actions">
                <button className="btn btn-outline-secondary" onClick={closeStockModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        {importModalOpen && (
          <div className="delete-modal-overlay" onClick={closeImportModal}>
            <div className="delete-modal import-modal" onClick={(event) => event.stopPropagation()}>
              <div className="import-modal-header">
                <h4>Import Products</h4>
                <div className="import-modal-actions">
                  <button
                    className="btn btn-primary"
                    onClick={importPreviewRows.length > 0 ? handleImportConfirm : handleImportSubmit}
                    disabled={importing || importParsing || (importPreviewRows.length > 0 && importMissingRequired > 0)}
                    title={importDisableReason}
                  >
                    {importing
                      ? 'Importing...'
                      : importPreviewRows.length > 0
                      ? 'Confirm & Import'
                      : importParsing
                      ? 'Parsing...'
                      : 'Parse & Preview'}
                  </button>
                  <button
                    className="btn btn-outline-light"
                    onClick={closeImportModal}
                    type="button"
                  >
                    Close
                  </button>
                </div>
              </div>
              <p className="mb-2">Upload Excel (.xlsx, .xls, .csv). We'll preview and let you set selling price.</p>
              <input
                type="file"
                className="form-control mb-2"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportFileChange}
              />
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="auto-category-toggle"
                  checked={autoCategoryEnabled}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setAutoCategoryEnabled(checked);
                    if (checked && importPreviewRows.length > 0) {
                      autoFillCategories();
                    }
                  }}
                />
                <label className="form-check-label" htmlFor="auto-category-toggle">
                  Auto-fill category from product name when empty
                </label>
              </div>
              {/* {importPreviewRows.length > 0 && (
                <button
                  type="button"
                  className="btn btn-outline-info btn-sm mb-2"
                  onClick={autoFillCategories}
                >
                  Re-apply Auto Categories
                </button>
              )} */}
              {importPreviewError && (
                <p className="text-danger mb-2">{importPreviewError}</p>
              )}
              {importPreviewRows.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1">
                    Rows: {importPreviewRows.length} · Missing required: {importMissingRequired}
                  </p>
                  {importMissingRequired > 0 && (
                    <div className="alert alert-warning py-2 px-3">
                      <div className="mb-1">
                        <strong>Why "Confirm & Import" is disabled:</strong>
                      </div>
                      <div className="small">
                        {importMissingDetails.slice(0, 8).map((entry) => (
                          <div key={`missing-row-${entry.row}`}>
                            Row {entry.row}: {entry.missing.join(', ')}
                          </div>
                        ))}
                        {importMissingDetails.length > 8 && (
                          <div>...and {importMissingDetails.length - 8} more row(s).</div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="expenses-table-wrapper import-preview-table">
                    <table className="expenses-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name *</th>
                          <th>Company</th>
                          <th>Category</th>
                          <th>Barcode</th>
                          <th className="text-end">Stock</th>
                          <th className="text-end">Purchase Price *</th>
                          <th className="text-end">MRP</th>
                          <th>HSN</th>
                          <th className="text-end">GST %</th>
                          <th>Batch No.</th>
                          <th>Expiry</th>
                          <th className="text-end">Selling Price</th>
                          <th>Validation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewRows.map((row, idx) => {
                          const rowMissing = importMissingByRow[idx + 1] || [];
                          const nameMissing = rowMissing.includes('Name');
                          const purchaseMissing = rowMissing.includes('Purchase Price');
                          return (
                          <tr key={`import-row-${idx}`}>
                            <td>{idx + 1}</td>
                            <td>
                              <input
                                className={`form-control form-control-sm ${nameMissing ? 'is-invalid' : ''}`}
                                value={row.name}
                                title={String(row.name ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'name', event.target.value)}
                              />
                              {nameMissing && <small className="text-danger">Name is required</small>}
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                value={row.company ?? ''}
                                title={String(row.company ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'company', event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                value={row.category}
                                title={String(row.category ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'category', event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                value={row.barcode}
                                title={String(row.barcode ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'barcode', event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm text-end"
                                type="number"
                                step="0.01"
                                value={row.stock_quantity}
                                title={String(row.stock_quantity ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'stock_quantity', event.target.value)}
                                onWheel={preventNumberWheel}
                              />
                            </td>
                            <td>
                              <input
                                className={`form-control form-control-sm text-end ${purchaseMissing ? 'is-invalid' : ''}`}
                                type="number"
                                step="0.01"
                                value={row.purchase_price ?? ''}
                                title={String(row.purchase_price ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'purchase_price', event.target.value)}
                                onWheel={preventNumberWheel}
                              />
                              {purchaseMissing && (
                                <small className="text-danger">Purchase Price must be greater than 0</small>
                              )}
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm text-end"
                                type="number"
                                step="0.01"
                                value={row.mrp ?? ''}
                                title={String(row.mrp ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'mrp', event.target.value)}
                                onWheel={preventNumberWheel}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                value={row.hsn_code}
                                title={String(row.hsn_code ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'hsn_code', event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm text-end"
                                type="number"
                                step="0.01"
                                value={row.gst_percentage ?? ''}
                                title={String(row.gst_percentage ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'gst_percentage', event.target.value)}
                                onWheel={preventNumberWheel}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                value={row.batch_number ?? ''}
                                title={String(row.batch_number ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'batch_number', event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm"
                                type="date"
                                value={row.expiry_date ?? ''}
                                title={String(row.expiry_date ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'expiry_date', event.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="form-control form-control-sm text-end"
                                type="number"
                                step="0.01"
                                value={row.selling_price ?? ''}
                                title={String(row.selling_price ?? '')}
                                onChange={(event) => updatePreviewRow(idx, 'selling_price', event.target.value)}
                                onWheel={preventNumberWheel}
                              />
                            </td>
                            <td>
                              {rowMissing.length > 0 ? (
                                <small className="text-danger">{rowMissing.join(', ')} missing</small>
                              ) : (
                                <small className="text-success">OK</small>
                              )}
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {importResult && (
                <div className="mb-2">
                  <p className="mb-1">Total: {importResult.total ?? 0}</p>
                  <p className="mb-1">Inserted: {importResult.inserted ?? 0}</p>
                  <p className="mb-1">Skipped: {importResult.skipped ?? 0}</p>
                  {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
                    <div>
                      <p className="mb-1">Errors:</p>
                      <ul>
                        {importResult.errors.slice(0, 5).map((err, index) => (
                          <li key={`import-error-${index}`}>
                            Row {err.row}: {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {importError && (
                <p className="text-danger mb-2">{importError}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;










