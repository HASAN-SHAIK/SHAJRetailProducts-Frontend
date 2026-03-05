import React, { useEffect, useRef, useState } from 'react';
import api from '../utils/axios';
import { useNavigate } from 'react-router-dom';
import { usePopup } from '../components/common/PopUp/PopupProvider';
import { useDispatch, useSelector } from 'react-redux';
import { clearOrderDetails, setOrderDetails } from '../store/orderSlice';
import { enqueueOfflineOrder } from '../utils/offlineOrders';
import { saveProductsCache, searchCachedProducts } from '../utils/offlineProducts';
import { loadCategoriesCache, saveCategoriesCache } from '../utils/offlineCategories';
import './CreateOrderPage.css';

const CreateOrderPage = () => {
  const [categories, setCategories] = useState([]);
  const [saleMethods, setSaleMethods] = useState(['sale', 'purchase', 'personal']);
  const userDetails = useSelector((state) => state.user.userDetails);
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const features = tenantConfig?.features || tenantConfig?.plan_features || tenantConfig || {};
  const [transactionType, setTransactionType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [products, setProducts] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [personalAmount, setPersonalAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isBarcodeAdding, setIsBarcodeAdding] = useState(false);
  const barcodeInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseModalData, setPurchaseModalData] = useState({});
  const [purchaseModalSuggestions, setPurchaseModalSuggestions] = useState([]);
  const purchaseModalSearchTimerRef = useRef(null);
  const latestPurchaseModalSearchRef = useRef('');
  const orderDetails = useSelector((state) => state.order.orderDetails);
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
          };
        });
        setProducts(reconstructedProducts);
        setTransactionType(orderDetails.type);
        setTotalAmount(parseFloat(orderDetails.total_price));
        setPaymentMethod(orderDetails.payment);
        setPersonalAmount(orderDetails.personal_amount || '');
        setCustomerName(orderDetails.customer_name || '');
        setCustomerPhone(orderDetails.customer_phone || '');
        setCustomerAddress(orderDetails.customer_address || '');
        setCustomerLocation(orderDetails.customer_location || orderDetails.location || '');
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
          const productsRes = await api.get('/products');
          saveProductsCache(productsRes.data);
        } catch (err) {
          console.log('Failed to cache products for offline search', err);
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
    setPaymentMethod('');
    setPersonalAmount('');
  }
}, [transactionType, userDetails.role]);
useEffect(() => {
  if (!orderDetails) {
    dispatch(clearOrderDetails()); // Clear order details on mount when not editing
  }
}, [dispatch, orderDetails]);

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
    setTransactionType(e.target.value);
    setProducts([]);
    setTotalAmount(0);
    setPaymentMethod('');
    setPersonalAmount('');
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
    actual_price: '',
    selling_price: '',
    category: '',
    time_for_delivery: '',
    is_weight_based: weightBasedEnabled && !pieceBasedEnabled ? 1 : 0,
    product_id: null,
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

  const handlePaymentMethodChange = (e) => setPaymentMethod(e.target.value);

  const handleCustomerSearch = async (text) => {
    latestSearchRef.current.customer = text;
    if (text.length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    try {
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
      setCustomerSuggestions(Array.isArray(results) ? results : []);
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
      if (!navigator.onLine) {
        const suggestions = searchCachedProducts(text);
        const filtered = filterByProductType(suggestions);
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
      const suggestions = searchCachedProducts(text);
      const filtered = filterByProductType(suggestions);
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
    if (!navigator.onLine) {
      const suggestions = filterByProductType(searchCachedProducts(text));
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
    const suggestions = filterByProductType(searchCachedProducts(text));
    const filtered = suggestions;
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
    actual_price: product.actual_price,
    selling_price: product.selling_price,
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
      if (!navigator.onLine) {
        const suggestions = filterByProductType(searchCachedProducts(text));
        if (latestPurchaseModalSearchRef.current !== text) return;
        setPurchaseModalSuggestions(suggestions);
        return;
      }
      const response = await api.get(buildSearchUrl(text, 'purchase'));
      const results = response?.data?.products || response?.data?.data || response?.data || [];
      const filtered = filterByProductType(results);
      if (latestPurchaseModalSearchRef.current !== text) return;
      setPurchaseModalSuggestions(Array.isArray(filtered) ? filtered : []);
    } catch (err) {
      const suggestions = filterByProductType(searchCachedProducts(text));
      if (latestPurchaseModalSearchRef.current !== text) return;
      setPurchaseModalSuggestions(suggestions);
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
      actual_price: product.actual_price,
      selling_price: product.selling_price,
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
      if (!data.quantity || !data.actual_price || !data.selling_price) {
        showPopup('Enter quantity, actual price, and selling price', 'Validation');
        return;
      }
    } else {
      if (!data.product_name || !data.company || !data.quantity || !data.actual_price || !data.selling_price || !data.category || !data.time_for_delivery) {
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
    if (Number(data.selling_price) < Number(data.actual_price)) {
      showPopup('Actual Price is Less than Selling price', 'Validation');
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
    const actual = product?.actual_price ?? '-';
    const category = product?.category || '-';
    const delivery = product?.time_for_delivery ?? '-';
    const typeLabel = resolveIsWeightBased(product) ? 'Weight' : 'Piece';
    return `${name} | ${company} | Sell: ${selling} | Actual: ${actual} | Type: ${typeLabel} | Delivery: ${delivery} | Cat: ${category}`;
  };

  const handleBarcodeSearch = async () => {
    const code = barcodeInput.trim();
    if (!code) return;
    if (isBarcodeAdding) return;
    if (transactionType !== 'sale' && transactionType !== 'purchase') {
      showPopup('Barcode search is only for sales or purchases.', 'Validation');
      return;
    }
    try {
      setIsBarcodeAdding(true);
      const barcodeMode = transactionType === 'purchase' ? 'purchase' : 'sale';
      const res = await api.get(buildBarcodeUrl(code, barcodeMode));
      let product = res?.data?.product || res?.data?.data || res?.data;
      if (Array.isArray(product)) product = product[0];
      if (!product) {
        showPopup('Product not found', 'Validation');
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
        const updated = [
          ...products,
          {
            product_name: product.name,
            id: product.id,
            quantity: '',
            suggestions: [],
            selling_price: product.selling_price,
      is_weight_based: product.is_weight_based ?? product.type ?? 0,
            stock_quantity: product.stock_quantity ?? null,
          },
        ];
        setProducts(updated);
        calculateTotal(updated);
      } else {
        openPurchaseModal({
          product_name: product.name,
          company: product.company,
          quantity: 1,
          actual_price: product.actual_price,
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
      showPopup('Barcode lookup failed', 'Error');
    } finally {
      setIsBarcodeAdding(false);
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
        return sum + (parseFloat(p.quantity || 0) * parseFloat(p.actual_price || 0));
      }, 0);
      setTotalAmount(total);
    }
  };

  const handleSubmit = async (key) => {
    if(key === 0) {
      navigate('/orders');
      dispatch(clearOrderDetails());
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
          if (!p.quantity || !p.actual_price || !p.selling_price) {
            showPopup('Enter quantity, actual price, and selling price', 'Validation');
            return;
          }
        } else {
          if (!p.product_name || !p.company || !p.quantity || !p.actual_price || !p.selling_price || !p.category || !p.time_for_delivery) {
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
        if (p.selling_price < p.actual_price) {
          showPopup('Actual Price is Less than Selling price', 'Validation');
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

    const enqueueAndExit = (isUpdate) => {
      const entry = isUpdate
        ? { type: 'update', orderId: orderDetails.id, payload: updatePayload }
        : { type: 'create', payload: createPayload };
      enqueueOfflineOrder(entry);
      showPopup('Offline: Order saved and will sync when you are online.', 'Offline');
      dispatch(clearOrderDetails());
      navigate('/orders');
    };

    try {

      if (!navigator.onLine) {
        enqueueAndExit(Boolean(orderDetails));
        return;
      }

      setIsLoading(true);
      if(orderDetails) {
        await api.put(`/orders/${orderDetails.id}`, updatePayload);
        dispatch(clearOrderDetails());
        navigate('/orders');
        showPopup('Order Updated!!', 'Success');
        return;
      }
      
      // For new orders
      await api.post('/orders', createPayload);
      showPopup('Order Placed!!', 'Success');
      navigate('/orders');
    } catch (err) {
      if (!err?.response) {
        enqueueAndExit(Boolean(orderDetails));
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
      <div className="order-shell wow-content">
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
                onChange={(e) => setCustomerLocation(e.target.value)}
              />
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
              {isBarcodeAdding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {transactionType === 'sale' && products.map((p, index) => (
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
                  <small className={Number(p.stock_quantity) < 5 ? 'text-danger' : 'text-muted'}>
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
                    </li>
                    : <li className="list-group-item list-group-item-action text-danger" disabled>
                      {s.name + '(Out Of Stock)'}
                    </li>
                ))}
              </ul>
            )}
          </div>
          <div className="col-md-2">
            {/* <label className="form-label small text-uppercase text-muted">
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
          <div className="col-md-1 d-flex align-items-center">
            <button className="btn btn-danger btn-sm" onClick={() => removeProductRow(index)}>×</button>
          </div>
        </div>
      ))}

  {transactionType === 'purchase' && products.map((p, index) => (
  <div className="row mb-2" key={index}>
    {['product_name', 'company', 'is_weight_based', 'quantity', 'actual_price', 'selling_price', 'category', 'time_for_delivery'].map((field) => (
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
      <button className="btn btn-danger btn-sm" onClick={() => removeProductRow(index)}>×</button>
    </div>
  </div>
))}


      {transactionType && transactionType !== 'personal' && (
        <div className="mb-3">
          <button className="btn btn-success" onClick={handleAddProductRow}>Add Product</button>
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
          <strong>Total: ₹{totalAmount.toFixed(2)}</strong>
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
                <label>Actual Price</label>
                <input
                  className="form-control"
                  placeholder="Actual Price"
                  value={purchaseModalData.actual_price || ''}
                  onChange={(e) => handlePurchaseModalChange('actual_price', e.target.value)}
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
    </div>
  );
};

export default CreateOrderPage;

