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
  getAllCustomers,
  getConfigValue,
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
  const planFeatures = tenantConfig?.plan_features || tenantConfig || {};
  const features = tenantConfig?.features || tenantConfig?.plan_features || tenantConfig || {};
  const barcodeEnabled = features.enable_barcode === true;
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
  const [paymentAmount, setPaymentAmount] = useState('');
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(null);

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
        const deduped = localResults
          .map((item) => ({
            ...item,
            name: item?.name ?? item?.product_name ?? item?.product ?? '-',
            company: item?.company ?? item?.company_name ?? '',
            __stock: getStockCount(item),
          }))
          .slice(0, 8);
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
      setSearchSuggestions(suggestions);
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

  const getProductBranchId = (product) =>
    product?.branch_id || product?.branchId || product?.branch || null;

  const isProductInCurrentBranch = (product) => {
    if (!effectiveBranchId) return false;
    const productBranchId = getProductBranchId(product);
    if (!productBranchId) return true;
    return productBranchId === effectiveBranchId;
  };

  const ensureBranchMatch = (product) => {
    if (!effectiveBranchId || !branchConfirmed) {
      showPopup('Select a branch before billing.', 'Validation');
      return false;
    }
    if (!isProductInCurrentBranch(product)) {
      showPopup('Product belongs to another branch.', 'Branch');
      return false;
    }
    return true;
  };

  const findProduct = async (barcode) => {
    const cached = await getProductByBarcode(barcode);
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
      const stock = getStockCount(product);
      if (stock !== null && stock <= 0) {
        showPopup('Product is out of stock', 'Stock');
        return;
      }
      addItem(product, Number.isFinite(qty) && qty > 0 ? qty : 1);
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
    if (!items.length || isSubmitting) return;
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

  const handleConfirmCheckout = async () => {
    if (!items.length || isSubmitting) return;
    const name = customerDetails.name.trim();
    const mobile = customerDetails.mobile.trim();
    const linkedCustomerId =
      customerDetails.id || (name || mobile ? await queueCustomerSync(customerDetails, name, mobile) : null);
    if (!name || !mobile) {
      showPopup('Customer name and mobile are required.', 'Validation');
      return;
    }
    if (paymentMethod === 'credit' && !customerDetails.id) {
      showPopup('Select a saved customer for credit billing.', 'Validation');
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
            onSelect={(product) => {
              if (!ensureBranchMatch(product)) {
                return;
              }
              const stock = getStockCount(product);
              if (stock !== null && stock <= 0) {
                showPopup('Product is out of stock', 'Stock');
                return;
              }
              const qty = Number(quantityValue || 1);
              addItem(product, Number.isFinite(qty) && qty > 0 ? qty : 1);
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
        <div className="billing-modal-overlay" onClick={() => setCustomerModalOpen(false)}>
          <div className="billing-modal" onClick={(event) => event.stopPropagation()}>
            <div className="billing-modal-header">
              <h5>Customer Details</h5>
            </div>
            <div className="billing-modal-body">
              <label className="form-label">Customer Name *</label>
              <input
                className="form-control"
                value={customerDetails.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomerDetails((prev) => ({ ...prev, name: value }));
                  if (customerSearchTimerRef.current) {
                    clearTimeout(customerSearchTimerRef.current);
                  }
                  customerSearchTimerRef.current = setTimeout(() => {
                    handleCustomerSearch(value);
                  }, 300);
                }}
                placeholder="Enter customer name"
              />
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
                className="form-control"
                value={customerDetails.mobile}
                onChange={(event) => setCustomerDetails((prev) => ({ ...prev, mobile: event.target.value }))}
                placeholder="Enter mobile number"
                inputMode="numeric"
              />
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
              <button className="btn btn-outline-light" type="button" onClick={() => setCustomerModalOpen(false)}>
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
