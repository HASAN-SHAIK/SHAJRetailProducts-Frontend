import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { useBillingStore } from '../../store/billingStore';
import { useWhatsappStore } from '../../store/whatsappStore';
import { useBranchStore } from '../../store/branchStore';
import {
  addSyncQueueItem,
  getAllBatches,
  getAllCustomers,
  getConfigValue,
  getProductCacheById,
  getProductByBarcode,
  saveConfigValue,
  updateProductsBulk,
  upsertCustomerLocal,
  upsertCustomersBulk,
  upsertTransaction,
  saveTransactionsBulk,
} from '../../core/db';
import { searchLocalProducts } from '../../utils/localProductSearch';
import { enqueueOfflineOrder, processOfflineQueue } from '../../utils/offlineOrders';
import { runDeltaSync } from '../../utils/deltaSync';
import { syncAllCustomers } from '../../utils/customersSync';
import CartList from '../../components/Billing/CartList';
import BarcodeInput from '../../components/Billing/BarcodeInput';
import ProductSearch from '../../components/Billing/ProductSearch';
import AddProductModalComponent from '../../components/ProductsPage/AddModalComponent/AddProductModalComponent';
import { Modal } from 'bootstrap';
import WhatsAppModal from '../../components/WhatsApp/WhatsAppModal';
import SendWhatsAppButton from '../../components/WhatsApp/SendWhatsAppButton';
import { sendBillViaWhatsApp } from '../../services/whatsappService';
import { GST_MODES, resolveGstModeFromConfig } from '../../services/gstService';
import { getTenantFeatures, hasFeature } from '../../utils/entitlements';
import '../BillingPage.css';

const DRAFT_STORAGE_KEY = 'billing_drafts_v1';

