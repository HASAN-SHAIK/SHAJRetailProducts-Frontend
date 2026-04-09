import React, { useEffect, useRef, useState } from 'react';
import api from '../utils/axios';
import { getAllCustomers, saveCustomersBulk, upsertCustomersBulk, getProductByBarcode, updateProductsBulk } from '../core/db';
import { searchLocalProducts, normalizeDisplayProduct } from '../utils/localProductSearch';
import { useNavigate } from 'react-router-dom';
import { usePopup } from '../components/common/PopUp/PopupProvider';
import { useDispatch, useSelector } from 'react-redux';
import { clearOrderDetails, setOrderDetails } from '../store/orderSlice';
import { enqueueOfflineOrder } from '../utils/offlineOrders';
import { loadCategoriesCache, saveCategoriesCache } from '../utils/offlineCategories';
import { useBranchStore } from '../store/branchStore';
import './CreateOrderPage.css';

const DRAFT_STORAGE_KEY = 'create_order_drafts_v1';

const createDraftId = () =>
  `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildEmptyDraft = (label) => ({
  id: createDraftId(),
  label,
  transactionType: 'sale',
  paymentMethod: 'cash',
  products: [],
  totalAmount: 0,
  personalAmount: '',
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  customerLocation: '',
  barcodeInput: '',
});

const sanitizeDraftForStorage = (draft) => ({
  ...draft,
  products: Array.isArray(draft.products)
    ? draft.products.map((product) => ({
        ...product,
        suggestions: [],
      }))
    : [],
});

const loadDraftsFromStorage = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((draft, index) => ({
      ...draft,
      label: draft.label || `Order ${index + 1}`,
      products: Array.isArray(draft.products) ? draft.products : [],
    }));
  } catch (err) {
    return [];
  }
};

const saveDraftsToStorage = (drafts) => {
  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify(drafts.map(sanitizeDraftForStorage))
    );
  } catch (err) {
    // ignore storage errors
  }
};

const getNextDraftLabel = (drafts) => {
  const used = drafts
    .map((draft) => {
      const match = String(draft.label || '').match(/Order\s+(\d+)/i);
      return match ? Number(match[1]) : 0;
    })
    .filter(Boolean);
  const nextIndex = used.length ? Math.max(...used) + 1 : drafts.length + 1;
  return `Order ${nextIndex}`;
};

const CreateOrderPage = () => {
  const [categories, setCategories] = useState([]);
  const [saleMethods, setSaleMethods] = useState(['sale', 'purchase', 'personal']);
  const userDetails = useSelector((state) => state.user.userDetails);
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;
  const features = tenantConfig?.features || tenantConfig?.plan_features || tenantConfig || {};
  const [transactionType, setTransactionType] = useState('sale');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [products, setProducts] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [personalAmount, setPersonalAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isBarcodeAdding, setIsBarcodeAdding] = useState(false);
  const barcodeInputRef = useRef(null);
  const [barcodeCreateOpen, setBarcodeCreateOpen] = useState(false);
  const [barcodeCreateData, setBarcodeCreateData] = useState({});
  const [isBarcodeCreating, setIsBarcodeCreating] = useState(false);
  const barcodeBufferRef = useRef('');
  const barcodeTimerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseModalData, setPurchaseModalData] = useState({});
  const [purchaseModalSuggestions, setPurchaseModalSuggestions] = useState([]);
  const purchaseModalSearchTimerRef = useRef(null);
  const latestPurchaseModalSearchRef = useRef('');
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [invoiceMargin, setInvoiceMargin] = useState(20);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceMeta, setInvoiceMeta] = useState({ supplier_id: '', invoice_number: '', payment_mode: 'cash' });
  const initialDraftStateRef = useRef(null);
  const hasPlanSyncRef = useRef(false);
  const orderDetails = useSelector((state) => state.order.orderDetails);
  const isEditing = Boolean(orderDetails);
  const planType = String(
    tenantConfig?.plan_type ||
      tenantConfig?.planType ||
      userDetails?.tenant_plan ||
      userDetails?.plan ||
      ''
  )
    .toLowerCase()
    .trim();
  const isPremiumPlan = planType.includes('premium');
  const multiDraftEnabled = !isEditing && isPremiumPlan;

  const computeProfitPerUnit = (purchasePrice, sellingPrice) => {
    const purchase = Number(purchasePrice);
    const selling = Number(sellingPrice);
    if (!Number.isFinite(purchase) || !Number.isFinite(selling)) return null;
    return Number((selling - purchase).toFixed(2));
  };
  if (!initialDraftStateRef.current) {
    const storedDrafts = loadDraftsFromStorage();
    if (storedDrafts.length) {
      initialDraftStateRef.current = {
        drafts: storedDrafts,
        activeId: storedDrafts[0].id,
      };
    } else {
      const seed = buildEmptyDraft('Order 1');
      initialDraftStateRef.current = { drafts: [seed], activeId: seed.id };
    }
  }
  const [drafts, setDrafts] = useState(initialDraftStateRef.current.drafts);
  const [activeDraftId, setActiveDraftId] = useState(
    initialDraftStateRef.current.activeId
  );
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const latestSearchRef = useRef({ sale: {}, purchase: {}, customer: '' });
  const searchTimersRef = useRef({ sale: {}, purchase: {} });
  const productSearchDelayMs = 350;
useEffect(() => {
  (async () => {
    try {
            // Remove 'personal' if not admin
      if (!orderDetails && userDetails.role !== 'admin') {
        setSaleMethods((prev) => prev.filter((method) => method !== 'personal' && method !== 'purchase'));
      }
      else if (orderDetails) {
        setSaleMethods((prev) => prev.filter((method) => method === 'sale'));
      }
      if(orderDetails){
        const reconstructedProducts = orderDetails.items.map(item => {
          const clonedItem = JSON.parse(JSON.stringify(item)); // deep clone

          return {
            ...clonedItem,
            id: clonedItem.product_id || clonedItem.id,
            suggestions: [],
            is_weight_based: clonedItem.is_weight_based ?? 0,
            purchase_price:
              clonedItem.purchase_price_snapshot ??
              clonedItem.purchase_price ??
              clonedItem.purchasePrice ??
              null,
            default_selling_price: clonedItem.selling_price ?? null,
          };
        });
        setProducts(reconstructedProducts);
        setTransactionType(orderDetails.type || 'sale');
        setTotalAmount(parseFloat(orderDetails.total_price));
        setPaymentMethod(orderDetails.payment || 'cash');
        setPersonalAmount(orderDetails.personal_amount || '');
        setCustomerName(orderDetails.customer_name || '');
        setCustomerPhone(orderDetails.customer_phone || '');
        setCustomerAddress(orderDetails.customer_address || '');
        setCustomerLocation(orderDetails.customer_location || orderDetails.location || '');
        const editDraft = {
          ...buildEmptyDraft(`Order #${orderDetails.id}`),
          transactionType: orderDetails.type || 'sale',
          paymentMethod: orderDetails.payment || 'cash',
          products: reconstructedProducts,
          totalAmount: parseFloat(orderDetails.total_price || 0),
          personalAmount: orderDetails.personal_amount || '',
          customerName: orderDetails.customer_name || '',
          customerPhone: orderDetails.customer_phone || '',
          customerAddress: orderDetails.customer_address || '',
          customerLocation: orderDetails.customer_location || orderDetails.location || '',
        };
        setDrafts([editDraft]);
        setActiveDraftId(editDraft.id);
      }
      try {
        const res = await api.get('/orders/getcategories');
        setCategories(res.data);
        const payload = res?.data?.data || res?.data || [];
        saveCategoriesCache(payload);
      } catch (err) {
        const cached = loadCategoriesCache();
        if (cached.length) {
          setCategories({ data: cached });
        } else {
          throw err;
        }
      }

      if (navigator.onLine) {
        try {
          const customersRes = await api.get('/customers', { params: { limit: 2000 } });
          const customerPayload =
            customersRes?.data?.data?.customers ||
            customersRes?.data?.customers ||
            customersRes?.data?.data ||
            customersRes?.data ||
            [];
          if (Array.isArray(customerPayload) && customerPayload.length) {
            await saveCustomersBulk(customerPayload);
          }
        } catch (err) {
          // non-blocking
        }
      }
      
    } catch (err) {
      const message = err?.response?.data?.message;
      const status = err?.response?.status || err?.status;
      if (
        navigator.onLine &&
        (message === 'Invalid Token' ||
          status == 401)
      ) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        console.error("Failed to load categories:", err);
      }
    }
  })();
}, [orderDetails, userDetails.role, navigate, showPopup]);
useEffect(() => {
  if (userDetails.role !== 'admin' && (transactionType === 'purchase' || transactionType === 'personal')) {
    setTransactionType('sale');
    setProducts([]);
    setTotalAmount(0);
    setPaymentMethod('cash');
    setPersonalAmount('');
  }
}, [transactionType, userDetails.role]);
useEffect(() => {
  if (!orderDetails) {
    dispatch(clearOrderDetails()); // Clear order details on mount when not editing
  }
}, [dispatch, orderDetails]);

  useEffect(() => {
    if (hasPlanSyncRef.current) return;
    if (!tenantConfig) return;
    hasPlanSyncRef.current = true;
    if (!isPremiumPlan || isEditing) {
      setDrafts((prev) => {
        const base = prev[0] ? { ...prev[0], label: prev[0].label || 'Order 1' } : buildEmptyDraft('Order 1');
        setActiveDraftId(base.id);
        return [base];
      });
      return;
    }
    const stored = loadDraftsFromStorage();
    if (stored.length) {
      setDrafts(stored);
      setActiveDraftId(stored[0].id);
    }
  }, [tenantConfig, isPremiumPlan, isEditing]);

  useEffect(() => {
    if (!drafts.length) return;
    const activeExists = drafts.some((draft) => draft.id === activeDraftId);
    if (!activeExists) {
      setActiveDraftId(drafts[0].id);
    }
  }, [drafts, activeDraftId]);

  useEffect(() => {
    if (!activeDraftId) return;
    const active = drafts.find((draft) => draft.id === activeDraftId);
    if (!active) return;
    const nextType = active.transactionType || 'sale';
    const nextPayment = active.paymentMethod || (nextType === 'sale' ? 'cash' : '');
    setTransactionType(nextType);
    setPaymentMethod(nextPayment);
    setProducts(Array.isArray(active.products) ? active.products : []);
    setTotalAmount(Number(active.totalAmount || 0));
    setPersonalAmount(active.personalAmount || '');
    setCustomerName(active.customerName || '');
    setCustomerPhone(active.customerPhone || '');
    setCustomerAddress(active.customerAddress || '');
    setCustomerLocation(active.customerLocation || '');
    setBarcodeInput(active.barcodeInput || '');
    setCustomerSuggestions([]);
    setPurchaseModalOpen(false);
    setPurchaseModalSuggestions([]);
    setBarcodeCreateOpen(false);
    setBarcodeCreateData({});
  }, [activeDraftId]);

  useEffect(() => {
    if (!activeDraftId) return;
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.id === activeDraftId
          ? {
              ...draft,
              transactionType,
              paymentMethod,
              products,
              totalAmount,
              personalAmount,
              customerName,
              customerPhone,
              customerAddress,
              customerLocation,
              barcodeInput,
            }
          : draft
      )
    );
  }, [
    activeDraftId,
    transactionType,
    paymentMethod,
    products,
    totalAmount,
    personalAmount,
    customerName,
    customerPhone,
    customerAddress,
    customerLocation,
    barcodeInput,
  ]);

  useEffect(() => {
    if (!multiDraftEnabled) return;
    saveDraftsToStorage(drafts);
  }, [drafts, multiDraftEnabled]);

  useEffect(() => {
    return () => {
      Object.values(searchTimersRef.current.sale).forEach((timer) => clearTimeout(timer));
      Object.values(searchTimersRef.current.purchase).forEach((timer) => clearTimeout(timer));
      if (purchaseModalSearchTimerRef.current) {
        clearTimeout(purchaseModalSearchTimerRef.current);
      }
    };
  }, []);




  const handleTransactionTypeChange = (e) => {
    const nextType = e.target.value;
    setTransactionType(nextType);
    setProducts([]);
    setTotalAmount(0);
    setPaymentMethod(nextType === 'sale' ? 'cash' : '');
    setPersonalAmount('');
  };

  const scrollToTop = () => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddDraft = () => {
    if (!multiDraftEnabled) return;
    const nextDraft = buildEmptyDraft(getNextDraftLabel(drafts));
    setDrafts((prev) => [...prev, nextDraft]);
    setActiveDraftId(nextDraft.id);
    scrollToTop();
  };

  const handleSelectDraft = (draftId) => {
    if (!draftId || draftId === activeDraftId) return;
    setActiveDraftId(draftId);
    scrollToTop();
  };

  const handleDiscardDraft = (draftId) => {
    if (!draftId) return;
    if (!multiDraftEnabled) {
      navigate('/orders');
      dispatch(clearOrderDetails());
      return;
    }
    setDrafts((prev) => {
      const remaining = prev.filter((draft) => draft.id !== draftId);
      if (remaining.length === 0) {
        const seed = buildEmptyDraft('Order 1');
        setActiveDraftId(seed.id);
        return [seed];
      }
      if (draftId === activeDraftId) {
        setActiveDraftId(remaining[0].id);
      }
      return remaining;
    });
  };

  const getDraftTotal = (draft) => {
    if (!draft) return 0;
    if (draft.transactionType === 'personal') {
      return Number(draft.personalAmount || 0);
    }
    return Number(draft.totalAmount || 0);
  };

  const requireCustomerDetails =
    features.CUSTOMER_MODULE === true ||
    tenantConfig?.CUSTOMER_MODULE === true ||
    tenantConfig?.require_customer_details === true;
  const weightBasedEnabled =
    features.enable_weight_based !== false &&
    tenantConfig?.enable_weight_based !== false;
  const pieceBasedEnabled =
    features.enable_piece_based !== false &&
    tenantConfig?.enable_piece_based !== false;
  const creditEnabled = tenantConfig?.enable_credit_sales === true;
  const barcodeEnabled = features.enable_barcode === true;

  const buildSearchUrl = (text, mode) => {
    if (mode === 'purchase') {
      return `/products/search/purchase?name=${encodeURIComponent(text)}`;
    }
    return `/products/search/sale?name=${encodeURIComponent(text)}`;
  };

  const buildBarcodeUrl = (code, mode) => {
    if (mode === 'purchase') {
      return `/products/barcode/purchase/${encodeURIComponent(code)}`;
    }
    return `/products/barcode/sale/${encodeURIComponent(code)}`;
  };

  const getDefaultPurchaseData = () => ({
      product_name: '',
      company: '',
      quantity: '',
      purchase_price: '',
      selling_price: '',
      batch_number: '',
      expiry_date: '',
      category: '',
      time_for_delivery: '',
      is_weight_based: weightBasedEnabled && !pieceBasedEnabled ? 1 : 0,
      product_id: null,
    });

  const getDefaultBarcodeCreateData = (barcode = '') => ({
    product_name: '',
    company: '',
    selling_price: '',
    purchase_price: '',
    stock_quantity: '',
    category: '',
    barcode,
    is_weight_based: 0,
    time_for_delivery: 0,
  });

  useEffect(() => {
    if (!barcodeEnabled) return;
    if (transactionType !== 'sale' && transactionType !== 'purchase') return;
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [barcodeEnabled, transactionType]);

  useEffect(() => {
    if (transactionType !== 'purchase') {
      setPurchaseModalOpen(false);
      setPurchaseModalSuggestions([]);
    }
  }, [transactionType]);

  const closeInvoiceModal = () => {
    setInvoiceModalOpen(false);
    setInvoiceFile(null);
    setInvoiceItems([]);
    setInvoiceError('');
    setInvoiceMeta({ supplier_id: '', invoice_number: '' });
  };

  const handleInvoiceFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setInvoiceFile(file);
    setInvoiceItems([]);
    setInvoiceError('');
  };

  const fetchExistingProductForInvoice = async (name) => {
    if (!name) return null;
    try {
      const response = await api.get(buildSearchUrl(name, 'purchase'));
      const results = response?.data?.products || response?.data?.data || response?.data || [];
      const list = Array.isArray(results) ? results : [];
      const match = list.find(
        (item) => String(item?.name || item?.product_name || '').trim().toLowerCase() === name.trim().toLowerCase()
      );
      return match || list[0] || null;
    } catch (err) {
      return null;
    }
  };

  const buildInvoiceRow = (raw, existing, margin) => {
    const purchase_price = Number(raw.purchase_price || 0);
    const suggested = purchase_price ? +(purchase_price * (1 + margin / 100)).toFixed(2) : null;
    const existingSelling = existing?.selling_price ?? existing?.sellingPrice ?? null;
    return {
      product_id: existing?.id ?? existing?.product_id ?? null,
      name: raw.name || '',
      hsn: raw.hsn || '',
      qty: raw.qty || '',
      purchase_price: raw.purchase_price || '',
      gst_percent: raw.gst_percent || '',
      batch_number: '',
      expiry_date: '',
      existing_selling_price: existingSelling,
      suggested_selling_price: suggested,
      selling_price: existingSelling ?? suggested ?? '',
      update_price: existingSelling ? false : true
    };
  };

  const handleInvoiceUpload = async () => {
    if (!invoiceFile || invoiceLoading) return;
    const name = invoiceFile.name.toLowerCase();
    if (!name.endsWith('.pdf')) {
      showPopup('Only PDF invoices are supported.', 'Validation');
      return;
    }
    if (invoiceFile.size > 5 * 1024 * 1024) {
      showPopup('File size must be 5MB or less.', 'Validation');
      return;
    }
    setInvoiceLoading(true);
    setInvoiceError('');
    try {
      const formData = new FormData();
      formData.append('file', invoiceFile);
      const response = await api.post('/purchase/parse-invoice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const items = response?.data?.items || response?.data?.data?.items || response?.data?.data || [];
      const list = Array.isArray(items) ? items : [];
      const enriched = await Promise.all(
        list.map(async (item) => {
          const existing = await fetchExistingProductForInvoice(item.name);
          return buildInvoiceRow(item, existing, invoiceMargin);
        })
      );
      setInvoiceItems(enriched);
      if (!enriched.length) {
        setInvoiceError('No items found in invoice.');
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to parse invoice.';
      setInvoiceError(message);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const applyMarginToAll = () => {
    setInvoiceItems((prev) =>
      prev.map((row) => {
        const purchase = Number(row.purchase_price || 0);
        const suggested = purchase ? +(purchase * (1 + invoiceMargin / 100)).toFixed(2) : '';
        return {
          ...row,
          suggested_selling_price: suggested,
          selling_price: suggested,
          update_price: true
        };
      })
    );
  };

  const handleInvoiceRowChange = (index, field, value) => {
    setInvoiceItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleInvoiceKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    const current = event.currentTarget;
    const order = Number(current.dataset.order);
    if (!Number.isFinite(order)) return;
    const next = document.querySelector(`[data-invoice-order="${order + 1}"]`);
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  const handleInvoiceSave = async (withPriceUpdate) => {
    if (invoiceSaving || invoiceItems.length === 0) return;
    const missingSelling = invoiceItems.filter((row) => !Number(row.selling_price || 0)).length;
    if (missingSelling > 0) {
      const ok = window.confirm(`Selling price missing for ${missingSelling} items. Continue?`);
      if (!ok) return;
    }
    setInvoiceSaving(true);
    try {
      const payloadItems = invoiceItems.map((row) => {
        const item = {
          product_id: row.product_id || undefined,
          name: row.name,
          hsn: row.hsn || undefined,
          qty: Number(row.qty || 0),
          purchase_price: Number(row.purchase_price || 0),
          gst_percent: Number(row.gst_percent || 0) || undefined,
          batch_number: row.batch_number || undefined,
          expiry_date: row.expiry_date || undefined
        };
        if (withPriceUpdate && row.update_price && Number(row.selling_price || 0) > 0) {
          item.selling_price = Number(row.selling_price);
        }
        return item;
      });
      await api.post('/purchase/save', {
        supplier_id: invoiceMeta.supplier_id || undefined,
        invoice_number: invoiceMeta.invoice_number || undefined,
        payment_mode: invoiceMeta.payment_mode || undefined,
        branch_id: effectiveBranchId || undefined,
        items: payloadItems
      });
      showPopup('Purchase saved successfully.', 'Success');
      closeInvoiceModal();
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to save purchase.';
      showPopup(message, 'Error');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const buildPurchasePdfPayload = () => {
    const company = {
      name: tenantConfig?.shop_name || tenantConfig?.tenant_name || 'SHAJTech',
      address: tenantConfig?.shop_address || tenantConfig?.address_line || '',
      gstin: tenantConfig?.gst_number || tenantConfig?.gstin || '',
      phone: tenantConfig?.phone || tenantConfig?.mobile || ''
    };
    const items = (products || []).map((item) => {
      const qty = Number(item.quantity || 0);
      const purchasePrice = Number(item.purchase_price || item.purchase_price || 0);
      const gst = Number(item.gst_percentage || item.gst_percent || 0);
      const total = qty * purchasePrice * (1 + gst / 100);
      return {
        name: item.product_name || item.name || '',
        hsn: item.hsn_code || item.hsn || '',
        qty,
        purchase_price: purchasePrice,
        gst_percent: gst,
        total
      };
    });
    const taxTotal = items.reduce((sum, row) => {
      const gst = Number(row.gst_percent || 0);
      const base = Number(row.qty || 0) * Number(row.purchase_price || 0);
      return sum + base * (gst / 100);
    }, 0);
    const taxes = taxTotal > 0 ? [{ label: 'GST', amount: taxTotal }] : [];
    return {
      company,
      supplier: {},
      po_number: `PO-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('en-IN'),
      items,
      taxes,
      notes: ''
    };
  };

  const handleDownloadPurchasePdf = async () => {
    if (!products.length) {
      showPopup('Add at least one product to download PDF.', 'Validation');
      return;
    }
    try {
      const response = await api.post('/purchase/generate-pdf', buildPurchasePdfPayload(), {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'purchase-order.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showPopup('Failed to generate PDF.', 'Error');
    }
  };

  const handlePaymentMethodChange = (e) => setPaymentMethod(e.target.value);

  const handleCustomerSearch = async (text) => {
    latestSearchRef.current.customer = text;
    if (text.length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    try {
      const localCustomers = await getAllCustomers();
      const localMatches = (localCustomers || [])
        .filter((customer) => {
          const name = String(customer?.name || '').toLowerCase();
          const mobile = String(customer?.mobile || '').toLowerCase();
          const query = text.toLowerCase();
          return name.includes(query) || mobile.includes(query);
        })
        .slice(0, 20);
      if (localMatches.length) {
        if (latestSearchRef.current.customer !== text) return;
        setCustomerSuggestions(localMatches);
      } else if (navigator.onLine) {
        const response = await api.get(
          `/customers/search?name=${encodeURIComponent(text)}`
        );
        const results =
          response?.data?.data?.customers ||
          response?.data?.customers ||
          response?.data?.data ||
          response?.data ||
          [];
        if (latestSearchRef.current.customer !== text) return;
        const list = Array.isArray(results) ? results : [];
        setCustomerSuggestions(list);
        if (list.length) {
          upsertCustomersBulk(list).catch(() => {});
        }
      } else {
        setCustomerSuggestions([]);
      }
    } catch (err) {
      if (latestSearchRef.current.customer !== text) return;
      setCustomerSuggestions([]);
      if (navigator.onLine) {
        if (
          (err.response?.data && err.response.data.message === 'Invalid Token') ||
          err.response?.status === 401 ||
          err.response?.status === 401
        ) {
          showPopup('Token Expired Please Login Again!', 'Session');
          navigate('/logout');
        } else {
          console.log(err);
        }
      }
    }
  };

  const handleCustomerSelect = (customer) => {
    setCustomerName(customer?.name || '');
    setCustomerPhone(customer?.mobile || customer?.phone || '');
    setCustomerAddress(customer?.address || '');
    setCustomerLocation(customer?.location || '');
    setCustomerSuggestions([]);
    setLocationSuggestions([]);
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

  const handleAddProductRow = () => {
    if (transactionType === 'sale') {
      if (!pieceBasedEnabled && !weightBasedEnabled) {
        showPopup('Product types are disabled for this tenant.', 'Feature');
        return;
      }
      setProducts([
        ...products,
        {
          product_name: '',
          id: null,
          quantity: '',
          suggestions: [],
          is_weight_based: 0,
          stock_quantity: null,
        },
      ]);
    } else if (transactionType === 'purchase') {
      openPurchaseModal();
    }
  };

  const removeProductRow = (index) => {
    const updated = [...products];
    updated.splice(index, 1);
    setProducts(updated);
    calculateTotal(updated);
  };

  const resolveIsWeightBased = (product) => {
    if (product?.is_weight_based != null) return Number(product.is_weight_based) === 1;
    if (product?.type != null) return Number(product.type) === 1;
    return false;
  };

  const filterByProductType = (list = []) =>
    list.filter((product) => {
      const isWeight = resolveIsWeightBased(product);
      if (isWeight && !weightBasedEnabled) return false;
      if (!isWeight && !pieceBasedEnabled) return false;
      return true;
    });

  const handleSaleProductSearch = async (text, index) => {
    latestSearchRef.current.sale[index] = text;
    if (text.length < 2) {
      setProducts((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], suggestions: [] };
        }
        return updated;
      });
      return;
    }
    try {
      const localSuggestions = await searchLocalProducts(text);
      if (localSuggestions.length) {
        const filtered = filterByProductType(localSuggestions.map(normalizeDisplayProduct));
        if (latestSearchRef.current.sale[index] !== text) return;
        setProducts((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { ...updated[index], suggestions: filtered };
          }
          return updated;
        });
        return;
      }
        if (!navigator.onLine) {
          if (latestSearchRef.current.sale[index] !== text) return;
          setProducts((prev) => {
            const updated = [...prev];
            if (updated[index]) {
              updated[index] = { ...updated[index], suggestions: [] };
            }
            return updated;
          });
          return;
        }
      const response = await api.get(buildSearchUrl(text, 'sale'));
      const results = response?.data?.products || response?.data?.data || response?.data || [];
      const filtered = filterByProductType(results);
      if (latestSearchRef.current.sale[index] !== text) return;
      setProducts((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], suggestions: Array.isArray(filtered) ? filtered : [] };
        }
        return updated;
      });
    } catch (err) {
        const filtered = [];
      if (latestSearchRef.current.sale[index] !== text) return;
      setProducts((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], suggestions: filtered };
        }
        return updated;
      });
      if (navigator.onLine) {
        if ((err.response?.data && err.response.data.message === 'Invalid Token') || err.response?.status === 401) {
          showPopup("Token Expired Please Login Again!", "Session");
          navigate('/logout');
        } else {
          console.log(err);
        }
      }
    }
  };

  const scheduleSaleProductSearch = (text, index) => {
    if (searchTimersRef.current.sale[index]) {
      clearTimeout(searchTimersRef.current.sale[index]);
    }
    if (text.length < 2) {
      handleSaleProductSearch(text, index);
      return;
    }
    searchTimersRef.current.sale[index] = setTimeout(() => {
      handleSaleProductSearch(text, index);
    }, productSearchDelayMs);
  };

  const handleSaleProductSelect = (product, index) => {
    const isWeight = resolveIsWeightBased(product);
    if (isWeight && !weightBasedEnabled) {
      showPopup('Weight-based products are disabled for this tenant.', 'Feature');
      return;
    }
    if (!isWeight && !pieceBasedEnabled) {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }
    const updated = [...products];
    updated[index] = {
      product_name: product.name,
      id: product.id,
      quantity: '',
      suggestions: [],
      selling_price: product.selling_price,
      purchase_price: product.purchase_price ?? product.purchasePrice ?? null,
      default_selling_price: product.selling_price,
      is_weight_based: product.is_weight_based ?? product.type ?? 0,
      stock_quantity: product.stock_quantity ?? null,
    };
    setProducts(updated);
    calculateTotal(updated);
  };

const handlePurchaseProductSearch = async (text, index) => {
  latestSearchRef.current.purchase[index] = text;
  if (text.length < 2) {
    setProducts((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], suggestions: [] };
      }
      return updated;
    });
    return;
  }
  try {
    const localSuggestions = await searchLocalProducts(text);
    if (localSuggestions.length) {
      const suggestions = filterByProductType(localSuggestions.map(normalizeDisplayProduct));
      if (latestSearchRef.current.purchase[index] !== text) return;
      setProducts((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], suggestions };
        }
        return updated;
      });
      return;
    }
      if (!navigator.onLine) {
        if (latestSearchRef.current.purchase[index] !== text) return;
        setProducts((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { ...updated[index], suggestions: [] };
          }
          return updated;
        });
        return;
      }
    const response = await api.get(buildSearchUrl(text, 'purchase'));
    const results = response?.data?.products || response?.data?.data || response?.data || [];
    const filtered = filterByProductType(results);
    if (latestSearchRef.current.purchase[index] !== text) return;
    setProducts((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], suggestions: Array.isArray(filtered) ? filtered : [] };
      }
      return updated;
    });
  } catch (err) {
    const filtered = [];
    if (latestSearchRef.current.purchase[index] !== text) return;
    setProducts((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], suggestions: filtered };
      }
      return updated;
    });
    if (navigator.onLine) {
      if ((err.response?.data && err.response.data.message === 'Invalid Token') || err.response?.status === 401) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        console.log(err);
      }
    }
  }
};

const schedulePurchaseProductSearch = (text, index) => {
  if (searchTimersRef.current.purchase[index]) {
    clearTimeout(searchTimersRef.current.purchase[index]);
  }
  if (text.length < 2) {
    handlePurchaseProductSearch(text, index);
    return;
  }
  searchTimersRef.current.purchase[index] = setTimeout(() => {
    handlePurchaseProductSearch(text, index);
  }, productSearchDelayMs);
};

  const handlePurchaseProductSelect = (product, index) => {
    const isWeight = resolveIsWeightBased(product);
  if (isWeight && !weightBasedEnabled) {
    showPopup('Weight-based products are disabled for this tenant.', 'Feature');
    return;
  }
  if (!isWeight && !pieceBasedEnabled) {
    showPopup('Piece-based products are disabled for this tenant.', 'Feature');
    return;
  }
  const updated = [...products];
    updated[index] = {
      ...updated[index],
      product_id: product.id ?? null,
      product_name: product.name,
      company: product.company,
      quantity: 1,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      batch_number: updated[index]?.batch_number || '',
      expiry_date: updated[index]?.expiry_date || '',
      category: product.category,
      time_for_delivery: '',
    suggestions: [],
      is_weight_based: product.is_weight_based ?? product.type ?? 0,
    stock_quantity: product.stock_quantity ?? null,
  };
  setProducts(updated);
  calculateTotal(updated);
};

  const openPurchaseModal = (prefill = {}) => {
    if (!pieceBasedEnabled && !weightBasedEnabled) {
      showPopup('Product types are disabled for this tenant.', 'Feature');
      return;
    }
    const base = getDefaultPurchaseData();
    setPurchaseModalData({ ...base, ...prefill });
    setPurchaseModalSuggestions([]);
    setPurchaseModalOpen(true);
  };

  const closePurchaseModal = () => {
    setPurchaseModalOpen(false);
    setPurchaseModalSuggestions([]);
  };

  const handlePurchaseModalChange = (field, value) => {
    setPurchaseModalData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'product_name' ? { product_id: null } : null),
    }));
  };

  const handlePurchaseModalSearch = async (text) => {
    latestPurchaseModalSearchRef.current = text;
    if (text.length < 2) {
      setPurchaseModalSuggestions([]);
      return;
    }
    try {
      const localSuggestions = await searchLocalProducts(text);
      if (localSuggestions.length) {
        const suggestions = filterByProductType(localSuggestions.map(normalizeDisplayProduct));
        if (latestPurchaseModalSearchRef.current !== text) return;
        setPurchaseModalSuggestions(suggestions);
        return;
      }
        if (!navigator.onLine) {
          if (latestPurchaseModalSearchRef.current !== text) return;
          setPurchaseModalSuggestions([]);
          return;
        }
      const response = await api.get(buildSearchUrl(text, 'purchase'));
      const results = response?.data?.products || response?.data?.data || response?.data || [];
      const filtered = filterByProductType(results);
      if (latestPurchaseModalSearchRef.current !== text) return;
      setPurchaseModalSuggestions(Array.isArray(filtered) ? filtered : []);
      } catch (err) {
        if (latestPurchaseModalSearchRef.current !== text) return;
        setPurchaseModalSuggestions([]);
      if (navigator.onLine) {
        if ((err.response?.data && err.response.data.message === 'Invalid Token') || err.response?.status === 401) {
          showPopup("Token Expired Please Login Again!", "Session");
          navigate('/logout');
        } else {
          console.log(err);
        }
      }
    }
  };

  const schedulePurchaseModalSearch = (text) => {
    if (purchaseModalSearchTimerRef.current) {
      clearTimeout(purchaseModalSearchTimerRef.current);
    }
    if (text.length < 2) {
      handlePurchaseModalSearch(text);
      return;
    }
    purchaseModalSearchTimerRef.current = setTimeout(() => {
      handlePurchaseModalSearch(text);
    }, productSearchDelayMs);
  };

  const handlePurchaseModalSelect = (product) => {
    const isWeight = resolveIsWeightBased(product);
    if (isWeight && !weightBasedEnabled) {
      showPopup('Weight-based products are disabled for this tenant.', 'Feature');
      return;
    }
    if (!isWeight && !pieceBasedEnabled) {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }
    setPurchaseModalData((prev) => ({
      ...prev,
      product_name: product.name,
      company: product.company,
      quantity: 1,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      batch_number: prev.batch_number || '',
      expiry_date: prev.expiry_date || '',
      category: product.category,
      time_for_delivery: '',
      is_weight_based: product.is_weight_based ?? product.type ?? 0,
      product_id: product.id ?? null,
    }));
    setPurchaseModalSuggestions([]);
  };

  const handlePurchaseModalSubmit = () => {
    const data = purchaseModalData || {};
    const hasExisting = Boolean(data.product_id);
    if (hasExisting) {
      if (!data.quantity || !data.purchase_price || !data.selling_price) {
        showPopup('Enter quantity, Purchase Price, and selling price', 'Validation');
        return;
      }
    } else {
      if (!data.product_name || !data.company || !data.quantity || !data.purchase_price || !data.selling_price || !data.category || !data.time_for_delivery) {
        showPopup('Fill all product details', 'Validation');
        return;
      }
    }
    const isWeight = Number(data.is_weight_based) === 1;
    if (isWeight && !weightBasedEnabled) {
      showPopup('Weight-based products are disabled for this tenant.', 'Feature');
      return;
    }
    if (!isWeight && !pieceBasedEnabled) {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }
    if (Number(data.selling_price) < Number(data.purchase_price)) {
      showPopup('Purchase Price is Less than Selling price', 'Validation');
      return;
    }
    const updated = [
      ...products,
      { ...data, suggestions: [] },
    ];
    setProducts(updated);
    calculateTotal(updated);
    closePurchaseModal();
  };

  const openBarcodeCreateModal = (barcode, prefill = {}) => {
    if (!pieceBasedEnabled) {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }
    setBarcodeCreateData({ ...getDefaultBarcodeCreateData(barcode), ...prefill, barcode });
    setBarcodeCreateOpen(true);
  };

  const closeBarcodeCreateModal = () => {
    setBarcodeCreateOpen(false);
  };

  const handleBarcodeCreateChange = (field, value) => {
    setBarcodeCreateData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addOrIncrementSaleProduct = (product) => {
    const isWeight = resolveIsWeightBased(product);
    setProducts((prev) => {
      if (isWeight) {
        const updated = [
          ...prev,
          {
            product_name: product.name,
            id: product.id,
            quantity: '',
            suggestions: [],
            selling_price: product.selling_price,
            purchase_price: product.purchase_price ?? product.purchasePrice ?? null,
            default_selling_price: product.selling_price,
            is_weight_based: product.is_weight_based ?? product.type ?? 0,
            stock_quantity: product.stock_quantity ?? null,
          },
        ];
        calculateTotal(updated);
        return updated;
      }
      const existingIndex = prev.findIndex((p) => p.id === product.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const currentQty = parseInt(updated[existingIndex].quantity || '0', 10) || 0;
        const nextQty = currentQty + 1;
        if (
          updated[existingIndex].stock_quantity != null &&
          updated[existingIndex].stock_quantity !== '' &&
          nextQty > Number(updated[existingIndex].stock_quantity)
        ) {
          showPopup('Entered quantity exceeds stock', 'Validation');
          return prev;
        }
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: String(nextQty),
        };
        calculateTotal(updated);
        return updated;
      }
      const updated = [
        ...prev,
        {
          product_name: product.name,
          id: product.id,
          quantity: '1',
          suggestions: [],
          selling_price: product.selling_price,
          is_weight_based: product.is_weight_based ?? product.type ?? 0,
          stock_quantity: product.stock_quantity ?? null,
        },
      ];
      calculateTotal(updated);
      return updated;
    });
  };

  const isWeightBasedProduct = (product) =>
    resolveIsWeightBased(product);

  const isValidWeightInput = (value) => {
    if (value === '') return true;
    return /^\d+(\.\d{0,2})?$/.test(value);
  };

  const isValidPieceInput = (value) => {
    if (value === '') return true;
    return /^\d+$/.test(value);
  };

  const getProductTypeLabel = (product) => (isWeightBasedProduct(product) ? 'Weight' : 'Piece');

  const getQuantityPlaceholder = (product) =>
    isWeightBasedProduct(product) ? 'Weight (kg)' : 'Quantity (pcs)';

  const getPurchaseSuggestionLabel = (product) => {
    const name = product?.name || '-';
    const company = product?.company || '-';
    const selling = product?.selling_price ?? '-';
    const actual = product?.purchase_price ?? '-';
    const category = product?.category || '-';
    const delivery = product?.time_for_delivery ?? '-';
    const typeLabel = resolveIsWeightBased(product) ? 'Weight' : 'Piece';
    return `${name} | ${company} | Sell: ${selling} | Actual: ${actual} | Type: ${typeLabel} | Delivery: ${delivery} | Cat: ${category}`;
  };

  const handleBarcodeSearch = async (overrideCode) => {
    const rawCode =
      typeof overrideCode === 'string' || typeof overrideCode === 'number'
        ? overrideCode
        : barcodeInput;
    const code = String(rawCode || '').trim();
    if (!code) return;
    if (isBarcodeAdding) return;
    if (transactionType !== 'sale' && transactionType !== 'purchase') {
      showPopup('Barcode search is only for sales or purchases.', 'Validation');
      return;
    }
    try {
      setIsBarcodeAdding(true);
      const localProduct = await getProductByBarcode(code);
      let product = localProduct ? normalizeDisplayProduct(localProduct) : null;
      if (!product) {
        const barcodeMode = transactionType === 'purchase' ? 'purchase' : 'sale';
        const res = await api.get(buildBarcodeUrl(code, barcodeMode));
        product = res?.data?.product || res?.data?.data || res?.data;
      }
      if (Array.isArray(product)) product = product[0];
      if (!product) {
        showPopup('Product not found', 'Validation');
        openBarcodeCreateModal(code);
        return;
      }
    const isWeight = resolveIsWeightBased(product);
      if (isWeight && !weightBasedEnabled) {
        showPopup('Weight-based products are disabled for this tenant.', 'Feature');
        return;
      }
      if (!isWeight && !pieceBasedEnabled) {
        showPopup('Piece-based products are disabled for this tenant.', 'Feature');
        return;
      }
      if (transactionType === 'sale') {
        addOrIncrementSaleProduct(product);
      } else {
        openPurchaseModal({
          product_name: product.name,
          company: product.company,
          quantity: 1,
          purchase_price: product.purchase_price,
          selling_price: product.selling_price,
          category: product.category,
          time_for_delivery: '',
          is_weight_based: product.is_weight_based ?? product.type ?? 0,
          stock_quantity: product.stock_quantity ?? null,
          product_id: product.id ?? null,
        });
      }
      setBarcodeInput('');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        showPopup('Product not found', 'Validation');
        openBarcodeCreateModal(code);
        return;
      }
      showPopup('Barcode lookup failed', 'Error');
    } finally {
      setIsBarcodeAdding(false);
    }
  };

  useEffect(() => {
    if (!barcodeEnabled) return;
    if (transactionType !== 'sale' && transactionType !== 'purchase') return;

    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = target?.isContentEditable === true;
      const isFormField = ['input', 'textarea', 'select'].includes(tag);
      const isBarcodeInput = barcodeInputRef.current && target === barcodeInputRef.current;
      if (isBarcodeInput) return;
      if (isFormField || isEditable) return;

      if (event.key === 'Enter') {
        const code = barcodeBufferRef.current.trim();
        if (code) {
          barcodeBufferRef.current = '';
          handleBarcodeSearch(code);
        }
        return;
      }

      if (event.key && event.key.length === 1) {
        barcodeBufferRef.current += event.key;
        if (barcodeTimerRef.current) {
          clearTimeout(barcodeTimerRef.current);
        }
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = '';
        }, 60);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (barcodeTimerRef.current) {
        clearTimeout(barcodeTimerRef.current);
        barcodeTimerRef.current = null;
      }
      barcodeBufferRef.current = '';
    };
  }, [barcodeEnabled, transactionType]);

  const handleBarcodeCreateSubmit = async () => {
    if (isBarcodeCreating) return;
    if (!pieceBasedEnabled) {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }
    const data = barcodeCreateData || {};
    if (!data.barcode) {
      showPopup('Barcode is required', 'Validation');
      return;
    }
    if (!data.product_name || !data.category || !data.selling_price || !data.purchase_price || !data.company || !data.stock_quantity) {
      showPopup('Fill all product details', 'Validation');
      return;
    }
    if (Number(data.selling_price) < Number(data.purchase_price)) {
      showPopup('Purchase Price is Less than Selling price', 'Validation');
      return;
    }
    try {
      setIsBarcodeCreating(true);
      const payload = {
        product_name: data.product_name,
        company: data.company,
        selling_price: data.selling_price,
        purchase_price: data.purchase_price,
        stock_quantity: data.stock_quantity,
        category: data.category,
        barcode: data.barcode,
        is_weight_based: 0,
        time_for_delivery: data.time_for_delivery ?? 0,
      };
      await api.post('/products', payload);
      closeBarcodeCreateModal();
      const mode = transactionType === 'purchase' ? 'purchase' : 'sale';
      const res = await api.get(buildBarcodeUrl(data.barcode, mode));
      let created = res?.data?.product || res?.data?.data || res?.data;
      if (Array.isArray(created)) created = created[0];
      if (!created || !created.id) {
        showPopup('Product created, but could not load for billing.', 'Error');
        return;
      }
      if (transactionType === 'purchase') {
        openPurchaseModal({
          product_name: created.name,
          company: created.company,
          quantity: 1,
          purchase_price: created.purchase_price,
          selling_price: created.selling_price,
          category: created.category,
          time_for_delivery: '',
          is_weight_based: created.is_weight_based ?? created.type ?? 0,
          stock_quantity: created.stock_quantity ?? null,
          product_id: created.id ?? null,
        });
      } else {
        addOrIncrementSaleProduct(created);
      }
      setBarcodeInput('');
      showPopup('Product added successfully!', 'Success');
    } catch (err) {
      if (err?.response?.status === 401) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        showPopup('Issue while adding product. Please try again.', 'Error');
        console.error('Error adding product from barcode:', err);
      }
    } finally {
      setIsBarcodeCreating(false);
    }
  };

  const handleQuantityChange = (value, index) => {
    const updated = [...products];
    const current = updated[index] || {};
    const weightBased = isWeightBasedProduct(current);
    if (!weightBased && !pieceBasedEnabled && current?.id) {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }

    if (weightBased) {
      if (!isValidWeightInput(value)) {
        return;
      }
      const numeric = parseFloat(value);
      if (
        value !== '' &&
        Number.isFinite(numeric) &&
        current.stock_quantity != null &&
        current.stock_quantity !== '' &&
        numeric > Number(current.stock_quantity)
      ) {
        showPopup('Entered weight exceeds stock', 'Validation');
        return;
      }
      updated[index].quantity = value;
    } else {
      if (!isValidPieceInput(value)) {
        showPopup('Invalid input for piece item', 'Validation');
        return;
      }
      const numeric = parseInt(value, 10);
      if (
        value !== '' &&
        Number.isFinite(numeric) &&
        current.stock_quantity != null &&
        current.stock_quantity !== '' &&
        numeric > Number(current.stock_quantity)
      ) {
        showPopup('Entered quantity exceeds stock', 'Validation');
        return;
      }
      updated[index].quantity = value;
    }

    setProducts(updated);
    calculateTotal(updated);
  };

  const handleSaleFieldChange = (value, index, field) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
    calculateTotal(updated);
  };

  const handlePurchaseFieldChange = (value, index, field) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
    calculateTotal(updated);
  };
  

  const calculateTotal = (updatedProducts = products) => {
    if (transactionType === 'sale') {
      const total = updatedProducts.reduce((sum, p) => {
        return sum + (parseFloat(p.quantity || 0) * parseFloat(p.selling_price || 0));
      }, 0);
      setTotalAmount(total);
    } else if (transactionType === 'purchase') {
      const total = updatedProducts.reduce((sum, p) => {
        return sum + (parseFloat(p.quantity || 0) * parseFloat(p.purchase_price || 0));
      }, 0);
      setTotalAmount(total);
    }
  };

  const handleSubmit = async (key) => {
    if(key === 0) {
      if (orderDetails || !multiDraftEnabled) {
        navigate('/orders');
        dispatch(clearOrderDetails());
        return;
      }
      handleDiscardDraft(activeDraftId);
      return;
    }
    if ((transactionType === 'sale' || transactionType === 'purchase') && !effectiveBranchId) {
      showPopup('Select a branch before proceeding.', 'Validation');
      return;
    }
    if (!transactionType) {
      showPopup('Select transaction type', 'Validation');
      return;
    }

    if ((transactionType === 'sale' || transactionType === 'personal') && !paymentMethod)
      {
        showPopup('Select payment method', 'Validation');
        return;
      }

    if (transactionType === 'sale') {
      if (requireCustomerDetails) {
        const nameFilled = customerName.trim().length > 0;
        const phoneFilled = customerPhone.trim().length > 0;
        if (nameFilled && !phoneFilled) {
          showPopup('Customer phone is required when name is provided', 'Validation');
          return;
        }
      }
      for (const p of products) {
        if (!p.id || p.quantity === '' || p.quantity == null) {
          showPopup('Select product and quantity', 'Validation');
          return;
        }
        const weightBased = isWeightBasedProduct(p);
        const rawValue = String(p.quantity);
        if (weightBased) {
          if (!isValidWeightInput(rawValue) || Number(p.quantity) <= 0) {
            showPopup('Select product and quantity', 'Validation');
            return;
          }
          if (
            p.stock_quantity != null &&
            p.stock_quantity !== '' &&
            Number(p.quantity) > Number(p.stock_quantity)
          ) {
            showPopup('Entered weight exceeds stock', 'Validation');
            return;
          }
        } else {
          if (!isValidPieceInput(rawValue) || Number(p.quantity) <= 0) {
            showPopup('Invalid input for piece item', 'Validation');
            return;
          }
        }
      }
    } else if (transactionType === 'purchase') {
      for (const p of products) {
        const hasExisting = Boolean(p.product_id);
        if (hasExisting) {
          if (!p.quantity || !p.purchase_price || !p.selling_price) {
            showPopup('Enter quantity, Purchase Price, and selling price', 'Validation');
            return;
          }
        } else {
          if (!p.product_name || !p.company || !p.quantity || !p.purchase_price || !p.selling_price || !p.category || !p.time_for_delivery) {
            showPopup('Fill all product details', 'Validation');
            return;
          }
        }
        const isWeight = Number(p.is_weight_based) === 1;
        if (isWeight && !weightBasedEnabled) {
          showPopup('Weight-based products are disabled for this tenant.', 'Feature');
          return;
        }
        if (!isWeight && !pieceBasedEnabled) {
          showPopup('Piece-based products are disabled for this tenant.', 'Feature');
          return;
        }
        if (p.selling_price < p.purchase_price) {
          showPopup('Purchase Price is Less than Selling price', 'Validation');
          return;
        }
      }
    } else if (transactionType === 'personal' && !personalAmount) {
      showPopup('Enter amount for personal transaction', 'Validation');
      return;
    }

    const updatePayload = {
        transaction_type: transactionType,
        type: transactionType,
        user_id: userDetails.id,
        customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
          customer_address: customerAddress || undefined,
          customer_location: customerLocation || undefined,
          branch_id: effectiveBranchId || undefined,
          total_amount: transactionType === 'personal' ? parseFloat(personalAmount) : totalAmount,
        total_price: transactionType === 'personal' ? parseFloat(personalAmount) : totalAmount,
        payment: paymentMethod,
        payment_method: paymentMethod,
        products: products.map(p => {
          if (transactionType === 'sale') {
            return {
              product_id: p.id,
              quantity: p.quantity,
              selling_price: p.selling_price,
              is_weight_based: p.is_weight_based ?? 0,
            };
          }
          if (transactionType === 'purchase') return { ...p };
          return {};
        }),
        items: products.map(p => {
          if (transactionType === 'sale') return { 
            product_id: p.id, 
            product_name: p.product_name,
            quantity: p.quantity, 
            selling_price: p.selling_price,
            price: p.selling_price,
            is_weight_based: p.is_weight_based ?? 0,
          };
          if (transactionType === 'purchase') return { ...p };
          return {};
        })
      };

    const createPayload = {
          transaction_type: transactionType,
          user_id: userDetails.id,
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
          customer_address: customerAddress || undefined,
          customer_location: customerLocation || undefined,
          branch_id: effectiveBranchId || undefined,
          total_amount: transactionType === 'personal' ? parseFloat(personalAmount) : totalAmount,
          payment_method: paymentMethod,
        products: products.map(p => {
          if (transactionType === 'sale') {
            return {
              product_id: p.id,
              quantity: p.quantity,
              selling_price: p.selling_price,
              is_weight_based: p.is_weight_based ?? 0,
            };
          }
          if (transactionType === 'purchase') return { ...p };
          return {};
        })
      };

    const enqueueAndExit = async (isUpdate, shouldShowOfflinePopup = false) => {
      const entry = isUpdate
        ? { type: 'update', orderId: orderDetails.id, payload: updatePayload }
        : { type: 'create', payload: createPayload };
      await enqueueOfflineOrder(entry);
      if (shouldShowOfflinePopup) {
        showPopup('Offline: Order saved and will sync when you are online.', 'Offline');
      }
      dispatch(clearOrderDetails());
      if (isUpdate || !multiDraftEnabled) {
        navigate('/orders');
      } else {
        handleDiscardDraft(activeDraftId);
        scrollToTop();
      }
    };

    try {
      const serverOffline =
        !navigator.onLine ||
        (typeof window !== 'undefined' && window.__serverOffline === true);

      if (serverOffline) {
        await enqueueAndExit(Boolean(orderDetails), true);
        return;
      }

      setIsLoading(true);
      if(orderDetails) {
        const updateRes = await api.put(`/orders/${orderDetails.id}`, updatePayload);
        const updatedProducts = updateRes?.data?.updated_products;
        if (Array.isArray(updatedProducts) && updatedProducts.length) {
          try {
            await updateProductsBulk(updatedProducts);
          } catch (err) {
            console.error('Failed to sync updated products', err);
          }
        }
        dispatch(clearOrderDetails());
        navigate('/orders');
        showPopup('Order Updated!!', 'Success');
        return;
      }
      
      // For new orders
      if (transactionType === 'purchase') {
        const canUsePurchases = products.every((p) => Boolean(p.product_id));
        if (canUsePurchases) {
          const items = products.map((p) => ({
            product_id: p.product_id,
            batch_number: p.batch_number || undefined,
            expiry_date: p.expiry_date || undefined,
            purchase_price: p.purchase_price,
            selling_price: p.selling_price,
            quantity: p.quantity,
          }));
          await api.post('/purchases', { branch_id: effectiveBranchId, items });
          dispatch(clearOrderDetails());
          navigate('/orders');
          showPopup('Purchase recorded.', 'Success');
          return;
        }
      }

      const createRes = await api.post('/orders', createPayload);
      const updatedProducts = createRes?.data?.updated_products;
      if (Array.isArray(updatedProducts) && updatedProducts.length) {
        try {
          await updateProductsBulk(updatedProducts);
        } catch (err) {
          console.error('Failed to sync updated products', err);
        }
      }
      showPopup('Order Placed!!', 'Success');
      if (multiDraftEnabled) {
        handleDiscardDraft(activeDraftId);
        scrollToTop();
      } else {
        navigate('/orders');
      }
    } catch (err) {
      if (!err?.response) {
        const shouldShowOfflinePopup =
          !navigator.onLine ||
          (typeof window !== 'undefined' && window.__serverOffline === true);
        await enqueueAndExit(Boolean(orderDetails), shouldShowOfflinePopup);
        return;
      }
      const message = err?.response?.data?.message;
      const status = err?.response?.status || err?.status;
      if (
        navigator.onLine &&
        (message === 'Invalid Token' ||
          status === 401)
      ) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        showPopup(message || "Please Enter valid Products/Details!", "Error");
        console.log(err);
      }
    }
    finally { 
      setIsLoading(false);
    }
  };
  

  return (
    <div className="create-order-page">
      <div className="wow-motion-layer" aria-hidden="true">
        <span className="wow-orb orb-a"></span>
        <span className="wow-orb orb-b"></span>
        <span className="wow-orb orb-c"></span>
        <span className="wow-orb orb-d"></span>
        <span className="wow-ring ring-a"></span>
        <span className="wow-ring ring-b"></span>
        <span className="wow-pulse"></span>
      </div>
      <div className={`order-shell wow-content ${multiDraftEnabled ? 'order-shell--split' : ''}`}>
        {multiDraftEnabled && (
          <aside className="order-sidebar">
            <div className="order-sidebar-header">
              <div>
                <p className="order-sidebar-kicker">Draft Orders</p>
                <h3 className="order-sidebar-title-text">Orders</h3>
              </div>
              <button
                className="btn btn-outline-light btn-sm order-sidebar-add"
                type="button"
                onClick={handleAddDraft}
              >
                New Order
              </button>
            </div>
            <div className="order-sidebar-list">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  className={`order-sidebar-item ${draft.id === activeDraftId ? 'active' : ''}`}
                  onClick={() => handleSelectDraft(draft.id)}
                >
                  <div className="order-sidebar-title">{draft.label}</div>
                  <div className="order-sidebar-meta">
                    <span>{draft.transactionType || 'No type'}</span>
                    <span className="order-sidebar-dot">â€¢</span>
                    <span>â‚¹{getDraftTotal(draft).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}
        <div className="order-main">
        {/* <div className="order-hero">
            <div>
            <div className="order-kicker">SHAJ Retail Products</div>
            <h3 className='order-title'>
              {orderDetails ? 'Update Order' : 'Create New Order'}
            </h3>
            <p className="order-subtitle">
              Build your order like a pro. Add products, set quantities, and checkout with confidence.
            </p>
          </div>
          <div className="order-hero-badge">
            Owner Mode
          </div>
        </div> */}
      <div className="order-card">
      <div className="mb-3">
        {saleMethods && saleMethods.map(type => (
          <label key={type} className="me-3">
            <input
              type="radio"
              value={type}
              checked={transactionType === type}
              onChange={handleTransactionTypeChange}
            /> {type}
          </label>
        ))}
      </div>

      {/* <div className="mb-3">
        <label>User Name:</label>
        <input className="form-control text-danger bg-light" value={userDetails.name} disabled />
      </div> */}

      {(transactionType === 'sale' || transactionType === 'personal' || transactionType === 'purchase') && (
        <div className="mb-3">
          <label>Payment Method:</label>
          <div>
            {['cash', 'online', ...(creditEnabled ? ['credit'] : [])].map(method => (
              <label key={method} className="me-3">
                <input
                  type="radio"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={handlePaymentMethodChange}
                /> {method}
              </label>
            ))}
          </div>
        </div>
      )}

      {requireCustomerDetails && transactionType === 'sale' && (
        <div className="mb-3">
          <label>Customer Details:</label>
          <div className="row">
            <div className="col-md-6 mb-2">
              <input
                className="form-control bg-light text-dark"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  handleCustomerSearch(e.target.value);
                }}
              />
              {customerSuggestions.length > 0 && (
                <ul className="list-group">
                  {customerSuggestions.map((c) => (
                    <li
                      key={c.id || c.mobile || c.phone || c.name}
                      className="list-group-item list-group-item-action"
                      onClick={() => handleCustomerSelect(c)}
                    >
                      {c.name}
                      {c.mobile ? ` - ${c.mobile}` : c.phone ? ` - ${c.phone}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="col-md-6 mb-2">
              <input
                className="form-control bg-light text-dark"
                placeholder="Customer Phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div className="col-12">
              <input
                className="form-control bg-light text-dark"
                placeholder="Customer Address (optional)"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </div>
            <div className="col-12 mt-2">
              <input
                className="form-control bg-light text-dark"
                placeholder="Customer Location (optional)"
                value={customerLocation}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomerLocation(value);
                  handleLocationSearch(value);
                }}
              />
              {locationSuggestions.length > 0 && (
                <ul className="list-group">
                  {locationSuggestions.map((location) => (
                    <li
                      key={location}
                      className="list-group-item list-group-item-action"
                      onClick={() => {
                        setCustomerLocation(location);
                        setLocationSuggestions([]);
                      }}
                    >
                      {location}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {barcodeEnabled && (transactionType === 'sale' || transactionType === 'purchase') && (
        <div className="mb-3">
          <label>Barcode:</label>
          <div className="d-flex gap-2">
            <input
              className="form-control bg-light text-dark"
              placeholder="Scan or enter barcode"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              ref={barcodeInputRef}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBarcodeSearch();
                }
              }}
            />
            <button
              className="btn btn-outline-primary"
              type="button"
              onClick={handleBarcodeSearch}
              disabled={isBarcodeAdding}
            >
              {isBarcodeAdding ? 'Item Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {transactionType === 'sale' && products.map((p, index) => {
        const profitPerUnit = computeProfitPerUnit(p.purchase_price, p.selling_price);
        const marginPercent =
          profitPerUnit !== null && Number(p.selling_price || 0) > 0
            ? (profitPerUnit / Number(p.selling_price || 0)) * 100
            : null;
        const canOverridePrice = userDetails?.role === 'admin';
        return (
          <div className="row mb-2" key={index}>
          <div className="col-md-4">
            <input
              className="form-control bg-light text-dark"
              placeholder="Search Product"
              value={p.product_name}
              onChange={(e) => {
                const updated = [...products];
                updated[index].product_name = e.target.value;
                setProducts(updated);
                scheduleSaleProductSearch(e.target.value, index);
              }}
            />
            {p.id && (
              <div className="mt-2 d-flex align-items-center gap-2 flex-wrap">
                <span className={`product-type-badge ${isWeightBasedProduct(p) ? 'badge-weight' : 'badge-piece'}`}>
                  [{getProductTypeLabel(p)}]
                </span>
                {p.stock_quantity != null && p.stock_quantity !== '' && (
                  <small className={Number(p.stock_quantity) < 5 ? 'text-danger' : 'text-secondary'}>
                    Stock: {Number(p.stock_quantity)}
                  </small>
                )}
              </div>
            )}
            {p.suggestions?.length > 0 && (
              <ul className="list-group">
                {p.suggestions.map((s, i) => (
                  (s.stock_quantity == null || Number(s.stock_quantity) > 0) ?
                    <li
                      key={i}
                      className="list-group-item list-group-item-action"
                      onClick={() => handleSaleProductSelect(s, index)}
                    >
                      <div className="d-flex justify-content-between align-items-center gap-2">
                        <span>{s.name + " - " + s.company + '(Rs. ' + s.selling_price + ')'}</span>
                        <span className={`product-type-badge ${resolveIsWeightBased(s) ? 'badge-weight' : 'badge-piece'}`}>
                          [{resolveIsWeightBased(s) ? 'Weight' : 'Piece'}]
                        </span>
                      </div>
                      {s.stock_quantity != null &&
                        s.stock_quantity !== '' &&
                        Number(s.stock_quantity) > 0 &&
                        Number(s.stock_quantity) < 5 && (
                          <small className="text-danger">
                            Only {Number(s.stock_quantity)} left
                          </small>
                        )}
                      {s.location_tag && (
                        <small className="text-warning d-block">
                          {s.location_tag}
                        </small>
                      )}
                    </li>
                    : <li className="list-group-item list-group-item-action text-danger" disabled>
                      <div>{s.name + '(Out Of Stock)'}</div>
                      {s.location_tag && (
                        <small className="text-warning d-block">
                          {s.location_tag}
                        </small>
                      )}
                    </li>
                ))}
              </ul>
            )}
          </div>
          <div className="col-md-2">
            {/* <label className="form-label small text-uppercase text-secondary">
              {isWeightBasedProduct(p) ? 'Weight (kg)' : 'Quantity (pcs)'}
            </label> */}
            <input
              type="number"
              className="form-control bg-light text-dark"
              placeholder={getQuantityPlaceholder(p)}
              value={p.quantity}
              onChange={(e) => handleQuantityChange(e.target.value, index)}
              disabled={!p.id}
              step={isWeightBasedProduct(p) ? '0.01' : '1'}
              max={
                p.stock_quantity != null && p.stock_quantity !== ''
                  ? Number(p.stock_quantity)
                  : undefined
              }
              inputMode={isWeightBasedProduct(p) ? 'decimal' : 'numeric'}
              data-testid="sale-quantity-input"
            />
            {p.quantity !== '' && p.quantity != null && (
              <small className="form-text text-white">
                {isWeightBasedProduct(p) ? `Weight: ${Number(p.quantity).toFixed(2)} kg` : `Qty: ${p.quantity} pcs`}
              </small>
            )}
            {isWeightBasedProduct(p) && (
              <small className="form-text text-white weight-helper">
                Use decimal for kg, e.g., 1.25
              </small>
            )}
          </div>
          <div className="col-md-2">
            <input
              type="number"
              className="form-control bg-light text-dark"
              placeholder="Selling Price"
              value={p.selling_price ?? ''}
              onChange={(e) => handleSaleFieldChange(e.target.value, index, 'selling_price')}
              disabled={!p.id || !canOverridePrice}
            />
            {!canOverridePrice ? (
              <small className="form-text text-secondary">Only admins can edit price</small>
            ) : null}
            {p.default_selling_price != null && p.default_selling_price !== '' ? (
              <small className="form-text text-secondary">
                Default: â‚¹{p.default_selling_price}
              </small>
            ) : null}
            {profitPerUnit !== null ? (
              <small className={profitPerUnit < 0 ? 'text-danger' : 'text-success'}>
                Profit/unit: â‚¹{profitPerUnit}
                {marginPercent !== null ? ` (${marginPercent.toFixed(2)}%)` : ''}
              </small>
            ) : null}
          </div>
          <div className="col-md-1 d-flex align-items-center">
            <button className="btn btn-danger btn-sm" onClick={() => removeProductRow(index)}>Ã—</button>
          </div>
        </div>
      );
      })}

  {transactionType === 'purchase' && products.map((p, index) => (
    <div className="row mb-2" key={index}>
      {['product_name', 'company', 'is_weight_based', 'quantity', 'purchase_price', 'selling_price', 'batch_number', 'expiry_date', 'category', 'time_for_delivery'].map((field) => (
        <div className="col" key={field}>
          {field === 'product_name' ? (
            <>
              <input
                className="form-control"
              placeholder="Product Name"
              value={p.product_name}
              onChange={(e) => {
                handlePurchaseFieldChange(e.target.value, index, 'product_name');
                schedulePurchaseProductSearch(e.target.value, index);
              }}
            />
            {p.suggestions?.length > 0 && (
              <ul className="list-group">
                {p.suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="list-group-item list-group-item-action"
                    onClick={() => handlePurchaseProductSelect(s, index)}
                  >
                    {getPurchaseSuggestionLabel(s)}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : field === 'category' ? (
          <>
            <input
              list="categories-list"
              className="form-control"
              placeholder="Category"
              value={p.category}
              onChange={(e) => handlePurchaseFieldChange(e.target.value, index, 'category')}
            />
            <datalist id="categories-list">
              {categories.data && categories.data.map((cat, idx) => (
                <option key={idx} value={cat.category} />
              ))}
            </datalist>
          </>
          ) : field === 'is_weight_based' ? (
            <select
              className="form-select"
              value={String(p.is_weight_based ?? 0)}
              onChange={(e) => handlePurchaseFieldChange(e.target.value, index, 'is_weight_based')}
              disabled={!pieceBasedEnabled || !weightBasedEnabled}
            >
              {pieceBasedEnabled && <option value="0">Piece</option>}
              {weightBasedEnabled && <option value="1">Weight</option>}
            </select>
          ) : field === 'expiry_date' ? (
            <input
              className="form-control"
              type="date"
              value={p.expiry_date || ''}
              onChange={(e) => handlePurchaseFieldChange(e.target.value, index, 'expiry_date')}
            />
          ) : field === 'selling_price' ? (
            <div>
              <input
                className="form-control"
                placeholder={field.replace(/_/g, ' ')}
                value={p[field]}
                onChange={(e) => handlePurchaseFieldChange(e.target.value, index, field)}
              />
              {computeProfitPerUnit(p.purchase_price, p.selling_price) !== null ? (
                <small
                  className={
                    computeProfitPerUnit(p.purchase_price, p.selling_price) < 0
                      ? 'text-danger'
                      : 'text-success'
                  }
                >
                  Profit/unit: â‚¹{computeProfitPerUnit(p.purchase_price, p.selling_price)}
                </small>
              ) : null}
            </div>
          ) : (
            <input
              className="form-control"
              placeholder={field.replace(/_/g, ' ')}
              value={p[field]}
            onChange={(e) => handlePurchaseFieldChange(e.target.value, index, field)}
          />
        )}
      </div>
    ))}
    <div className="col-1 d-flex align-items-center">
      <button className="btn btn-danger btn-sm" onClick={() => removeProductRow(index)}>Ã—</button>
    </div>
  </div>
))}


      {transactionType && transactionType !== 'personal' && (
        <div className="mb-3 d-flex flex-wrap gap-2">
          <button className="btn btn-success" onClick={handleAddProductRow}>Add Product</button>
          {transactionType === 'purchase' && (
            <>
              <button className="btn btn-outline-info" onClick={() => setInvoiceModalOpen(true)}>
                Upload Purchase Invoice
              </button>
              <button className="btn btn-outline-light" onClick={handleDownloadPurchasePdf}>
                Download Purchase PDF
              </button>
            </>
          )}
        </div>
      )}

      {transactionType === 'personal' && (
        <div className="mb-3">
          <label>Total Amount:</label>
          <input
            type="number"
            className="form-control"
            value={personalAmount}
            onChange={(e) => setPersonalAmount(e.target.value)}
          />
        </div>
      )}

      {(transactionType === 'sale' || transactionType === 'purchase') && (
        <div className="mb-3">
          <strong>Total: â‚¹{totalAmount.toFixed(2)}</strong>
        </div>
      )}

      <div className="order-actions">
        <button className="btn btn-danger m-1 order-btn" onClick={()=>handleSubmit(0)}>
          { isLoading ? <div class="spinner-border spinner-style text-light" role="status"></div> : `Cancel`}
        </button>
        <button className="btn btn-primary m-1 order-btn order-btn-primary" onClick={()=>handleSubmit(1)}>
          {isLoading ? (
            <div class="spinner-border spinner-style text-light" role="status"></div>
          ) : (
            orderDetails ? 'Update Order' : 'Create Order'
          )}
        </button>
      </div>
        </div>
        </div>
      </div>
      {purchaseModalOpen && (
        <div className="purchase-modal-overlay" onClick={closePurchaseModal}>
          <div className="purchase-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Add Purchase Product</h4>
            <div className="row g-3">
              <div className="col-12">
                <label>Product Name</label>
                <input
                  className="form-control"
                  placeholder="Product Name"
                  value={purchaseModalData.product_name || ''}
                  onChange={(e) => {
                    handlePurchaseModalChange('product_name', e.target.value);
                    schedulePurchaseModalSearch(e.target.value);
                  }}
                />
                {purchaseModalSuggestions.length > 0 && (
                  <ul className="list-group mt-2">
                    {purchaseModalSuggestions.map((s, i) => (
                      <li
                        key={`${s.id || s.name}-${i}`}
                        className="list-group-item list-group-item-action"
                        onClick={() => handlePurchaseModalSelect(s)}
                      >
                        {getPurchaseSuggestionLabel(s)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="col-md-6">
                <label>Company</label>
                <input
                  className="form-control"
                  placeholder="Company"
                  value={purchaseModalData.company || ''}
                  onChange={(e) => handlePurchaseModalChange('company', e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label>Type</label>
                <select
                  className="form-select"
                  value={String(purchaseModalData.is_weight_based ?? 0)}
                  onChange={(e) => handlePurchaseModalChange('is_weight_based', e.target.value)}
                  disabled={!pieceBasedEnabled || !weightBasedEnabled}
                >
                  {pieceBasedEnabled && <option value="0">Piece</option>}
                  {weightBasedEnabled && <option value="1">Weight</option>}
                </select>
              </div>
              <div className="col-md-4">
                <label>Quantity</label>
                <input
                  className="form-control"
                  placeholder="Quantity"
                  value={purchaseModalData.quantity || ''}
                  onChange={(e) => handlePurchaseModalChange('quantity', e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label>Purchase Price</label>
                <input
                  className="form-control"
                  placeholder="Purchase Price"
                  value={purchaseModalData.purchase_price || ''}
                  onChange={(e) => handlePurchaseModalChange('purchase_price', e.target.value)}
                />
              </div>
                <div className="col-md-4">
                  <label>Selling Price</label>
                  <input
                    className="form-control"
                    placeholder="Selling Price"
                    value={purchaseModalData.selling_price || ''}
                    onChange={(e) => handlePurchaseModalChange('selling_price', e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label>Batch Number</label>
                  <input
                    className="form-control"
                    placeholder="Batch Number"
                    value={purchaseModalData.batch_number || ''}
                    onChange={(e) => handlePurchaseModalChange('batch_number', e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label>Expiry Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={purchaseModalData.expiry_date || ''}
                    onChange={(e) => handlePurchaseModalChange('expiry_date', e.target.value)}
                  />
                </div>
              <div className="col-md-6">
                <label>Category</label>
                <input
                  list="purchase-categories-list"
                  className="form-control"
                  placeholder="Category"
                  value={purchaseModalData.category || ''}
                  onChange={(e) => handlePurchaseModalChange('category', e.target.value)}
                />
                <datalist id="purchase-categories-list">
                  {categories.data && categories.data.map((cat, idx) => (
                    <option key={idx} value={cat.category} />
                  ))}
                </datalist>
              </div>
              <div className="col-md-6">
                <label>Time For Delivery</label>
                <input
                  className="form-control"
                  placeholder="Time For Delivery"
                  value={purchaseModalData.time_for_delivery || ''}
                  onChange={(e) => handlePurchaseModalChange('time_for_delivery', e.target.value)}
                />
              </div>
            </div>
            <div className="purchase-modal-actions">
              <button className="btn btn-outline-secondary" onClick={closePurchaseModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handlePurchaseModalSubmit}>
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}
      {invoiceModalOpen && (
        <div className="purchase-modal-overlay" onClick={closeInvoiceModal}>
          <div className="purchase-modal purchase-invoice-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Import Purchase Invoice</h4>
            <div className="row g-3">
              <div className="col-md-6">
                <label>Supplier ID (optional)</label>
                <input
                  className="form-control"
                  value={invoiceMeta.supplier_id || ''}
                  onChange={(e) => setInvoiceMeta((prev) => ({ ...prev, supplier_id: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label>Invoice Number (optional)</label>
                <input
                  className="form-control"
                  value={invoiceMeta.invoice_number || ''}
                  onChange={(e) => setInvoiceMeta((prev) => ({ ...prev, invoice_number: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label>Payment Mode</label>
                <select
                  className="form-control"
                  value={invoiceMeta.payment_mode || 'cash'}
                  onChange={(e) => setInvoiceMeta((prev) => ({ ...prev, payment_mode: e.target.value }))}
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <div className="col-12">
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf"
                  onChange={handleInvoiceFileChange}
                />
              </div>
              <div className="col-12 d-flex gap-2 align-items-center">
                <div className="d-flex gap-2 align-items-center">
                  <label className="m-0">Margin %</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: 90 }}
                    value={invoiceMargin}
                    onChange={(e) => setInvoiceMargin(Number(e.target.value || 0))}
                  />
                </div>
                <button className="btn btn-outline-primary btn-sm" onClick={applyMarginToAll}>
                  Apply margin to all
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleInvoiceUpload} disabled={invoiceLoading}>
                  {invoiceLoading ? 'Parsing...' : 'Upload & Parse'}
                </button>
              </div>
            </div>
            {invoiceError && (
              <p className="text-danger mt-2">{invoiceError}</p>
            )}
            {invoiceItems.length > 0 && (
              <div className="invoice-table-wrapper mt-3">
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>HSN</th>
                      <th>Qty</th>
                      <th>Purchase Price</th>
                      <th>GST %</th>
                      <th>Batch</th>
                      <th>Expiry</th>
                      <th>Selling Price</th>
                      <th>Update Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.map((row, index) => {
                      const cols = [
                        { key: 'name', type: 'text' },
                        { key: 'hsn', type: 'text' },
                        { key: 'qty', type: 'number' },
                        { key: 'purchase_price', type: 'number' },
                        { key: 'gst_percent', type: 'number' },
                        { key: 'batch_number', type: 'text' },
                        { key: 'expiry_date', type: 'date' },
                        { key: 'selling_price', type: 'number' }
                      ];
                      return (
                        <tr key={`invoice-row-${index}`} className={!Number(row.selling_price || 0) ? 'missing-price' : ''}>
                          {cols.map((col, colIndex) => {
                            const order = index * cols.length + colIndex;
                            const profitPerUnit =
                              col.key === 'selling_price'
                                ? computeProfitPerUnit(row.purchase_price, row.selling_price)
                                : null;
                            return (
                              <td key={`${col.key}-${index}`}>
                                <input
                                  data-invoice-order={order}
                                  onKeyDown={handleInvoiceKeyDown}
                                  type={col.type}
                                  className="form-control form-control-sm"
                                  value={row[col.key] ?? ''}
                                  onChange={(e) => handleInvoiceRowChange(index, col.key, e.target.value)}
                                />
                                {col.key === 'selling_price' && (
                                  <div className="invoice-price-hint">
                                    {row.existing_selling_price ? (
                                      <span>Old: â‚¹{row.existing_selling_price}</span>
                                    ) : (
                                      <span>Old: -</span>
                                    )}
                                    {row.suggested_selling_price ? (
                                      <span>Suggested: â‚¹{row.suggested_selling_price}</span>
                                    ) : null}
                                    {profitPerUnit !== null ? (
                                      <span className={profitPerUnit < 0 ? 'text-danger' : 'text-success'}>
                                        Profit/unit: â‚¹{profitPerUnit}
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(row.update_price)}
                              onChange={(e) => handleInvoiceRowChange(index, 'update_price', e.target.checked)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="purchase-modal-actions mt-3">
              <button className="btn btn-outline-secondary" onClick={closeInvoiceModal}>
                Close
              </button>
              <button
                className="btn btn-outline-primary"
                onClick={() => handleInvoiceSave(false)}
                disabled={invoiceSaving || invoiceItems.length === 0}
              >
                {invoiceSaving ? 'Saving...' : 'Save Purchase'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleInvoiceSave(true)}
                disabled={invoiceSaving || invoiceItems.length === 0}
              >
                {invoiceSaving ? 'Saving...' : 'Save + Update Selling Price'}
              </button>
            </div>
          </div>
        </div>
      )}
      {barcodeCreateOpen && (
        <div className="purchase-modal-overlay" onClick={closeBarcodeCreateModal}>
          <div className="purchase-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Create Product</h4>
            <div className="row g-3">
              <div className="col-12">
                <label>Barcode</label>
                <input
                  className="form-control"
                  value={barcodeCreateData.barcode || ''}
                  readOnly
                />
              </div>
              <div className="col-md-6">
                <label>Name</label>
                <input
                  className="form-control"
                  placeholder="Product Name"
                  value={barcodeCreateData.product_name || ''}
                  onChange={(e) => handleBarcodeCreateChange('product_name', e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label>Company</label>
                <input
                  className="form-control"
                  placeholder="Company"
                  value={barcodeCreateData.company || ''}
                  onChange={(e) => handleBarcodeCreateChange('company', e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label>Category</label>
                <input
                  list="barcode-categories-list"
                  className="form-control"
                  placeholder="Category"
                  value={barcodeCreateData.category || ''}
                  onChange={(e) => handleBarcodeCreateChange('category', e.target.value)}
                />
                <datalist id="barcode-categories-list">
                  {categories.data && categories.data.map((cat, idx) => (
                    <option key={idx} value={cat.category} />
                  ))}
                </datalist>
              </div>
              <div className="col-md-6">
                <label>Stock Quantity</label>
                <input
                  className="form-control"
                  type="number"
                  placeholder="Stock Quantity"
                  value={barcodeCreateData.stock_quantity || ''}
                  onChange={(e) => handleBarcodeCreateChange('stock_quantity', e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label>Selling Price</label>
                <input
                  className="form-control"
                  type="number"
                  placeholder="Selling Price"
                  value={barcodeCreateData.selling_price || ''}
                  onChange={(e) => handleBarcodeCreateChange('selling_price', e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label>Purchase Price</label>
                <input
                  className="form-control"
                  type="number"
                  placeholder="Purchase Price"
                  value={barcodeCreateData.purchase_price || ''}
                  onChange={(e) => handleBarcodeCreateChange('purchase_price', e.target.value)}
                />
              </div>
            </div>
            <div className="purchase-modal-actions">
              <button className="btn btn-outline-secondary" onClick={closeBarcodeCreateModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleBarcodeCreateSubmit} disabled={isBarcodeCreating}>
                {isBarcodeCreating ? 'Saving...' : 'Create & Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateOrderPage;




