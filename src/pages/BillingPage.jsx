import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';
import { usePopup } from '../components/common/PopUp/PopupProvider';
import { useBillingStore } from '../store/billingStore';
import { useWhatsappStore } from '../store/whatsappStore';
import { useBranchStore } from '../store/branchStore';
import { getAllCustomers, getProductByBarcode, updateProductsBulk, upsertCustomersBulk, upsertTransaction, saveTransactionsBulk } from '../core/db';
import { searchLocalProducts } from '../utils/localProductSearch';
import { searchCachedProducts } from '../utils/offlineProducts';
import { enqueueOfflineOrder, processOfflineQueue } from '../utils/offlineOrders';
import CartList from '../components/Billing/CartList';
import BarcodeInput from '../components/Billing/BarcodeInput';
import ProductSearch from '../components/Billing/ProductSearch';
import AddProductModalComponent from '../components/ProductsPage/AddModalComponent/AddProductModalComponent';
import { Modal } from 'bootstrap';
import WhatsAppModal from '../components/WhatsApp/WhatsAppModal';
import SendWhatsAppButton from '../components/WhatsApp/SendWhatsAppButton';
import { sendBillViaWhatsApp } from '../services/whatsappService';
import './BillingPage.css';

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

const BillingPage = () => {
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
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;

  const [barcodeValue, setBarcodeValue] = useState('');
  const [quantityValue, setQuantityValue] = useState('1');
  const [message, setMessage] = useState('');
  const [gstToast, setGstToast] = useState({ message: '', type: '', visible: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionType, setTransactionType] = useState('sale');
  const [paymentMethod, setPaymentMethod] = useState('cash');
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
    name: '',
    mobile: '',
    location: '',
    address: '',
  });
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(null);

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
  const searchTimerRef = useRef(null);
  const latestSearchRef = useRef('');
  const customerSearchTimerRef = useRef(null);
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
    gstEnabledRef.current = isGSTEnabled;
  }, [isGSTEnabled]);

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
        const res = await api.get('/products/cache-db');
        const payload = res?.data?.data ?? res?.data?.products ?? res?.data ?? [];
        const list = Array.isArray(payload) ? payload : [];
        if (list.length) {
          await updateProductsBulk(list);
        }
      } catch (err) {
        console.warn('[Billing] Product sync failed', err);
      }
    };
    syncProducts();
  }, []);

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
            __stock: getStockCount(item),
          }))
          .slice(0, 8);
        if (latestSearchRef.current !== current) return;
        setSearchSuggestions(deduped);
        setSearchLoading(false);
        return;
      }

      const cachedResults = searchCachedProducts(current);
      const combined = [...cachedResults];
      const map = new Map();
      combined.forEach((item) => {
        const key = item?.barcode || item?.id || item?.product_id;
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, {
            ...item,
            name: item?.name ?? item?.product_name ?? item?.product ?? '-',
            __stock: getStockCount(item),
          });
        }
      });
      let suggestions = Array.from(map.values()).slice(0, 8);
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
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const gstTotal = isGSTEnabled
      ? items.reduce((sum, item) => sum + (item.price * item.qty * item.gstPercent) / 100, 0)
      : 0;
    const grandTotal = subtotal + gstTotal;
    return { subtotal, gstTotal, grandTotal };
  }, [items, isGSTEnabled]);

  const getProductBranchId = (product) =>
    product?.branch_id || product?.branchId || product?.branch || null;

  const isProductInCurrentBranch = (product) => {
    if (!effectiveBranchId) return false;
    const productBranchId = getProductBranchId(product);
    if (!productBranchId) return true;
    return productBranchId === effectiveBranchId;
  };

  const ensureBranchMatch = (product) => {
    if (!effectiveBranchId) {
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
        const response = await api.get('/products', {
          params: { search: barcode, page: 1, limit: 1 },
        });
        const payload = response?.data ?? {};
        const list = Array.isArray(payload.products) ? payload.products : [];
        product = list[0] || payload.product || payload.data || null;
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
      showPopup('Product not found. Please contact admin to add it.', 'Not Found');
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
        showPopup('Token Expired Please Login Again!', 'Session');
        navigate('/logout');
      } else {
        showPopup('Issue while adding product. Please try later.', 'Error');
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
    if (!effectiveBranchId) {
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
          const mobile = String(customer?.mobile || '').toLowerCase();
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
      const response = await api.get(`/customers/search?name=${encodeURIComponent(text)}`);
      const results =
        response?.data?.data?.customers ||
        response?.data?.customers ||
        response?.data?.data ||
        response?.data ||
        [];
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
      name: customer?.name || '',
      mobile: customer?.mobile || customer?.phone || '',
      location: customer?.location || '',
      address: customer?.address || '',
    });
    setCustomerSuggestions([]);
    setLocationSuggestions([]);
  };

  const handleConfirmCheckout = async () => {
    if (!items.length || isSubmitting) return;
    const name = customerDetails.name.trim();
    const mobile = customerDetails.mobile.trim();
    if (!name || !mobile) {
      showPopup('Customer name and mobile are required.', 'Validation');
      return;
    }
    setLastOrderId(null);
    setSelectedOrderId(null);
    setIsSubmitting(true);
    try {
      const normalizedPhone = String(mobile || '').replace(/\D+/g, '');
      if (normalizedPhone) {
        setWhatsappPhone(normalizedPhone);
      }
      const totalDue = totals.grandTotal;
      const amountPaid = Number(paymentAmount);
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
          payment_method: paymentMethod,
          payment: paymentMethod,
          is_gst_enabled: isGSTEnabled,
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
      setCustomerDetails({ name: '', mobile: '', location: '', address: '' });
      if (navigator.onLine) {
        const syncResult = await processOfflineQueue(api).catch(() => null);
        const clientOrderId = offlineEntry?.payload?.client_order_id || null;
        const matched = syncResult?.synced?.find((result) => result.client_order_id === clientOrderId);
        if (Array.isArray(matched?.transactions) && matched.transactions.length > 0) {
          saveTransactionsBulk(matched.transactions).catch(() => {});
        }
        const syncedOrderId = matched?.order_id || null;
        setLastOrderId(syncedOrderId);
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
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to place order';
      showPopup(message, 'Error');
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
      showPopup(message, 'Error');
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
    <div className="billing-page">
      <div className="billing-main">
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

          <div className="billing-totals">
            <div>
              <span>Subtotal</span>
              <strong>INR {totals.subtotal.toFixed(2)}</strong>
            </div>
            <div>
              <span>GST</span>
              <strong>INR {totals.gstTotal.toFixed(2)}</strong>
            </div>
            <div className="grand-total">
              <span>Grand Total</span>
              <strong>INR {totals.grandTotal.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div className="billing-right">
          <div className="billing-options">
            <div className="billing-option-group">
              <span className="billing-option-title">Type</span>
              <div className="billing-option-row">
                {['sale']
                  .filter((type) => userDetails?.role === 'admin' || type === 'sale')
                  .map((type) => (
                    <label key={type}>
                      <input
                        type="radio"
                        value={type}
                        checked={transactionType === type}
                        onChange={() => setTransactionType(type)}
                      />
                      {type}
                    </label>
                  ))}
              </div>
            </div>
            <div className="billing-option-group">
              <span className="billing-option-title">Payment</span>
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
          </div>

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
              addItem(product, 1);
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
              <small className="text-muted d-block mt-1">
                Total due: INR {totals.grandTotal.toFixed(2)}
              </small>
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

export default BillingPage;