const createDraftId = () => `bill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const getNextDraftLabel = (drafts) => {
  const used = drafts
    .map((draft) => {
      const match = String(draft.label || '').match(/Bill\s+(\d+)/i);
      return match ? Number(match[1]) : 0;
    })
    .filter(Boolean);
  const nextIndex = used.length ? Math.max(...used) + 1 : drafts.length + 1;
  return `Bill ${nextIndex}`;
};

const loadDraftsFromStorage = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    return [];
  }
};

const saveDraftsToStorage = (drafts) => {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    // ignore
  }
};

const buildSearchUrl = (text, mode) => {
  if (mode === 'purchase') {
    return `/products/search/purchase?name=${encodeURIComponent(text)}`;
  }
  return `/products/search/sale?name=${encodeURIComponent(text)}`;
};

const buildBarcodeUrl = (barcode, mode) => {
  if (mode === 'purchase') {
    return `/products/barcode/purchase?barcode=${encodeURIComponent(barcode)}`;
  }
  return `/products/barcode/sale?barcode=${encodeURIComponent(barcode)}`;
};

const getStockCount = (product) => {
  const raw =
    product?.stock_quantity ??
    product?.stockQuantity ??
    product?.quantity ??
    product?.stock ??
    null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const isBatchExpired = (batch) => {
  const value = batch?.expiry_date ?? batch?.expiryDate ?? null;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const batchDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return batchDay < todayStart;
};

const isLikelyLocalBatchId = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return (
    text.startsWith('local:') ||
    text.startsWith('local_') ||
    text.startsWith('local-') ||
    text.startsWith('local_batch_') ||
    text.startsWith('temp_')
  );
};

const toDateOnlyText = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCartItemKey = (product) => {
  const batchId = product?.batch_id ?? product?.batchId ?? null;
  if (batchId !== null && batchId !== undefined && String(batchId).trim() !== '') {
    const productId =
      product?.id ??
      product?.product_id ??
      product?.productId ??
      product?.barcode ??
      null;
    if (productId !== null && productId !== undefined && String(productId).trim() !== '') {
      return `p:${String(productId)}|b:${String(batchId)}`;
    }
  }
  const base =
    product?.key ??
    product?.__key ??
    product?.id ??
    product?.product_id ??
    product?.productId ??
    product?.barcode ??
    null;
  if (base !== null && base !== undefined && String(base).trim() !== '') {
    return base;
  }
  const name = product?.name ?? product?.product_name ?? product?.product ?? null;
  if (name !== null && name !== undefined && String(name).trim() !== '') {
    return `name:${String(name).trim().toLowerCase()}`;
  }
  return null;
};

const extractProductFromResponse = (response) => {
  if (!response) return null;
  const data = response?.data;
  if (!data) return null;
  if (Array.isArray(data)) return data[0] || null;
  if (Array.isArray(data.products)) return data.products[0] || null;
  return data.product || data.data || data;
};

const RetailBilling = () => {
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const userDetails = useSelector((state) => state.user.userDetails);
  const planFeatures = getTenantFeatures(tenantConfig);
  const features = planFeatures;
  const barcodeEnabled = hasFeature(tenantConfig, 'enable_barcode');
  const weightBasedEnabled =
    features.enable_weight_based !== false && tenantConfig?.enable_weight_based !== false;
  const pieceBasedEnabled =
    features.enable_piece_based !== false && tenantConfig?.enable_piece_based !== false;
  const defaultWeightValue = weightBasedEnabled && !pieceBasedEnabled ? '1' : '0';
  const creditEnabled = tenantConfig?.enable_credit_sales === true;

  const items = useBillingStore((state) => state.items);
  const selectedKey = useBillingStore((state) => state.selectedKey);
  const isGSTEnabled = useBillingStore((state) => state.isGSTEnabled);
  const setGSTEnabled = useBillingStore((state) => state.setGSTEnabled);
  const gstMode = useBillingStore((state) => state.gstMode);
  const setGstMode = useBillingStore((state) => state.setGstMode);
  const setItems = useBillingStore((state) => state.setItems);
  const setSelectedKey = useBillingStore((state) => state.setSelectedKey);
  const addItem = useBillingStore((state) => state.addItem);
  const updateQty = useBillingStore((state) => state.updateQty);
  const updatePrice = useBillingStore((state) => state.updatePrice);
  const removeItem = useBillingStore((state) => state.removeItem);
  const selectItem = useBillingStore((state) => state.selectItem);
  const clearCart = useBillingStore((state) => state.clearCart);
  const whatsappEnabled = useWhatsappStore((state) => state.whatsappEnabled);
  const selectedOrderId = useWhatsappStore((state) => state.selectedOrderId);
  const setSelectedOrderId = useWhatsappStore((state) => state.setSelectedOrderId);
  const whatsappPhone = useWhatsappStore((state) => state.phone);
  const setWhatsappPhone = useWhatsappStore((state) => state.setPhone);
  const resetWhatsappState = useWhatsappStore((state) => state.resetWhatsappState);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const branchConfirmed = useBranchStore((state) => state.branchConfirmed);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;

  const showOnlinePopup = (message, title) => {
    showPopup(message, title);
  };

  const [barcodeValue, setBarcodeValue] = useState('');
  const [quantityValue, setQuantityValue] = useState('1');
  const [message, setMessage] = useState('');
  const [gstToast, setGstToast] = useState({ message: '', type: '', visible: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionType, setTransactionType] = useState('sale');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isPrintEnabled, setIsPrintEnabled] = useState(false);
  const [paperWidthInput, setPaperWidthInput] = useState('80');
  const [paperWidth, setPaperWidth] = useState(80);
  const [paperWidthError, setPaperWidthError] = useState('');
  const [printStatus, setPrintStatus] = useState('idle');
  const [printError, setPrintError] = useState('');
  const [discountType, setDiscountType] = useState('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isItemAdding, setIsItemAdding] = useState(false);
  const [productFormData, setProductFormData] = useState({
    product_name: '',
    company: '',
    category: '',
    hsn_code: '',
    gst_percentage: '',
    selling_price: '',
    purchase_price: '',
    mrp: '',
    expiry_date: '',
    stock_quantity: '',
    time_for_delivery: '',
    is_batch_enabled: '0',
    is_weight_based: defaultWeightValue,
    barcode: '',
  });
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({
    id: null,
    name: '',
    mobile: '',
    location: '',
    address: '',
    type: 'retail',
    credit_limit: 0,
    current_balance: 0,
  });
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [customerFieldErrors, setCustomerFieldErrors] = useState({});
  const [paymentAmount, setPaymentAmount] = useState('');
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [selectedItemBatchDetails, setSelectedItemBatchDetails] = useState([]);
  const [batchDetailsLoading, setBatchDetailsLoading] = useState(false);

  const buildCustomerPayload = (details, fallbackName, fallbackMobile) => {
    const name = String(details?.name || fallbackName || '').trim();
    const mobile = String(details?.mobile || fallbackMobile || '').trim();
    if (!name && !mobile) return null;
    const normalizedPhone = mobile.replace(/\D+/g, '');
    return {
      name,
      mobile: normalizedPhone || mobile,
      phone: normalizedPhone || mobile,
      address: details?.address?.trim() || details?.address || null,
      location: details?.location?.trim() || details?.location || null,
      type: details?.type || 'retail',
      is_active: true,
    };
  };

  const queueCustomerSync = async (details, fallbackName, fallbackMobile) => {
    const payload = buildCustomerPayload(details, fallbackName, fallbackMobile);
    if (!payload) return null;
    const existingId = details?.id || null;
    const tempId = existingId || `temp:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localCustomer = {
      id: tempId,
      ...payload,
    };
    await upsertCustomerLocal(localCustomer);
    await addSyncQueueItem({
      type: 'customer',
      action: existingId ? 'update' : 'create',
      entityId: tempId,
      payload,
    });
    return tempId;
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
    { label: 'Expiry Date', name: 'expiry_date', type: 'date', required: false },
    { label: 'Quantity', name: 'stock_quantity', type: 'number' },
    { label: 'Time For Delivery', name: 'time_for_delivery', type: 'number' },
    {
      label: 'Type',
      name: 'is_weight_based',
      type: 'select',
      options: [
        ...(pieceBasedEnabled ? [{ label: 'Piece-based', value: '0' }] : []),
        ...(weightBasedEnabled ? [{ label: 'Weight-based', value: '1' }] : []),
      ],
    },
  ];

  const barcodeRef = useRef(null);
  const gstInitRef = useRef(false);
  const gstEnabledRef = useRef(isGSTEnabled);
  const gstModeInitRef = useRef(false);
  const searchTimerRef = useRef(null);
  const latestSearchRef = useRef('');
  const customerSearchTimerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const initialDraftsRef = useRef(null);
  const draftsRef = useRef(null);

  if (!initialDraftsRef.current) {
    const stored = loadDraftsFromStorage();
    if (stored.length) {
      initialDraftsRef.current = stored;
    } else {
      initialDraftsRef.current = [
        {
          id: createDraftId(),
          label: 'Bill 1',
          items: [],
          selectedKey: null,
          isGSTEnabled: true,
          transactionType: 'sale',
          paymentMethod: 'cash',
        },
      ];
    }
  }

  const [drafts, setDrafts] = useState(initialDraftsRef.current);
  const [activeDraftId, setActiveDraftId] = useState(initialDraftsRef.current[0]?.id || null);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    return () => {
      if (customerSearchTimerRef.current) {
        clearTimeout(customerSearchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!gstInitRef.current) {
      const defaultGst =
        planFeatures?.GST_invoice_enabled ??
        planFeatures?.gst_enabled ??
        planFeatures?.enable_gst ??
        true;
      setGSTEnabled(Boolean(defaultGst));
      gstInitRef.current = true;
    }
  }, [planFeatures, setGSTEnabled]);

  useEffect(() => {
    if (!tenantConfig || gstModeInitRef.current) return;
    const modeSource =
      (userDetails && (userDetails.gst_mode || userDetails.gstMode || userDetails.gst_mode?.mode))
        ? userDetails
        : tenantConfig;
    setGstMode(resolveGstModeFromConfig(modeSource));
    gstModeInitRef.current = true;
  }, [tenantConfig, userDetails, setGstMode]);

  useEffect(() => {
    gstEnabledRef.current = isGSTEnabled;
  }, [isGSTEnabled]);

  useEffect(() => {
    let mounted = true;
    getConfigValue('billing_receipt_paper_width_mm')
      .then((value) => {
        if (!mounted) return;
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric >= 40 && numeric <= 120) {
          setPaperWidth(numeric);
          setPaperWidthInput(String(numeric));
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (barcodeRef.current) {
      barcodeRef.current.focus();
    }
  }, [activeDraftId]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.altKey && (event.key.toLowerCase() === 'g' || event.code === 'KeyG')) {
        event.preventDefault();
        const next = !gstEnabledRef.current;
        setGSTEnabled(next);
        setGstToast({
          message: next ? 'GST Enabled' : 'GST Disabled',
          type: next ? 'on' : 'off',
          visible: true,
        });
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!gstToast.visible) return;
    const timer = setTimeout(() => {
      setGstToast((prev) => ({ ...prev, visible: false }));
    }, 1600);
    return () => clearTimeout(timer);
  }, [gstToast.visible]);

  useEffect(() => {
    if (userDetails?.role !== 'admin' && transactionType !== 'sale') {
      setTransactionType('sale');
      setPaymentMethod('cash');
    }
  }, [transactionType, userDetails?.role]);

  useEffect(() => {
    const syncProducts = async () => {
      if (!navigator.onLine) return;
      try {
        await runDeltaSync({ branchId: effectiveBranchId });
      } catch (err) {
        console.warn('[Billing] Product sync failed', err);
      }
    };
    syncProducts();
  }, [effectiveBranchId]);

  useEffect(() => {
    const source = draftsRef.current || drafts;
    const active = source.find((draft) => draft.id === activeDraftId) || source[0];
    if (!active) return;
    const nextItems = active.items || [];
    const nextSelectedKey = active.selectedKey || null;
    const nextGst = Boolean(active.isGSTEnabled);
    const nextType = active.transactionType || 'sale';
    const nextPayment = active.paymentMethod || 'cash';
    setItems(nextItems);
    setSelectedKey(nextSelectedKey);
    setGSTEnabled(nextGst);
    setTransactionType(nextType);
    setPaymentMethod(nextPayment);
  }, [activeDraftId, setGSTEnabled, setItems, setSelectedKey]);

  useEffect(() => {
    setDrafts((prev) =>
      prev.map((draft) => {
        if (draft.id !== activeDraftId) return draft;
        const sameItems = draft.items === items;
        const sameSelected = draft.selectedKey === selectedKey;
        const sameGst = Boolean(draft.isGSTEnabled) === Boolean(isGSTEnabled);
        const sameType = (draft.transactionType || 'sale') === transactionType;
        const samePayment = (draft.paymentMethod || 'cash') === paymentMethod;
        if (sameItems && sameSelected && sameGst && sameType && samePayment) {
          return draft;
        }
        return {
          ...draft,
          items,
          selectedKey,
          isGSTEnabled,
          transactionType,
          paymentMethod,
        };
      })
    );
  }, [items, selectedKey, isGSTEnabled, transactionType, paymentMethod, activeDraftId]);

  useEffect(() => {
    saveDraftsToStorage(drafts);
  }, [drafts]);

  useEffect(() => {
    if (!searchText.trim()) {
      setSearchSuggestions([]);
      setSearchLoading(false);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const current = searchText;
    searchTimerRef.current = setTimeout(async () => {
      latestSearchRef.current = current;
      setSearchLoading(true);
      const localResults = await searchLocalProducts(current);
      if (localResults.length) {
        const filteredLocal = effectiveBranchId
          ? localResults.filter((item) => isProductInCurrentBranch(item))
          : localResults;
        const batchWise = await expandProductsToBatchSuggestions(filteredLocal);
        const deduped = batchWise.slice(0, 8);
        if (latestSearchRef.current !== current) return;
        setSearchSuggestions(deduped);
        setSearchLoading(false);
        return;
      }

      const map = new Map();
      let suggestions = [];
      if (navigator.onLine) {
        try {
          const response = await api.get(buildSearchUrl(current, transactionType));
          const payload = response?.data?.data ?? response?.data?.products ?? response?.data ?? [];
          const list = Array.isArray(payload) ? payload : [];
          list.forEach((item) => {
            const key = item?.barcode || item?.id || item?.product_id;
            if (!key || map.has(key)) return;
            map.set(key, {
              ...item,
              name: item?.name ?? item?.product_name ?? item?.product ?? '-',
              company: item?.company ?? item?.company_name ?? '',
              __stock: getStockCount(item),
            });
          });
          suggestions = Array.from(map.values()).slice(0, 8);
        } catch (err) {
          // ignore network search failures
        }
      }
      if (latestSearchRef.current !== current) return;
      if (effectiveBranchId) {
        suggestions = suggestions.filter((item) => isProductInCurrentBranch(item));
      }
      const batchWise = await expandProductsToBatchSuggestions(suggestions);
      setSearchSuggestions(batchWise.slice(0, 8));
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchText, transactionType, effectiveBranchId]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const base = Number(item.basePrice ?? item.base_price ?? 0);
      if (Number.isFinite(base) && base > 0) return sum + base;
      return sum + Number(item.price || 0) * Number(item.qty || 0);
    }, 0);
    const gstTotal = isGSTEnabled
      ? items.reduce((sum, item) => sum + Number(item.gstAmount ?? item.gst_amount ?? 0), 0)
      : 0;
    const rawDiscount = Number(discountValue || 0);
    const discount =
      rawDiscount > 0
        ? discountType === 'percent'
          ? (subtotal * rawDiscount) / 100
          : rawDiscount
        : 0;
    const grandTotal = subtotal + gstTotal - discount;
    return { subtotal, gstTotal, discount, grandTotal };
  }, [items, isGSTEnabled, discountType, discountValue]);

  const creditLimit = Number(customerDetails.credit_limit || 0);
  const currentBalance = Number(customerDetails.current_balance || 0);
  const availableCredit = Math.max(creditLimit - currentBalance, 0);
  const previewPaid = Number.isFinite(Number(paymentAmount)) ? Number(paymentAmount) : 0;
  const previewCreditUsed = Math.max(totals.grandTotal - previewPaid, 0);
  const creditOverLimit =
    customerDetails.id && creditLimit > 0 && currentBalance + previewCreditUsed > creditLimit;
  const selectedCartItem = useMemo(
    () => items.find((item) => String(item?.key) === String(selectedKey)) || null,
    [items, selectedKey]
  );

  const getProductBranchId = (product) =>
    product?.branch_id || product?.branchId || product?.branch || null;

  const isProductInCurrentBranch = (product) => {
    if (!effectiveBranchId) return true;
    const productBranchId = getProductBranchId(product);
    if (!productBranchId) return false;
    return String(productBranchId) === String(effectiveBranchId);
  };

  const ensureBranchMatch = (product) => {
    if (!effectiveBranchId) {
      showPopup('Select a branch before billing. Added anyway.', 'Validation');
      return true;
    }
    if (!isProductInCurrentBranch(product)) {
      showPopup('Product belongs to another branch or branch data is missing.', 'Branch');
      return false;
    }
    return true;
  };

  const getUsableProductId = (product) =>
    product?.id ?? product?.product_id ?? product?.productId ?? null;

  const getAvailableBatchesForProduct = async (product) => {
    const productId = getUsableProductId(product);
    if (!productId) return [];
    let productStock = getStockCount(product);
    if ((!Number.isFinite(productStock) || productStock < 0) && productId) {
      const cachedProduct = await getProductCacheById(productId);
      productStock = getStockCount(cachedProduct);
    }
    const allBatches = await getAllBatches();
    const filtered = (Array.isArray(allBatches) ? allBatches : [])
      .filter((batch) => {
        if (batch?.is_deleted) return false;
        if (String(batch?.product_id) !== String(productId)) return false;
        if (effectiveBranchId && batch?.branch_id && String(batch.branch_id) !== String(effectiveBranchId)) return false;
        if (isBatchExpired(batch)) return false;
        const available = Number(batch?.quantity_remaining ?? batch?.quantity ?? 0);
        return Number.isFinite(available) && available > 0;
      });

    const mergedBySignature = new Map();
    filtered.forEach((batch) => {
      const available = Number(batch?.quantity_remaining ?? batch?.quantity ?? 0);
      const signature = [
        String(batch?.product_id ?? ''),
        String(batch?.branch_id ?? ''),
        String(batch?.batch_number ?? '').trim().toLowerCase(),
        toDateOnlyText(batch?.expiry_date ?? batch?.expiryDate ?? ''),
        String(batch?.purchase_price ?? ''),
        String(batch?.selling_price ?? ''),
        String(batch?.mrp ?? ''),
      ].join('|');
      const existing = mergedBySignature.get(signature);
      if (!existing) {
        mergedBySignature.set(signature, {
          ...batch,
          quantity_remaining: available,
          quantity: Number(batch?.quantity ?? available),
        });
        return;
      }
      const existingAvail = Number(existing?.quantity_remaining ?? 0);
      const mergedAvail = existingAvail + available;
      const existingIdLocal = isLikelyLocalBatchId(existing?.id);
      const currentIdLocal = isLikelyLocalBatchId(batch?.id);
      mergedBySignature.set(signature, {
        ...existing,
        id: existingIdLocal && !currentIdLocal ? batch?.id : existing?.id,
        created_at: new Date(batch?.created_at || 0).getTime() < new Date(existing?.created_at || 0).getTime()
          ? batch?.created_at
          : existing?.created_at,
        updated_at: new Date(batch?.updated_at || 0).getTime() > new Date(existing?.updated_at || 0).getTime()
          ? batch?.updated_at
          : existing?.updated_at,
        quantity_remaining: mergedAvail,
        quantity: Math.max(Number(existing?.quantity ?? 0), mergedAvail),
      });
    });

    const merged = Array.from(mergedBySignature.values()).sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );

    if (!Number.isFinite(productStock) || productStock < 0) {
      return merged;
    }
    let remainingCap = productStock;
    const capped = [];
    for (const batch of merged) {
      if (remainingCap <= 0) break;
      const available = Number(batch?.quantity_remaining ?? batch?.quantity ?? 0);
      const allowed = Math.min(available, remainingCap);
      if (!Number.isFinite(allowed) || allowed <= 0) continue;
      capped.push({
        ...batch,
        quantity_remaining: allowed,
        quantity: Math.max(allowed, Number(batch?.quantity ?? allowed)),
      });
      remainingCap -= allowed;
    }
    return capped;
  };

  const getInCartQtyForKey = (key) =>
    key
      ? items
          .filter((item) => String(item?.key) === String(key))
          .reduce((sum, item) => sum + Number(item?.qty || 0), 0)
      : 0;

  const decorateProductWithBatch = (product, batch) => {
    const available = Number(batch?.quantity_remaining ?? batch?.quantity ?? 0);
    return {
      ...product,
      branch_id: batch?.branch_id ?? product?.branch_id ?? product?.branchId ?? null,
      batch_id: batch?.id ?? null,
      batch_number: batch?.batch_number ?? null,
      selling_price:
        batch?.selling_price ?? product?.selling_price ?? product?.sellingPrice ?? product?.price ?? 0,
      purchase_price: batch?.purchase_price ?? product?.purchase_price ?? product?.purchasePrice ?? 0,
      mrp: batch?.mrp ?? product?.mrp ?? product?.mrp_price ?? 0,
      stock_quantity: Number.isFinite(available) ? available : getStockCount(product),
      __stock: Number.isFinite(available) ? available : getStockCount(product),
    };
  };

  const resolveProductForCart = async (product, explicitBatchId = null) => {
    const batches = await getAvailableBatchesForProduct(product);
    if (!batches.length) {
      return { ...product, __stock: getStockCount(product) };
    }
    let selectedBatch = null;
    if (explicitBatchId) {
      selectedBatch = batches.find((batch) => String(batch.id) === String(explicitBatchId)) || null;
    }
    if (!selectedBatch) {
      selectedBatch = batches.find((batch) => {
        const candidate = decorateProductWithBatch(product, batch);
        const key = getCartItemKey(candidate);
        const inCartQty = getInCartQtyForKey(key);
        const available = Number(candidate.__stock || 0);
        return available - inCartQty > 0;
      }) || null;
    }
    if (!selectedBatch) return null;
    return decorateProductWithBatch(product, selectedBatch);
  };

  const expandProductsToBatchSuggestions = async (products = []) => {
    const out = [];
    for (const product of products) {
      if (!product) continue;
      const normalizedBase = {
        ...product,
        id: getUsableProductId(product),
        name: product?.name ?? product?.product_name ?? product?.product ?? '-',
        company: product?.company ?? product?.company_name ?? '',
      };
      const batches = await getAvailableBatchesForProduct(normalizedBase);
      if (!batches.length) {
        out.push({
          ...normalizedBase,
          __stock: getStockCount(normalizedBase),
        });
        continue;
      }
      batches.forEach((batch) => {
        out.push(decorateProductWithBatch(normalizedBase, batch));
      });
    }
    return out;
  };

  useEffect(() => {
    let cancelled = false;
    const loadSelectedBatchDetails = async () => {
      if (!selectedCartItem) {
        setSelectedItemBatchDetails([]);
        return;
      }
      const productId = getUsableProductId(selectedCartItem);
      if (!productId) {
        setSelectedItemBatchDetails([]);
        return;
      }
      setBatchDetailsLoading(true);
      try {
        const batches = await getAvailableBatchesForProduct(selectedCartItem);
        if (cancelled) return;
        const rows = batches.map((batch) => {
          const decorated = decorateProductWithBatch(selectedCartItem, batch);
          const key = getCartItemKey(decorated);
          const inCartQty = key
            ? items
                .filter((item) => String(item?.key) === String(key))
                .reduce((sum, item) => sum + Number(item?.qty || 0), 0)
            : 0;
          return {
            ...batch,
            key,
            inCartQty,
            available: Number(batch?.quantity_remaining ?? batch?.quantity ?? 0),
            selling_price:
              batch?.selling_price ??
              selectedCartItem?.price ??
              selectedCartItem?.selling_price ??
              0,
            purchase_price:
              batch?.purchase_price ??
              selectedCartItem?.purchase_price ??
              0,
            mrp: batch?.mrp ?? selectedCartItem?.mrp ?? 0,
          };
        });
        setSelectedItemBatchDetails(rows);
      } finally {
        if (!cancelled) {
          setBatchDetailsLoading(false);
        }
      }
    };
    loadSelectedBatchDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedCartItem, items, effectiveBranchId]);

  const handleAddSelectedBatchToCart = async (batchId) => {
    if (!selectedCartItem || !batchId) return;
    const resolvedProduct = await resolveProductForCart(selectedCartItem, batchId);
    if (!resolvedProduct) {
      showPopup('Selected batch is not available.', 'Stock');
      return;
    }
    const stock = getStockCount(resolvedProduct);
    const key = getCartItemKey(resolvedProduct);
    const inCartQty = key
      ? items
          .filter((item) => String(item?.key) === String(key))
          .reduce((sum, item) => sum + Number(item?.qty || 0), 0)
      : 0;
    if (stock !== null && inCartQty >= stock) {
      showPopup('No more stock left in this batch.', 'Stock');
      return;
    }
    addItem(resolvedProduct, 1);
    if (key) {
      selectItem(key);
    }
  };

  const findProduct = async (barcode) => {
    const cached = await getProductByBarcode(barcode, effectiveBranchId);
    if (cached) return cached;
    if (!navigator.onLine) return null;
    try {
      let product = null;
      try {
        const response = await api.get(buildBarcodeUrl(barcode, transactionType));
        const payload = response?.data ?? {};
        const list = Array.isArray(payload.products) ? payload.products : [];
        product = list[0] || payload.product || payload.data || null;
      } catch (err) {
        // fallback to generic search
      }
      if (!product) {
        try {
          const response = await api.post('/products/extra-details', { barcodes: [barcode] });
          const payload = response?.data?.products ?? response?.data ?? [];
          const list = Array.isArray(payload) ? payload : [];
          product = list[0] || null;
        } catch {
          // ignore extra-details failures
        }
      }
      if (product) {
        await updateProductsBulk([product]);
      }
      return product;
    } catch (err) {
      return null;
    }
  };

  const handleProductChange = (event) => {
    const { name, value } = event.target;
    setProductFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddProductModal = (barcode = '') => {
    if (userDetails?.role !== 'admin') {
      showOnlinePopup('Product not found. Please contact admin to add it.', 'Not Found');
      return;
    }
    setProductFormData((prev) => ({
      ...prev,
      product_name: prev.product_name || '',
      company: prev.company || '',
      category: prev.category || '',
      selling_price: prev.selling_price || '',
      purchase_price: prev.purchase_price || '',
      mrp: prev.mrp || '',
      stock_quantity: prev.stock_quantity || '',
      is_weight_based: prev.is_weight_based || defaultWeightValue,
      barcode: barcode || prev.barcode || '',
    }));
    const modalElement = document.getElementById('billingAddProductModal');
    if (modalElement) {
      const bootstrapModal = new Modal(modalElement);
      bootstrapModal.show();
    }
  };

  const handleAddProductSubmit = async (event) => {
    event.preventDefault();
    if (!pieceBasedEnabled && productFormData.is_weight_based === '0') {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }
    if (!weightBasedEnabled && productFormData.is_weight_based === '1') {
      showPopup('Weight-based products are disabled for this tenant.', 'Feature');
      return;
    }
    try {
      setIsAddingProduct(true);
      const payload = { ...productFormData };
      if (!barcodeEnabled && !payload.barcode) {
        delete payload.barcode;
      }
      if (payload.expiry_date === '') payload.expiry_date = null;
      const res = await api.post('/products', payload);
      const createdProduct = extractProductFromResponse(res);
      if (createdProduct) {
        updateProductsBulk([createdProduct]).catch(() => {});
      }
      showPopup('Product added successfully!', 'Success');
      setProductFormData({
        product_name: '',
        company: '',
        category: '',
        hsn_code: '',
        gst_percentage: '',
        selling_price: '',
        purchase_price: '',
        mrp: '',
        expiry_date: '',
        stock_quantity: '',
        time_for_delivery: '',
        is_batch_enabled: '0',
        is_weight_based: defaultWeightValue,
        barcode: '',
      });
      const modalElement = document.getElementById('billingAddProductModal');
      const modal = Modal.getInstance(modalElement);
      modal?.hide();
    } catch (err) {
      if (err?.response?.status === 401) {
        showOnlinePopup('Token Expired Please Login Again!', 'Session');
        navigate('/logout');
      } else {
        showOnlinePopup('Issue while adding product. Please try later.', 'Error');
      }
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleScan = async () => {
    const barcode = barcodeValue.trim();
    if (!barcode) return;
    if (isItemAdding) return;
    setMessage('');
    const qty = Number(quantityValue || 1);
    try {
      setIsItemAdding(true);
      const product = await findProduct(barcode);
      if (!product) {
        setMessage('Product not found');
        openAddProductModal(barcode);
        return;
      }
      if (!ensureBranchMatch(product)) {
        return;
      }
      const resolvedProduct = await resolveProductForCart(product);
      if (!resolvedProduct) {
        showPopup('No sellable batch stock available for selected branch.', 'Stock');
        return;
      }
      const stock = getStockCount(resolvedProduct);
      if (stock !== null && stock <= 0) {
        showPopup('Product is out of stock for selected branch.', 'Stock');
        return;
      }
      const key = getCartItemKey(resolvedProduct);
      const requestedQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const inCartQty = key
        ? items
            .filter((item) => String(item?.key) === String(key))
            .reduce((sum, item) => sum + Number(item?.qty || 0), 0)
        : 0;
      if (stock !== null && requestedQty + inCartQty > stock) {
        const remaining = Math.max(stock - inCartQty, 0);
        if (remaining <= 0) {
          showPopup('Insufficient stock for selected branch.', 'Stock');
          return;
        }
        addItem(resolvedProduct, remaining);
        showPopup(`Only ${remaining} can be added from available branch stock.`, 'Stock');
      } else {
        addItem(resolvedProduct, requestedQty);
      }
      setBarcodeValue('');
      setQuantityValue('1');
      if (barcodeRef.current) {
        barcodeRef.current.focus();
      }
    } finally {
      setIsItemAdding(false);
    }
  };

  const handleCheckout = async () => {
    if (!items.length || isSubmitting) {
      if (!items.length) {
        showPopup('Add at least one product before checkout.', 'Validation');
      }
      return;
    }
    if (!effectiveBranchId || !branchConfirmed) {
      showPopup('Select a branch before billing.', 'Validation');
      return;
    }
    if (!transactionType) {
      showPopup('Select transaction type', 'Validation');
      return;
    }
    if ((transactionType === 'sale' || transactionType === 'purchase') && !paymentMethod) {
      showPopup('Select payment method', 'Validation');
      return;
    }
    const totalDue = totals.grandTotal;
    if (Number.isFinite(totalDue)) {
      setPaymentAmount(totalDue.toFixed(2));
    }
    setCustomerFieldErrors({});
    setCustomerSuggestions([]);
    setLocationSuggestions([]);
    setCustomerModalOpen(true);
  };

  const handleCustomerSearch = async (text) => {
    if (text.length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    try {
      const localCustomers = await getAllCustomers();
      const query = text.toLowerCase();
      const localMatches = (localCustomers || [])
        .filter((customer) => {
          const name = String(customer?.name || '').toLowerCase();
          const mobile = String(customer?.phone || customer?.mobile || '').toLowerCase();
          return name.includes(query) || mobile.includes(query);
        })
        .slice(0, 20);
      if (localMatches.length) {
        setCustomerSuggestions(localMatches);
        return;
      }
      if (!navigator.onLine) {
        setCustomerSuggestions([]);
        return;
      }
      const response = await api.get(`/customers`, { params: { search: text, limit: 20 } });
      const results = response?.data?.data?.customers || response?.data?.customers || [];
      const list = Array.isArray(results) ? results : [];
      setCustomerSuggestions(list);
      if (list.length) {
        upsertCustomersBulk(list).catch(() => {});
      }
    } catch {
      setCustomerSuggestions([]);
    }
  };

  const handleLocationSearch = async (text) => {
    if (!text) {
      setLocationSuggestions([]);
      return;
    }
    try {
      const localCustomers = await getAllCustomers();
      const matches = (localCustomers || [])
        .map((customer) => String(customer?.location || '').trim())
        .filter((location) => location)
        .filter((location) => location.toLowerCase().includes(text.toLowerCase()));
      const unique = Array.from(new Set(matches)).slice(0, 10);
      setLocationSuggestions(unique);
    } catch {
      setLocationSuggestions([]);
    }
  };

  const handleCustomerSelect = (customer) => {
    setCustomerDetails({
      id: customer?.id || null,
      name: customer?.name || '',
      mobile: customer?.phone || customer?.mobile || customer?.customer_phone || '',
      location: customer?.location || '',
      address: customer?.address || '',
      type: customer?.type || customer?.customer_type || 'retail',
      credit_limit: Number(customer?.credit_limit ?? customer?.creditLimit ?? 0),
      current_balance: Number(customer?.current_balance ?? customer?.currentBalance ?? 0),
    });
    setCustomerSuggestions([]);
    setLocationSuggestions([]);
    setCustomerFieldErrors((prev) => {
      if (!prev.name && !prev.mobile) return prev;
      return { ...prev, name: '', mobile: '' };
    });
  };

  const handlePaperWidthChange = (value) => {
    const nextValue = String(value ?? '').trim();
    setPaperWidthInput(nextValue);
    if (!nextValue) {
      setPaperWidthError('Enter paper width in mm.');
      return;
    }
    const numeric = Number(nextValue);
    if (!Number.isFinite(numeric)) {
      setPaperWidthError('Enter a valid number.');
      return;
    }
    if (numeric < 40 || numeric > 120) {
      setPaperWidthError('Use a value between 40 and 120 mm.');
      return;
    }
    setPaperWidthError('');
    setPaperWidth(numeric);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveConfigValue('billing_receipt_paper_width_mm', numeric).catch(() => {});
    }, 400);
  };

  const handleCheckPrinter = async () => {
    const printBase = process.env.REACT_APP_PRINT_SERVICE_URL || 'http://localhost:5000';
    setPrintError('');
    setPrintStatus('checking');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${printBase}/status`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error('Local print service not reachable');
      }
      const payload = await res.json();
      setPrintStatus(payload?.connected ? 'connected' : 'not-connected');
      if (!payload?.connected) {
        setPrintError(payload?.message || 'Printer not connected');
      }
    } catch (err) {
      setPrintStatus('error');
      setPrintError(err?.name === 'AbortError' ? 'Local print service timeout' : (err?.message || 'Check failed'));
    }
  };

  const validateServerStockForCheckout = async () => {
    if (!navigator.onLine || transactionType !== 'sale' || !effectiveBranchId) {
      return { ok: true, issues: [] };
    }

    const requestedByProduct = new Map();
    items.forEach((item) => {
      const productId = item?.id ?? item?.product_id ?? item?.productId ?? null;
      const qty = Number(item?.qty ?? item?.quantity ?? 0);
      if (!productId || !Number.isFinite(qty) || qty <= 0) return;
      const key = String(productId);
      requestedByProduct.set(key, (requestedByProduct.get(key) || 0) + qty);
    });

    const productEntries = Array.from(requestedByProduct.entries());
    if (!productEntries.length) return { ok: true, issues: [] };

    const checks = await Promise.all(
      productEntries.map(async ([productId, requestedQty]) => {
        try {
          const response = await api.get('/stock', { params: { product_id: productId } });
          const list = Array.isArray(response?.data?.stock) ? response.data.stock : [];
          const branchRow = list.find((row) => String(row?.branch_id) === String(effectiveBranchId));
          const availableQty = Number(branchRow?.quantity ?? 0);
          if (!Number.isFinite(availableQty) || requestedQty > availableQty) {
            return {
              productId,
              requestedQty,
              availableQty: Number.isFinite(availableQty) ? availableQty : 0,
            };
          }
          return null;
        } catch {
          return {
            productId,
            requestedQty,
            availableQty: null,
            unknown: true,
          };
        }
      })
    );

    const issues = checks.filter(Boolean);
    return { ok: issues.length === 0, issues };
  };

  const handleConfirmCheckout = async () => {
    if (!items.length || isSubmitting) return;
    const name = customerDetails.name.trim();
    const mobile = customerDetails.mobile.trim();
    const validationErrors = {};
    if (!name) validationErrors.name = 'Customer name is required.';
    if (!mobile) validationErrors.mobile = 'Mobile number is required.';
    if (paymentMethod === 'credit' && !customerDetails.id) {
      validationErrors.name = 'Select an existing customer for credit billing.';
    }
    if (Object.keys(validationErrors).length > 0) {
      setCustomerFieldErrors(validationErrors);
      const fields = [];
      if (validationErrors.name) fields.push('Customer Name');
      if (validationErrors.mobile) fields.push('Mobile');
      showPopup(`Please fill required fields: ${fields.join(', ')}.`, 'Validation');
      return;
    }
    const linkedCustomerId =
      customerDetails.id || (name || mobile ? await queueCustomerSync(customerDetails, name, mobile) : null);
    if (paymentMethod === 'credit' && !customerDetails.id) {
      showPopup('Select a saved customer for credit billing.', 'Validation');
      return;
    }

    const stockValidation = await validateServerStockForCheckout();
    if (!stockValidation.ok) {
      const unknown = stockValidation.issues.find((issue) => issue?.unknown);
      if (unknown) {
        showPopup(
          `Unable to verify live stock for Product ID ${unknown.productId}. Please retry sync after refreshing products.`,
          'Stock'
        );
        return;
      }
      const first = stockValidation.issues[0];
      showPopup(
        `Insufficient stock for Product ID ${first.productId} in selected branch. Requested ${first.requestedQty}, available ${first.availableQty}.`,
        'Stock'
      );
      return;
    }

    setLastOrderId(null);
    setSelectedOrderId(null);
    setIsSubmitting(true);
    const now = new Date();
    const pad2 = (value) => String(value).padStart(2, '0');
    const snapshot = {
      items: items.map((item) => ({ ...item })),
      subtotal: totals.subtotal,
      gstAmount: totals.gstTotal,
      discount: totals.discount,
      total: totals.grandTotal,
      paymentMethod,
      date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
      time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      shopName: tenantConfig?.shop_name || tenantConfig?.name || 'Siddhu Industries',
    };

    const printReceipt = async (orderId) => {
      if (!isPrintEnabled) return;
      const printBase = process.env.REACT_APP_PRINT_SERVICE_URL || 'http://localhost:5000';
      try {
        setPrintError('');
        setPrintStatus('printing');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${printBase}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billNo: orderId || '',
            date: snapshot.date,
            time: snapshot.time,
            payment: snapshot.paymentMethod,
            items: snapshot.items.map((item) => ({
              name: item.name,
              qty: item.qty,
              rate: item.price,
            })),
            subtotal: snapshot.subtotal,
            gst: snapshot.gstAmount,
            discount: snapshot.discount,
            total: snapshot.total,
            shopName: snapshot.shopName,
            printConfig: {
              paperWidth,
              fontStyle: 'A',
              fontScale: 2,
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Print failed');
        }
        setPrintStatus('printed');
      } catch (err) {
        setPrintStatus('error');
        setPrintError(err?.name === 'AbortError' ? 'Print timeout' : (err?.message || 'Print failed'));
      }
    };

    try {
      const normalizedPhone = String(mobile || '').replace(/\D+/g, '');
      if (normalizedPhone) {
        setWhatsappPhone(normalizedPhone);
      }
    const totalDue = totals.grandTotal;
    const amountPaidRaw =
      (paymentAmount === '' || paymentAmount === null || paymentAmount === undefined) && paymentMethod !== 'credit'
        ? totalDue
        : Number(paymentAmount);
    const amountPaid = Number.isFinite(amountPaidRaw) ? amountPaidRaw : 0;
    if (amountPaid < 0) {
      showPopup('Amount paid must be >= 0.', 'Validation');
      setIsSubmitting(false);
      return;
    }
    const creditUsed = Math.max(totalDue - amountPaid, 0);
    if (creditUsed > 0 && !linkedCustomerId) {
      showPopup('Select a saved customer for partial/credit billing.', 'Validation');
      setIsSubmitting(false);
      return;
    }
    if (creditUsed > 0 && linkedCustomerId) {
      const creditLimit = Number(customerDetails.credit_limit || 0);
      const currentBalance = Number(customerDetails.current_balance || 0);
      if (creditLimit <= 0) {
        showPopup('Credit not allowed for this customer.', 'Validation');
        setIsSubmitting(false);
        return;
      }
      if (currentBalance + creditUsed > creditLimit) {
        showPopup('Customer credit limit exceeded.', 'Validation');
        setIsSubmitting(false);
        return;
      }
    }
    const hasPayment = Number.isFinite(amountPaid) && amountPaid > 0;
    const payments = hasPayment
      ? [
            {
              client_payment_id:
                typeof crypto !== 'undefined' && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              amount_paid: amountPaid,
              payment_mode: paymentMethod,
              created_at: new Date().toISOString(),
            },
          ]
        : [];
      const payload = {
        type: transactionType,
        transaction_type: transactionType,
        billing_type: 'retail',
        customer_id: linkedCustomerId || undefined,
        payment_method: paymentMethod,
        payment: paymentMethod,
        is_gst_enabled: isGSTEnabled,
        gst_mode: gstMode,
        discount_type: discountType,
        discount: totals.discount,
        discount_total: totals.discount,
        gst_amount: totals.gstTotal,
        branch_id: effectiveBranchId,
        customer_name: name,
        customer_phone: normalizedPhone.length === 10 ? normalizedPhone : mobile,
          customer_location: customerDetails.location?.trim() || undefined,
        customer_address: customerDetails.address?.trim() || undefined,
        total_amount: totalDue,
        payments,
        products: items.map((item) => ({
          product_id: item.id,
          batch_id: item.batch_id ?? null,
          batch_number: item.batch_number ?? null,
          barcode: item.barcode,
          quantity: item.qty,
          price: item.price,
          gst_percent: item.gstPercent,
          is_weight_based: item.is_weight_based,
        })),
      };
      const offlineEntry = await enqueueOfflineOrder({ type: 'create', payload });
      if (linkedCustomerId) {
        try {
          const nextBalance =
            Number(customerDetails.current_balance || 0) + (creditUsed > 0 ? creditUsed : 0);
          await upsertCustomersBulk([
            {
              ...customerDetails,
              id: linkedCustomerId || customerDetails.id,
              current_balance: nextBalance,
              location: customerDetails.location?.trim() || customerDetails.location || null,
              address: customerDetails.address?.trim() || customerDetails.address || null,
            },
          ]);
          if (creditUsed > 0) {
            setCustomerDetails((prev) => ({
              ...prev,
              current_balance: nextBalance,
            }));
          }
        } catch {
          // ignore local customer cache errors
        }
      }
      if (payments.length > 0) {
        const localPayment = payments[0];
        try {
          await upsertTransaction({
            id: localPayment.client_payment_id,
            client_order_id: offlineEntry?.payload?.client_order_id || null,
            total_price: localPayment.amount_paid,
            payment_mode: localPayment.payment_mode,
            created_at: localPayment.created_at,
            status: 'pending_sync',
          });
        } catch {
          // ignore local transaction cache errors
        }
      }
      // showPopup('Order saved locally. Syncing in background.', 'Success');
      clearCart();
      setCustomerModalOpen(false);
      setCustomerDetails({ id: null, name: '', mobile: '', location: '', address: '' });
      setCustomerFieldErrors({});

      const fallbackOrderId = offlineEntry?.payload?.client_order_id || null;
      if (navigator.onLine) {
        await syncAllCustomers().catch(() => {});
        const syncResult = await processOfflineQueue(api).catch(() => null);
        const clientOrderId = offlineEntry?.payload?.client_order_id || null;
        const matched = syncResult?.synced?.find((result) => result.client_order_id === clientOrderId);
        if (Array.isArray(matched?.transactions) && matched.transactions.length > 0) {
          saveTransactionsBulk(matched.transactions).catch(() => {});
        }
        const syncedOrderId = matched?.order_id || null;
        setLastOrderId(syncedOrderId);
        await printReceipt(syncedOrderId || fallbackOrderId);
        if (whatsappEnabled) {
          if (syncedOrderId) {
            setSelectedOrderId(syncedOrderId);
            const phoneReady = normalizedPhone.length === 10;
            if (!phoneReady) {
              setWhatsappModalOpen(true);
            }
          } else {
            showPopup('Order synced in background. Send WhatsApp from Orders once synced.', 'Info');
          }
        }
      } else {
        await printReceipt(fallbackOrderId);
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to place order';
      showOnlinePopup(message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppSubmit = async (phoneValue) => {
    setWhatsappPhone(phoneValue);
    setWhatsappModalOpen(false);
    if (!selectedOrderId) return;
    try {
      setWhatsappSending(true);
      await sendBillViaWhatsApp({ order_id: selectedOrderId, phone: phoneValue });
      showPopup('Bill sent via WhatsApp.', 'Success');
      resetWhatsappState();
      setLastOrderId(null);
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send WhatsApp bill';
      showOnlinePopup(message, 'Error');
    } finally {
      setWhatsappSending(false);
    }
  };

  const handleWhatsAppClick = () => {
    if (!selectedOrderId) return;
    const normalizedPhone = String(whatsappPhone || '').replace(/\D+/g, '');
    if (normalizedPhone.length === 10) {
      handleWhatsAppSubmit(normalizedPhone);
      return;
    }
    setWhatsappModalOpen(true);
  };

  const handleAddDraft = () => {
    const next = {
      id: createDraftId(),
      label: getNextDraftLabel(drafts),
      items: [],
      selectedKey: null,
      isGSTEnabled,
      transactionType: 'sale',
      paymentMethod: 'cash',
    };
    setDrafts((prev) => [...prev, next]);
    setActiveDraftId(next.id);
  };

  const handleRemoveDraft = (draftId) => {
    if (drafts.length <= 1) return;
    const nextDrafts = drafts.filter((draft) => draft.id !== draftId);
    setDrafts(nextDrafts);
    if (activeDraftId === draftId) {
      setActiveDraftId(nextDrafts[0]?.id || null);
    }
  };

  return (
    <div className="billing-page billing-page-shell">
      <div className="billing-main">
        <div className="billing-left">
          <ProductSearch
            value={searchText}
            suggestions={searchSuggestions}
            loading={searchLoading}
            onChange={setSearchText}
            onSelect={async (product) => {
              const normalizedProduct = {
                ...product,
                id:
                  product?.id ??
                  product?.product_id ??
                  product?.productId ??
                  product?.barcode ??
                  null,
              };
              if (!ensureBranchMatch(product)) {
                return;
              }
              const resolvedProduct = await resolveProductForCart(
                normalizedProduct,
                normalizedProduct?.batch_id ?? normalizedProduct?.batchId ?? null
              );
              if (!resolvedProduct) {
                showPopup('No sellable batch stock available for selected branch.', 'Stock');
                return;
              }
              const stock = getStockCount(resolvedProduct);
              if (stock !== null && stock <= 0) {
                showPopup('Product is out of stock for selected branch.', 'Stock');
                return;
              }
              const qty = Number(quantityValue || 1);
              const requestedQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
              const key = getCartItemKey(resolvedProduct);
              const inCartQty = key
                ? items
                    .filter((item) => String(item?.key) === String(key))
                    .reduce((sum, item) => sum + Number(item?.qty || 0), 0)
                : 0;
              if (stock !== null && requestedQty + inCartQty > stock) {
                const remaining = Math.max(stock - inCartQty, 0);
                if (remaining <= 0) {
                  showPopup('Insufficient stock for selected branch.', 'Stock');
                  return;
                }
                addItem(resolvedProduct, remaining);
                showPopup(`Only ${remaining} can be added from available branch stock.`, 'Stock');
              } else {
                addItem(resolvedProduct, requestedQty);
              }
              setMessage('');
              setQuantityValue('1');
              setSearchText('');
              setSearchSuggestions([]);
              if (barcodeRef.current) barcodeRef.current.focus();
            }}
          />

          <BarcodeInput
            barcodeValue={barcodeValue}
            quantityValue={quantityValue}
            onBarcodeChange={setBarcodeValue}
            onQuantityChange={setQuantityValue}
            onSubmit={handleScan}
            inputRef={barcodeRef}
            isAdding={isItemAdding}
          />
          {message && <div className="billing-message">{message}</div>}
        </div>
        <div className="billing-center">
          <div className="billing-header">
            <div>
              {/* <h2>Billing</h2>   */}
            </div>
          </div>

          <div className="billing-drafts">
            {drafts.map((draft) => (
              <div key={draft.id} className={`billing-draft ${draft.id === activeDraftId ? 'active' : ''}`}>
                <button type="button" className="billing-draft-btn" onClick={() => setActiveDraftId(draft.id)}>
                  {draft.label}
                </button>
                {drafts.length > 1 && (
                  <button
                    type="button"
                    className="billing-draft-close"
                    onClick={() => handleRemoveDraft(draft.id)}
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-light" onClick={handleAddDraft}>
              Add Bill
            </button>
          </div>

          <CartList
            items={items}
            selectedKey={selectedKey}
            isGSTEnabled={isGSTEnabled}
            onSelect={selectItem}
            onQtyChange={updateQty}
            onPriceChange={updatePrice}
            onRemove={removeItem}
          />

          {selectedCartItem && (
            <div className="billing-batch-details-panel">
              <div className="billing-batch-details-header">
                <div>
                  <strong>{selectedCartItem.name}</strong>
                  <small className="billing-stock">
                    Product ID: {selectedCartItem.id || '-'} {selectedCartItem.batch_number ? `· Current Batch: ${selectedCartItem.batch_number}` : ''}
                  </small>
                </div>
              </div>
              {batchDetailsLoading ? (
                <div className="billing-search-status">Loading batches...</div>
              ) : selectedItemBatchDetails.length === 0 ? (
                <div className="billing-search-status">No active batches found for this product.</div>
              ) : (
                <div className="billing-batch-details-table-wrap">
                  <table className="billing-batch-details-table">
                    <thead>
                      <tr>
                        <th>Batch</th>
                        <th>Available</th>
                        <th>In Cart</th>
                        <th>Selling</th>
                        <th>Actual</th>
                        <th>MRP</th>
                        <th>Expiry</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItemBatchDetails.map((batch, idx) => {
                        const isCurrent = String(selectedCartItem.batch_id || '') === String(batch.id || '');
                        return (
                          <tr key={String(batch.id || `${batch.batch_number || 'batch'}-${idx}`)}>
                            <td>{batch.batch_number || '-'}</td>
                            <td>{Number(batch.available || 0)}</td>
                            <td>{Number(batch.inCartQty || 0)}</td>
                            <td>INR {Number(batch.selling_price || 0).toFixed(2)}</td>
                            <td>INR {Number(batch.purchase_price || 0).toFixed(2)}</td>
                            <td>INR {Number(batch.mrp || 0).toFixed(2)}</td>
                            <td>{batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : '-'}</td>
                            <td>
                              <button
                                type="button"
                                className={`btn btn-sm ${isCurrent ? 'btn-outline-info' : 'btn-outline-light'}`}
                                onClick={() => handleAddSelectedBatchToCart(batch.id)}
                                disabled={Number(batch.available || 0) - Number(batch.inCartQty || 0) <= 0}
                              >
                                {isCurrent ? 'Add More' : 'Add Batch'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        <div className="billing-right">
          <div className="billing-totals">
            <div>
              <span>Subtotal</span>
              <strong>INR {totals.subtotal.toFixed(2)}</strong>
            </div>
            <div>
              <span>GST</span>
              <strong>INR {totals.gstTotal.toFixed(2)}</strong>
            </div>
            <div>
              <span>Discount</span>
              <strong>- INR {totals.discount.toFixed(2)}</strong>
            </div>
            <div className="grand-total">
              <span>Grand Total</span>
              <strong>INR {totals.grandTotal.toFixed(2)}</strong>
            </div>
          </div>

          <div className="billing-checkout-panel">
            <div className="billing-option-group">
              <span className="billing-option-title">Discount</span>
              <div className="billing-option-row">
                <label className="billing-label">
                  Type
                  <select
                    className="form-select form-select-sm"
                    value={discountType}
                    onChange={(event) => setDiscountType(event.target.value)}
                  >
                    <option value="flat">Flat</option>
                    <option value="percent">Percent</option>
                  </select>
                </label>
                <label className="billing-label">
                  Value
                  <input
                    className="form-control form-control-sm billing-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountValue}
                    onChange={(event) => setDiscountValue(event.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="billing-option-group">
              <span className="billing-option-title">Payment Method</span>
              <div className="billing-option-row">
                {['cash', 'online', ...(creditEnabled ? ['credit'] : [])].map((method) => (
                  <label key={method}>
                    <input
                      type="radio"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                    />
                    {method}
                  </label>
                ))}
              </div>
            </div>
            <div className="billing-option-group">
              <span className="billing-option-title">GST</span>
              <div className="billing-option-row">
                <label>
                  <input
                    type="checkbox"
                    checked={isGSTEnabled}
                    onChange={(event) => setGSTEnabled(event.target.checked)}
                  />
                  GST Enabled
                </label>
              </div>
              <div className="billing-option-row">
                <span className="billing-label">GST Mode</span>
                <span className="billing-static">
                  {gstMode === GST_MODES.EXCLUSIVE ? 'Exclusive' : 'Inclusive'}
                </span>
              </div>
            </div>
            <div className="billing-option-group">
              <span className="billing-option-title">Receipt Printing</span>
              <div className="billing-option-row">
                <label>
                  <input
                    type="checkbox"
                    checked={isPrintEnabled}
                    onChange={(event) => setIsPrintEnabled(event.target.checked)}
                  />
                  Print Bill
                </label>
              </div>
              {isPrintEnabled && (
                <div className="billing-print-settings">
                  <label className="billing-label">
                    Paper Width (mm)
                    <input
                      className="form-control form-control-sm billing-input"
                      type="number"
                      min="40"
                      max="120"
                      step="1"
                      value={paperWidthInput}
                      onChange={(event) => handlePaperWidthChange(event.target.value)}
                    />
                  </label>
                  {paperWidthError && <small className="text-danger">{paperWidthError}</small>}
                  <button className="btn btn-outline-secondary btn-sm" type="button" onClick={handleCheckPrinter}>
                    Check Printer
                  </button>
                  <small className="text-success d-block">Status: {printStatus}</small>
                  {printError && <div className="text-danger">{printError}</div>}
                </div>
              )}
            </div>
          </div>
          <button
            className="btn btn-success billing-checkout"
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting || items.length === 0}
          >
            {isSubmitting ? 'Processing...' : 'Checkout'}
          </button>
          {whatsappEnabled && lastOrderId && (
            <div className="mt-2">
              <SendWhatsAppButton
                onClick={handleWhatsAppClick}
                loading={whatsappSending}
                label="Send via WhatsApp"
              />
            </div>
          )}
        </div>
      </div>

      {gstToast.visible && (
        <div className={`gst-toast ${gstToast.type}`}>
          {gstToast.message}
        </div>
      )}
      {customerModalOpen && (
        <div
          className="billing-modal-overlay"
          onClick={() => {
            setCustomerModalOpen(false);
            setCustomerFieldErrors({});
          }}
        >
          <div className="billing-modal" onClick={(event) => event.stopPropagation()}>
            <div className="billing-modal-header">
              <h5>Customer Details</h5>
            </div>
            <div className="billing-modal-body">
              <label className="form-label">Customer Name *</label>
              <input
                className={`form-control ${customerFieldErrors.name ? 'billing-field-error' : ''}`}
                value={customerDetails.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomerDetails((prev) => ({ ...prev, name: value }));
                  if (value.trim()) {
                    setCustomerFieldErrors((prev) => ({ ...prev, name: '' }));
                  }
                  if (customerSearchTimerRef.current) {
                    clearTimeout(customerSearchTimerRef.current);
                  }
                  customerSearchTimerRef.current = setTimeout(() => {
                    handleCustomerSearch(value);
                  }, 300);
                }}
                placeholder="Enter customer name"
              />
              {customerFieldErrors.name ? (
                <small className="billing-field-error-text">{customerFieldErrors.name}</small>
              ) : null}
              {customerSuggestions.length > 0 && (
                <ul className="list-group mt-1">
                  {customerSuggestions.map((customer) => (
                    <li
                      key={customer?.id || customer?.mobile || customer?.phone || customer?.name}
                      className="list-group-item list-group-item-action"
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      {customer?.name || ''}
                      {customer?.mobile ? ` - ${customer.mobile}` : customer?.phone ? ` - ${customer.phone}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              <label className="form-label mt-3">Amount Paid (Partial allowed)</label>
              <input
                className="form-control"
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder="Enter paid amount"
              />
              <small className="text-secondary d-block mt-1">
                Total due: INR {totals.grandTotal.toFixed(2)}
              </small>
              {customerDetails.id && (
                <div className="mt-2">
                  <small className="text-primary d-block">
                    Balance: INR {currentBalance.toFixed(2)} · Limit: INR {creditLimit.toFixed(2)} · Available: INR {availableCredit.toFixed(2)}
                  </small>
                  {creditOverLimit && (
                    <small className="text-danger d-block">Credit limit will be exceeded.</small>
                  )}
                </div>
              )}
              <label className="form-label mt-3">Mobile *</label>
              <input
                className={`form-control ${customerFieldErrors.mobile ? 'billing-field-error' : ''}`}
                value={customerDetails.mobile}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomerDetails((prev) => ({ ...prev, mobile: value }));
                  if (value.trim()) {
                    setCustomerFieldErrors((prev) => ({ ...prev, mobile: '' }));
                  }
                }}
                placeholder="Enter mobile number"
                inputMode="numeric"
              />
              {customerFieldErrors.mobile ? (
                <small className="billing-field-error-text">{customerFieldErrors.mobile}</small>
              ) : null}
              <label className="form-label mt-3">Location (optional)</label>
              <input
                className="form-control"
                value={customerDetails.location}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomerDetails((prev) => ({ ...prev, location: value }));
                  handleLocationSearch(value);
                }}
                placeholder="Area / city"
              />
              {locationSuggestions.length > 0 && (
                <ul className="list-group mt-1">
                  {locationSuggestions.map((location) => (
                    <li
                      key={location}
                      className="list-group-item list-group-item-action"
                      onClick={() => {
                        setCustomerDetails((prev) => ({ ...prev, location }));
                        setLocationSuggestions([]);
                      }}
                    >
                      {location}
                    </li>
                  ))}
                </ul>
              )}
              <label className="form-label mt-3">Address (optional)</label>
              <textarea
                className="form-control"
                rows={2}
                value={customerDetails.address}
                onChange={(event) => setCustomerDetails((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Full address"
              />
            </div>
            <div className="billing-modal-actions">
              <button
                className="btn btn-outline-light"
                type="button"
                onClick={() => {
                  setCustomerModalOpen(false);
                  setCustomerFieldErrors({});
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={handleConfirmCheckout} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Confirm & Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}
      <WhatsAppModal
        open={whatsappModalOpen}
        initialPhone={whatsappPhone}
        onClose={() => setWhatsappModalOpen(false)}
        onSubmit={handleWhatsAppSubmit}
      />
      {userDetails?.role === 'admin' && (
        <AddProductModalComponent
          navigate={navigate}
          modalId="billingAddProductModal"
          title="Add Product"
          fields={productFields}
          formData={productFormData}
          onChange={handleProductChange}
          onSubmit={handleAddProductSubmit}
          isSubmitting={isAddingProduct}
        />
      )}
    </div>
  );
};

export default RetailBilling;
