import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import api from '../../utils/axios';
import { normalizeDisplayProduct, searchLocalProducts } from '../../utils/localProductSearch';
import { useBranchStore } from '../../store/branchStore';
import { useWhatsappStore } from '../../store/whatsappStore';
import { sendBillViaWhatsApp } from '../../services/whatsappService';
import CameraBarcodeScannerModal from '../../components/Billing/CameraBarcodeScannerModal';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';

const DRAFT_KEY = 'mobile_billing_draft_v1';
const UPI_ID_KEY = 'mobile_upi_id_v1';

const createEmptyItem = (itemNumber = 1) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  itemNumber,
  productId: null,
  barcode: '',
  name: '',
  stock: null,
  qty: 1,
  price: 0,
  discount: 0,
});

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const mapSearchProduct = (product) => ({
  ...product,
  name: product?.name || product?.product_name || '',
  price: Number(product?.selling_price ?? product?.price ?? product?.purchase_price ?? 0),
  stock: Number(product?.stock_quantity ?? product?.stock ?? product?.quantity ?? 0),
});

const BillingMobile = () => {
  const userDetails = useSelector((state) => state.user.userDetails);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const whatsappEnabled = useWhatsappStore((state) => state.whatsappEnabled);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [billingType, setBillingType] = useState('retail');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [upiId, setUpiId] = useState(() => window.localStorage.getItem(UPI_ID_KEY) || '');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [upiReference, setUpiReference] = useState('');
  const [taxPercent, setTaxPercent] = useState(18);
  const [extraDiscount, setExtraDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const nextItemNumberRef = useRef(1);
  const [items, setItems] = useState(() => [createEmptyItem(nextItemNumberRef.current++)]);
  const [activeSearch, setActiveSearch] = useState({ itemId: '', query: '' });
  const [searchingItemId, setSearchingItemId] = useState('');
  const [suggestionsByItem, setSuggestionsByItem] = useState({});
  const [scannerItemId, setScannerItemId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const getProductBranchId = (product) =>
    product?.branch_id ?? product?.branchId ?? product?.branch ?? null;

  const isProductInSelectedBranch = (product) => {
    if (!effectiveBranchId) return true;
    const branchId = getProductBranchId(product);
    if (!branchId) return true;
    return String(branchId) === String(effectiveBranchId);
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const searchRemoteProducts = async (queryText) => {
    const text = String(queryText || '').trim();
    if (!text) return [];

    // Keep contract aligned with desktop billing/backend expectations.
    try {
      const saleResponse = await api.get('/products/search/sale', {
        params: { name: text },
      });
      const saleList =
        saleResponse?.data?.data?.products ||
        saleResponse?.data?.products ||
        saleResponse?.data?.data ||
        [];
      if (Array.isArray(saleList) && saleList.length) {
        return saleList;
      }
    } catch {
      // try fallback endpoint below
    }

    try {
      const fallbackResponse = await api.get('/products/search', {
        params: {
          view: 'mobile',
          q: text,
          name: text,
        },
      });
      const fallbackList =
        fallbackResponse?.data?.data?.products ||
        fallbackResponse?.data?.products ||
        fallbackResponse?.data?.data ||
        [];
      return Array.isArray(fallbackList) ? fallbackList : [];
    } catch {
      return [];
    }
  };

  const selectedCreditLimit = Number(selectedCustomer?.credit_limit || 0);
  const selectedCurrentBalance = Number(selectedCustomer?.current_balance || 0);
  const availableCredit = Math.max(selectedCreditLimit - selectedCurrentBalance, 0);
  const isCreditEligible = Boolean(selectedCustomer?.id) && availableCredit > 0;

  useEffect(() => {
    const term = `${customerName} ${customerPhone}`.trim();
    if (!term || term.length < 2) {
      setCustomerSuggestions([]);
      setCustomerSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCustomerSearching(true);
      try {
        const response = await api.get('/customers', {
          params: {
            search: term,
            limit: 8,
          },
        });
        const list =
          response?.data?.data?.customers ||
          response?.data?.customers ||
          response?.data?.data ||
          [];
        if (!cancelled) {
          setCustomerSuggestions(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!cancelled) {
          setCustomerSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setCustomerSearching(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerName, customerPhone]);

  useEffect(() => {
    if (paymentMode === 'credit' && !isCreditEligible) {
      setPaymentMode('cash');
    }
  }, [paymentMode, isCreditEligible]);

  useEffect(() => {
    if (paymentMode !== 'upi' && upiReference) {
      setUpiReference('');
    }
  }, [paymentMode, upiReference]);

  useEffect(() => {
    window.localStorage.setItem(UPI_ID_KEY, upiId);
  }, [upiId]);

  useEffect(() => {
    let cancelled = false;
    const loadShopDetails = async () => {
      try {
        const response = await api.get('/shop-details/me');
        const details = response?.data?.shop_details || response?.data?.data || {};
        const shopName = String(details?.shop_name || '').trim();
        const configuredUpiId = String(details?.upi_id || '').trim();
        if (!cancelled && shopName) {
          setUpiPayeeName(shopName);
        }
        if (!cancelled && configuredUpiId && !String(upiId || '').trim()) {
          setUpiId(configuredUpiId);
        }
      } catch {
        if (!cancelled) {
          setUpiPayeeName('');
        }
      }
    };
    loadShopDetails();
    return () => {
      cancelled = true;
    };
  }, [upiId]);

  const addItem = () => setItems((prev) => [createEmptyItem(nextItemNumberRef.current++), ...prev]);
  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSuggestionsByItem((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  useEffect(() => {
    const itemId = String(activeSearch.itemId || '');
    const query = String(activeSearch.query || '').trim();
    if (!itemId || !query || query.length < 2) {
      if (itemId) {
        setSuggestionsByItem((prev) => ({ ...prev, [itemId]: [] }));
      }
      setSearchingItemId('');
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchingItemId(itemId);
      try {
        const localResults = await searchLocalProducts(query);
        const localMapped = (Array.isArray(localResults) ? localResults : [])
          .map(normalizeDisplayProduct)
          .map(mapSearchProduct)
          .filter(isProductInSelectedBranch);

        if (localMapped.length > 0) {
          if (!cancelled) {
            setSuggestionsByItem((prev) => ({ ...prev, [itemId]: localMapped.slice(0, 6) }));
          }
          return;
        }

        const remoteList = await searchRemoteProducts(query);
        const remoteMapped = (Array.isArray(remoteList) ? remoteList : [])
          .map(mapSearchProduct)
          .filter(isProductInSelectedBranch);

        if (!cancelled) {
          setSuggestionsByItem((prev) => ({ ...prev, [itemId]: remoteMapped.slice(0, 6) }));
        }
      } catch {
        if (!cancelled) {
          setSuggestionsByItem((prev) => ({ ...prev, [itemId]: [] }));
        }
      } finally {
        if (!cancelled) {
          setSearchingItemId('');
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSearch]);

  const applySuggestion = (itemId, product) => {
    const productId = product?.id ?? product?.product_id ?? product?.productId ?? null;
    const name = product?.name || product?.product_name || '';
    const barcode = product?.barcode || '';
    const nextPrice = Number(product?.selling_price ?? product?.price ?? product?.purchase_price ?? 0);
    const stock = Number(product?.stock_quantity ?? product?.stock ?? product?.quantity ?? 0);

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productId,
              barcode,
              name,
              stock: Number.isFinite(stock) ? stock : null,
              price: Number.isFinite(nextPrice) ? nextPrice : item.price,
            }
          : item
      )
    );
    setSuggestionsByItem((prev) => ({ ...prev, [itemId]: [] }));
    setActiveSearch({ itemId: '', query: '' });
  };

  const handleCameraDetected = async (code) => {
    const scannedCode = String(code || '').trim();
    const itemId = String(scannerItemId || '');
    if (!itemId || !scannedCode) return;

    updateItem(itemId, 'name', scannedCode);
    updateItem(itemId, 'barcode', scannedCode);
    setActiveSearch({ itemId, query: scannedCode });
    setSearchingItemId(itemId);
    setMessage('');

    try {
      const localResults = await searchLocalProducts(scannedCode);
      let products = (Array.isArray(localResults) ? localResults : [])
        .map(normalizeDisplayProduct)
        .map(mapSearchProduct)
        .filter(isProductInSelectedBranch);

      if (products.length === 0 && navigator.onLine) {
        const remoteList = await searchRemoteProducts(scannedCode);
        products = (Array.isArray(remoteList) ? remoteList : [])
          .map(mapSearchProduct)
          .filter(isProductInSelectedBranch);
      }

      const exactMatch =
        products.find((product) => String(product?.barcode || '').trim() === scannedCode) ||
        (products.length === 1 ? products[0] : null);

      if (exactMatch) {
        applySuggestion(itemId, exactMatch);
        return;
      }

      setSuggestionsByItem((prev) => ({ ...prev, [itemId]: products.slice(0, 6) }));
      if (products.length === 0) {
        setMessage('No product found for scanned barcode.');
      }
    } catch {
      setSuggestionsByItem((prev) => ({ ...prev, [itemId]: [] }));
      setMessage('Could not search scanned barcode. Please try again.');
    } finally {
      setSearchingItemId('');
      setScannerItemId('');
    }
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const discount = Number(item.discount || 0);
      const gross = qty * price;
      return acc + Math.max(gross - discount, 0);
    }, 0);

    const lineDiscount = items.reduce((acc, item) => acc + Number(item.discount || 0), 0);
    const orderDiscount = Number(extraDiscount || 0);
    const taxable = Math.max(subtotal - orderDiscount, 0);
    const taxAmount = (taxable * Number(taxPercent || 0)) / 100;
    const grandTotal = taxable + taxAmount;

    return { subtotal, lineDiscount, orderDiscount, taxable, taxAmount, grandTotal };
  }, [extraDiscount, items, taxPercent]);

  const upiIntent = useMemo(() => {
    if (paymentMode !== 'upi') return '';
    const cleanedUpiId = String(upiId || '').trim();
    const amount = Number(totals.grandTotal || 0);
    if (!cleanedUpiId || amount <= 0) return '';
    const payeeName = String(upiPayeeName || userDetails?.name || 'SHAJ Retail').trim();
    return `upi://pay?pa=${encodeURIComponent(cleanedUpiId)}&pn=${encodeURIComponent(
      payeeName
    )}&am=${encodeURIComponent(amount.toFixed(2))}&cu=INR`;
  }, [paymentMode, upiId, upiPayeeName, totals.grandTotal, userDetails?.name]);

  const upiQrImageUrl = useMemo(() => {
    if (!upiIntent) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      upiIntent
    )}`;
  }, [upiIntent]);

  const saveDraft = () => {
    const payload = {
      customerName,
      customerPhone,
      selectedCustomer,
      billingType,
      paymentMode,
      taxPercent,
      extraDiscount,
      notes,
      items,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setMessage('Billing draft saved on this device.');
    setTimeout(() => setMessage(''), 2200);
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomer(null);
    setCustomerSuggestions([]);
    setCustomerSearching(false);
    setPaymentMode('cash');
    setUpiReference('');
    setTaxPercent(18);
    setExtraDiscount(0);
    setNotes('');
    nextItemNumberRef.current = 1;
    setItems([createEmptyItem(nextItemNumberRef.current++)]);
    setActiveSearch({ itemId: '', query: '' });
    setSearchingItemId('');
    setSuggestionsByItem({});
  };

  const applyCustomerSuggestion = (customer) => {
    const customerId = customer?.id ?? customer?.customer_id ?? null;
    const phone = customer?.phone ?? customer?.mobile ?? '';
    const name = customer?.name ?? '';
    const creditLimit = Number(customer?.credit_limit || 0);
    const currentBalance = Number(customer?.current_balance || 0);
    const normalized = {
      ...customer,
      id: customerId,
      name,
      phone,
      mobile: phone,
      credit_limit: Number.isFinite(creditLimit) ? creditLimit : 0,
      current_balance: Number.isFinite(currentBalance) ? currentBalance : 0,
    };
    setSelectedCustomer(normalized);
    setCustomerName(name);
    setCustomerPhone(phone);
    setCustomerSuggestions([]);
  };

  const createBill = async () => {
    if (isSubmitting) return;
    if (!navigator.onLine) {
      setMessage('You are offline. Connect internet to create bill in backend.');
      return;
    }
    if (!effectiveBranchId) {
      setMessage('Please select a branch before creating bill.');
      return;
    }

    const validItems = items
      .map((item) => ({
        product_id: item.productId ?? null,
        quantity: Number(item.qty || 0),
        price: Number(item.price || 0),
      }))
      .filter((item) => item.quantity > 0);

    if (!validItems.length) {
      setMessage('Add at least one item with quantity before creating bill.');
      return;
    }

    const missingProduct = validItems.find((item) => !item.product_id);
    if (missingProduct) {
      setMessage('Please pick products from search suggestions before creating bill.');
      return;
    }

    const sourceItemByProductId = new Map(
      items
        .filter((item) => item?.productId)
        .map((item) => [String(item.productId), item])
    );
    const stockIssue = validItems.find((item) => {
      const source = sourceItemByProductId.get(String(item.product_id));
      const stock = Number(source?.stock);
      if (!Number.isFinite(stock) || stock < 0) return false;
      return item.quantity > stock;
    });
    if (stockIssue) {
      const source = sourceItemByProductId.get(String(stockIssue.product_id));
      const name = source?.name || `Product ID ${stockIssue.product_id}`;
      const stock = Number(source?.stock || 0);
      setMessage(`Insufficient stock for ${name}. Requested ${stockIssue.quantity}, available ${stock}.`);
      return;
    }

    if (String(paymentMode || '').toLowerCase() === 'credit') {
      if (!selectedCustomer?.id) {
        setMessage('Select an eligible customer before using credit payment.');
        return;
      }
      if (!isCreditEligible) {
        setMessage('Credit not allowed for selected customer.');
        return;
      }
      if (Number(totals.grandTotal || 0) > availableCredit) {
        setMessage(`Credit limit exceeded. Available credit is Rs ${formatCurrency(availableCredit)}.`);
        return;
      }
    }

    const resolvedPaymentMode = String(paymentMode || 'cash').toLowerCase();

    const payload = {
      type: 'sale',
      transaction_type: 'sale',
      billing_type: billingType === 'wholesale' ? 'wholesale' : 'retail',
      payment_method: resolvedPaymentMode,
      payment: resolvedPaymentMode,
      branch_id: effectiveBranchId,
      user_id: userDetails?.id || undefined,
      customer_id: selectedCustomer?.id || undefined,
      customer_name: customerName?.trim() || 'Walk-in',
      customer_phone: customerPhone?.trim() || undefined,
      customer_address: notes?.trim() || undefined,
      is_gst_enabled: Number(taxPercent || 0) > 0,
      gst_mode: 'INCLUSIVE',
      discount_type: 'flat',
      discount: Number(extraDiscount || 0),
      discount_total: Number(extraDiscount || 0),
      gst_amount: Number(totals.taxAmount || 0),
      total_amount: Number(totals.grandTotal || 0),
      payments:
        resolvedPaymentMode === 'credit'
          ? []
          : [
              {
                client_payment_id:
                  typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                amount_paid: Number(totals.grandTotal || 0),
                payment_mode: resolvedPaymentMode,
                notes: resolvedPaymentMode === 'upi' && upiReference
                  ? `UPI Ref: ${upiReference}`
                  : undefined,
                created_at: new Date().toISOString(),
              },
            ],
      products: validItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        gst_percent: Number(taxPercent || 0),
      })),
    };

    setIsSubmitting(true);
    try {
      const response = await api.post('/orders', payload);
      const orderId = response?.data?.order_id || response?.data?.order?.id || response?.data?.id || '';
      const normalizedPhone = String(customerPhone || '').replace(/\D+/g, '');
      let statusMessage = orderId ? `Bill created successfully. Order #${orderId}` : 'Bill created successfully.';
      if (whatsappEnabled && orderId && normalizedPhone.length === 10) {
        try {
          await sendBillViaWhatsApp({ order_id: orderId, phone: normalizedPhone });
          statusMessage += ' Bill sent on WhatsApp.';
        } catch (error) {
          const waMessage = error?.response?.data?.error || error?.response?.data?.message;
          statusMessage += waMessage ? ` WhatsApp failed: ${waMessage}` : ' WhatsApp send failed.';
        }
      }
      resetForm();
      setMessage(statusMessage);
      setTimeout(() => setMessage(''), 2600);
    } catch (error) {
      const apiMessage = error?.response?.data?.message || error?.message;
      setMessage(apiMessage || 'Failed to create bill. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MobileShell title="Billing" subtitle="Create quick invoices with complete bill details from mobile.">
      <SectionCard title="Customer & Invoice">
        <div>
          <label className="mobile-label">Customer Name</label>
          <input
            className="mobile-field"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setSelectedCustomer(null);
            }}
            placeholder="Walk-in customer"
          />
        </div>
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Phone Number</label>
            <input
              className="mobile-field"
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value);
                setSelectedCustomer(null);
              }}
              placeholder="10-digit number"
            />
          </div>
          <div>
            <label className="mobile-label">Invoice Date</label>
            <input type="date" className="mobile-field" value={dayjs().format('YYYY-MM-DD')} readOnly />
          </div>
        </div>
        {customerSearching ? (
          <p className="mobile-muted" style={{ margin: 0, fontSize: 11 }}>Searching customer...</p>
        ) : null}
        {customerSuggestions.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {customerSuggestions.map((customer, index) => (
              <button
                key={`${customer?.id || customer?.phone || 'customer'}-${index}`}
                type="button"
                className="mobile-chip"
                style={{ justifyContent: 'space-between', width: '100%', padding: '8px 10px', borderRadius: 10 }}
                onClick={() => applyCustomerSuggestion(customer)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {customer?.name || 'Customer'} ({customer?.phone || customer?.mobile || 'No phone'})
                </span>
                <span style={{ marginLeft: 8 }}>
                  Credit: Rs {formatCurrency(Number(customer?.credit_limit || 0))}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {selectedCustomer?.id ? (
          <p className="mobile-muted" style={{ margin: 0, fontSize: 11 }}>
            Selected: {selectedCustomer.name} | Available Credit: Rs {formatCurrency(availableCredit)}
          </p>
        ) : (
          <p className="mobile-muted" style={{ margin: 0, fontSize: 11 }}>
            Credit option appears only after selecting an eligible customer.
          </p>
        )}
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Billing Type</label>
            <select className="mobile-field" value={billingType} onChange={(e) => setBillingType(e.target.value)}>
              <option value="retail">Retail Billing</option>
              <option value="wholesale">Wholesale Billing</option>
              <option value="gst">GST Invoice</option>
            </select>
          </div>
          <div>
            <label className="mobile-label">Payment Mode</label>
            <select className="mobile-field" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              {isCreditEligible && <option value="credit">Credit</option>}
            </select>
          </div>
        </div>
        {paymentMode === 'upi' ? (
          <div>
            <label className="mobile-label">UPI ID</label>
            <input
              className="mobile-field"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="example@upi"
            />
            {upiQrImageUrl ? (
              <div
                className="mobile-item"
                style={{ marginTop: 8, display: 'grid', justifyItems: 'center', gap: 6 }}
              >
                <img
                  src={upiQrImageUrl}
                  alt="UPI QR Code"
                  width={180}
                  height={180}
                  style={{ borderRadius: 10, border: '1px solid var(--mobile-border)', background: '#fff', padding: 8 }}
                />
                <p className="mobile-muted" style={{ margin: 0, fontSize: 11 }}>
                  Scan QR to pay Rs {formatCurrency(totals.grandTotal)}
                </p>
              </div>
            ) : (
              <p className="mobile-muted" style={{ margin: '6px 0 0', fontSize: 11 }}>
                Enter UPI ID to generate QR for this bill amount.
              </p>
            )}
            <label className="mobile-label">UPI Reference (Optional)</label>
            <input
              className="mobile-field"
              value={upiReference}
              onChange={(e) => setUpiReference(e.target.value)}
              placeholder="UPI UTR / txn reference"
            />
            <p className="mobile-muted" style={{ margin: '6px 0 0', fontSize: 11 }}>
              This bill will be marked as paid via UPI.
            </p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Line Items" action={<button type="button" className="mobile-chip" onClick={addItem}>+ Add item</button>}>
        {items.map((item, index) => (
          <article key={item.id} className="mobile-item" style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="mobile-card-title" style={{ margin: 0 }}>Item {item.itemNumber || index + 1}</p>
              {items.length > 1 ? (
                <button type="button" className="mobile-chip" onClick={() => removeItem(item.id)}>Remove</button>
              ) : null}
            </div>
            <div className="mobile-product-search-row">
              <input
                className="mobile-field"
                value={item.name}
                onChange={(e) => {
                  const value = e.target.value;
                  updateItem(item.id, 'name', value);
                  setActiveSearch({ itemId: item.id, query: value });
                }}
                placeholder="Product name / barcode"
              />
              <button
                type="button"
                className="mobile-camera-button"
                onClick={() => setScannerItemId(item.id)}
                aria-label="Scan product barcode using camera"
                title="Scan barcode"
              >
                Scan
              </button>
            </div>
            {searchingItemId === item.id ? (
              <p className="mobile-muted" style={{ margin: 0, fontSize: 11 }}>Searching...</p>
            ) : null}
            {(suggestionsByItem[item.id] || []).length > 0 ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {(suggestionsByItem[item.id] || []).map((product, suggestionIndex) => (
                  <button
                    key={`${product?.id || product?.barcode || product?.name || 'suggestion'}-${suggestionIndex}`}
                    type="button"
                    className="mobile-chip"
                    style={{ justifyContent: 'space-between', width: '100%', padding: '8px 10px', borderRadius: 10 }}
                    onClick={() => applySuggestion(item.id, product)}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product?.name || 'Product'}
                    </span>
                    <span style={{ marginLeft: 8 }}>
                      Rs {formatCurrency(product?.price ?? product?.selling_price ?? 0)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mobile-inline-grid">
              <div>
                <label className="mobile-label">Quantity</label>
                <input type="number" min="1" className="mobile-field" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} />
              </div>
              <div>
                <label className="mobile-label">Unit Price</label>
                <input type="number" min="0" className="mobile-field" value={item.price} onChange={(e) => updateItem(item.id, 'price', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mobile-label">Item Discount</label>
              <input type="number" min="0" className="mobile-field" value={item.discount} onChange={(e) => updateItem(item.id, 'discount', e.target.value)} />
            </div>
            {Number.isFinite(Number(item.stock)) ? (
              <p className="mobile-muted" style={{ margin: 0, fontSize: 11 }}>
                In stock: {Number(item.stock)}
              </p>
            ) : null}
          </article>
        ))}
      </SectionCard>

      <SectionCard title="Tax, Discount & Notes">
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Order Discount</label>
            <input type="number" min="0" className="mobile-field" value={extraDiscount} onChange={(e) => setExtraDiscount(e.target.value)} />
          </div>
          <div>
            <label className="mobile-label">Tax %</label>
            <input type="number" min="0" className="mobile-field" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mobile-label">Notes</label>
          <input className="mobile-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add delivery note, due date, etc." />
        </div>
      </SectionCard>

      <SectionCard title="Bill Summary">
        <div className="mobile-item" style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Subtotal</span><strong>Rs {formatCurrency(totals.subtotal)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Line discount</span><strong>Rs {formatCurrency(totals.lineDiscount)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Order discount</span><strong>Rs {formatCurrency(totals.orderDiscount)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Taxable amount</span><strong>Rs {formatCurrency(totals.taxable)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Tax amount</span><strong>Rs {formatCurrency(totals.taxAmount)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Payment mode</span><strong>{String(paymentMode || 'cash').toUpperCase()}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ fontWeight: 700 }}>Grand total</span><strong>Rs {formatCurrency(totals.grandTotal)}</strong></div>
        </div>
      </SectionCard>

      <SectionCard title="Actions">
        <button type="button" className="mobile-button" onClick={createBill} disabled={isSubmitting}>
          {isSubmitting ? 'Creating Bill...' : 'Create Bill (Sync Backend)'}
        </button>
        <button type="button" className="mobile-button" onClick={saveDraft}>Save Draft Bill</button>
        {message ? <p className="mobile-muted" style={{ margin: '2px 0 0', fontSize: 11 }}>{message}</p> : null}
      </SectionCard>
      <CameraBarcodeScannerModal
        open={Boolean(scannerItemId)}
        onClose={() => setScannerItemId('')}
        onDetected={handleCameraDetected}
      />
    </MobileShell>
  );
};

export default BillingMobile;
