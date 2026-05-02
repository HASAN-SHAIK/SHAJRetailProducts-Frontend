import React, { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { useBillingStore } from '../../store/billingStore';
import { useBranchStore } from '../../store/branchStore';
import {
  addSyncQueueItem,
  getAllCustomers,
  getProductByBarcode,
  updateProductsBulk,
  upsertCustomerLocal,
  upsertCustomersBulk,
} from '../../core/db';
import { searchLocalProducts } from '../../utils/localProductSearch';
import { enqueueOfflineOrder, processOfflineQueue } from '../../utils/offlineOrders';
import { syncAllCustomers } from '../../utils/customersSync';
import api from '../../utils/axios';
import CartList from '../../components/Billing/CartList';
import BarcodeInput from '../../components/Billing/BarcodeInput';
import ProductSearch from '../../components/Billing/ProductSearch';
import { GST_MODES, resolveGstModeFromConfig } from '../../services/gstService';
import { hasFeature } from '../../utils/entitlements';
import '../BillingPage.css';

const WholesaleBilling = () => {
  const { showPopup } = usePopup();
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const userDetails = useSelector((state) => state.user.userDetails);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const branchConfirmed = useBranchStore((state) => state.branchConfirmed);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;
  const isAdminUser = String(userDetails?.role || '').toLowerCase() === 'admin';
  const canRevealActualPrice =
    isAdminUser &&
    hasFeature(tenantConfig, 'billing_actual_price_module');

  const items = useBillingStore((state) => state.items);
  const selectedKey = useBillingStore((state) => state.selectedKey);
  const isGSTEnabled = useBillingStore((state) => state.isGSTEnabled);
  const setGSTEnabled = useBillingStore((state) => state.setGSTEnabled);
  const gstMode = useBillingStore((state) => state.gstMode);
  const setGstMode = useBillingStore((state) => state.setGstMode);
  const addItem = useBillingStore((state) => state.addItem);
  const updateQty = useBillingStore((state) => state.updateQty);
  const updatePrice = useBillingStore((state) => state.updatePrice);
  const removeItem = useBillingStore((state) => state.removeItem);
  const selectItem = useBillingStore((state) => state.selectItem);
  const clearCart = useBillingStore((state) => state.clearCart);

  const [barcodeValue, setBarcodeValue] = useState('');
  const [quantityValue, setQuantityValue] = useState('1');
  const [searchText, setSearchText] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isItemAdding, setIsItemAdding] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customer, setCustomer] = useState({
    id: null,
    name: '',
    phone: '',
    type: 'wholesale',
    credit_limit: 0,
    current_balance: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const customerSearchRef = useRef(null);

  const buildCustomerPayload = (details) => {
    const name = String(details?.name || '').trim();
    const phone = String(details?.phone || details?.mobile || '').trim();
    if (!name && !phone) return null;
    const normalizedPhone = phone.replace(/\D+/g, '');
    return {
      name,
      mobile: normalizedPhone || phone,
      phone: normalizedPhone || phone,
      address: details?.address?.trim() || details?.address || null,
      location: details?.location?.trim() || details?.location || null,
      type: details?.type || 'wholesale',
      is_active: true,
    };
  };

  const queueCustomerSync = async (details) => {
    const payload = buildCustomerPayload(details);
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

  const barcodeRef = useRef(null);
  const searchTimerRef = useRef(null);
  const latestSearchRef = useRef('');

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const base = Number(item.basePrice ?? item.base_price ?? 0);
      if (Number.isFinite(base) && base > 0) return sum + base;
      return sum + Number(item.price || 0) * Number(item.qty || 0);
    }, 0);
    const gstTotal = isGSTEnabled
      ? items.reduce((sum, item) => sum + Number(item.gstAmount ?? item.gst_amount ?? 0), 0)
      : 0;
    const grandTotal = subtotal + gstTotal;
    return { subtotal, gstTotal, grandTotal };
  }, [items, isGSTEnabled]);

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

  const ensureBranchMatch = (product) => {
    if (!effectiveBranchId) {
      showPopup('Select a branch before billing. Added anyway.', 'Validation');
      return true;
    }
    const productBranchId =
      product?.branch_id || product?.branchId || product?.branch || null;
    if (productBranchId && String(productBranchId) !== String(effectiveBranchId)) {
      showPopup('Product belongs to another branch.', 'Branch');
      return false;
    }
    return true;
  };

  const buildSearchUrl = (text) => `/products/search/sale?name=${encodeURIComponent(text)}`;
  const buildBarcodeUrl = (barcode) => `/products/barcode/sale?barcode=${encodeURIComponent(barcode)}`;

  const extractProductFromResponse = (response) => {
    if (!response) return null;
    const data = response?.data;
    if (!data) return null;
    if (Array.isArray(data)) return data[0] || null;
    if (Array.isArray(data.products)) return data.products[0] || null;
    return data.product || data.data || data;
  };

  const findProduct = async (barcode) => {
    const cached = await getProductByBarcode(barcode);
    if (cached) return cached;
    if (!navigator.onLine) return null;
    try {
      let product = null;
      try {
        const response = await api.get(buildBarcodeUrl(barcode));
        product = extractProductFromResponse(response);
      } catch {
        // ignore
      }
      if (product) {
        await updateProductsBulk([product]);
      }
      return product;
    } catch {
      return null;
    }
  };

  const handleScan = async (inputCode = null) => {
    const code = String(inputCode ?? barcodeValue).trim();
    if (!code || isItemAdding) return;
    setIsItemAdding(true);
    try {
      const qty = Number(quantityValue || 1);
      const product = await findProduct(code);
      if (!product) {
        showPopup('Product not found.', 'Not Found');
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
    if (!customer.name.trim() || !customer.phone.trim()) {
      showPopup('Customer name and phone are required.', 'Validation');
      return;
    }
    const linkedCustomerId =
      customer.id || (customer.name || customer.phone ? await queueCustomerSync(customer) : null);
    if (!linkedCustomerId) {
      showPopup('Select a saved customer for wholesale billing.', 'Validation');
      return;
    }
    const creditUsed = paymentMethod === 'credit' ? totals.grandTotal : 0;
    if (creditUsed > 0) {
      const creditLimit = Number(customer.credit_limit || 0);
      const currentBalance = Number(customer.current_balance || 0);
      if (creditLimit <= 0) {
        showPopup('Credit not allowed for this customer.', 'Validation');
        return;
      }
      if (currentBalance + creditUsed > creditLimit) {
        showPopup('Customer credit limit exceeded.', 'Validation');
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const isCredit = paymentMethod === 'credit';
      const payments = !isCredit
        ? [
            {
              client_payment_id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              amount_paid: totals.grandTotal,
              payment_mode: paymentMethod,
              created_at: new Date().toISOString(),
            },
          ]
        : [];
      const payload = {
        type: 'sale',
        transaction_type: 'sale',
        billing_type: 'wholesale',
        customer_id: linkedCustomerId || undefined,
        payment_method: paymentMethod,
        payment: paymentMethod,
        is_gst_enabled: isGSTEnabled,
        gst_mode: gstMode,
        branch_id: effectiveBranchId,
        customer_name: customer.name.trim(),
        customer_phone: customer.phone.trim(),
        total_amount: totals.grandTotal,
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
      await enqueueOfflineOrder({ type: 'create', payload });
      if (creditUsed > 0 && linkedCustomerId) {
        try {
          await upsertCustomersBulk([
            {
              ...customer,
              id: linkedCustomerId || customer.id,
              current_balance: Number(customer.current_balance || 0) + creditUsed,
            },
          ]);
          setCustomer((prev) => ({
            ...prev,
            current_balance: Number(prev.current_balance || 0) + creditUsed,
          }));
        } catch {
          // ignore local customer cache errors
        }
      }
      clearCart();
      setCustomer({ id: null, name: '', phone: '', type: 'wholesale', credit_limit: 0, current_balance: 0 });
      if (navigator.onLine) {
        await syncAllCustomers().catch(() => {});
        await processOfflineQueue(api);
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to place order';
      if (navigator.onLine) {
        showPopup(message, 'Error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!tenantConfig && !userDetails) return;
    const modeSource =
      (userDetails && (userDetails.gst_mode || userDetails.gstMode || userDetails.gst_mode?.mode))
        ? userDetails
        : tenantConfig;
    setGstMode(resolveGstModeFromConfig(modeSource));
  }, [tenantConfig, userDetails, setGstMode]);

  React.useEffect(() => {
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
          const response = await api.get(buildSearchUrl(current));
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
        } catch {
          // ignore
        }
      }
      if (latestSearchRef.current !== current) return;
      setSearchSuggestions(suggestions);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchText]);

  const handleCustomerSearch = async (text) => {
    if (!text || text.length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    try {
      const localCustomers = await getAllCustomers();
      const query = text.toLowerCase();
      const localMatches = (localCustomers || [])
        .filter((entry) => {
          const name = String(entry?.name || '').toLowerCase();
          const phone = String(entry?.phone || entry?.mobile || '').toLowerCase();
          return name.includes(query) || phone.includes(query);
        })
        .slice(0, 10);
      if (localMatches.length) {
        setCustomerSuggestions(localMatches);
        return;
      }
      if (!navigator.onLine) {
        setCustomerSuggestions([]);
        return;
      }
      const response = await api.get('/customers', { params: { search: text, limit: 10 } });
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

  return (
    <div className="billing-page">
      <div className="billing-main">
        <div className="billing-left">
          <ProductSearch
            value={searchText}
            suggestions={searchSuggestions}
            loading={searchLoading}
            onChange={setSearchText}
            onSelect={(product) => {
              if (!ensureBranchMatch(product)) return;
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
            onCameraDetected={handleScan}
            inputRef={barcodeRef}
            isAdding={isItemAdding}
          />
        </div>

        <div className="billing-center">
          <CartList
            items={items}
            selectedKey={selectedKey}
            isGSTEnabled={isGSTEnabled}
            onSelect={selectItem}
            onQtyChange={updateQty}
            onPriceChange={updatePrice}
            onRemove={removeItem}
            canRevealActualPrice={canRevealActualPrice}
            canEditPrice={isAdminUser}
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
            <div className="grand-total">
              <span>Grand Total</span>
              <strong>INR {totals.grandTotal.toFixed(2)}</strong>
            </div>
          </div>
          <div className="billing-checkout-panel">
            <div className="billing-option-group">
              <span className="billing-option-title">Customer (Required)</span>
              <label className="billing-label">
                Search
                <input
                  ref={customerSearchRef}
                  className="form-control form-control-sm billing-input"
                  placeholder="Search customer name or phone"
                  value={customer.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCustomer((prev) => ({ ...prev, name: value, id: null }));
                    handleCustomerSearch(value);
                  }}
                />
              </label>
              {customerSuggestions.length > 0 && (
                <div className="billing-search-list">
                  {customerSuggestions.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      className="billing-search-item"
                      onClick={() => {
                        setCustomer({
                          id: entry.id,
                          name: entry.name || '',
                          phone: entry.phone || entry.mobile || '',
                          type: entry.type || entry.customer_type || 'wholesale',
                          credit_limit: Number(entry.credit_limit ?? entry.creditLimit ?? 0),
                          current_balance: Number(entry.current_balance ?? entry.currentBalance ?? 0),
                        });
                        setCustomerSuggestions([]);
                      }}
                    >
                      <div className="billing-name">
                        <strong>{entry.name}</strong>
                        <span>{entry.phone || entry.mobile || '-'}</span>
                      </div>
                      <div className="billing-search-price">INR {Number(entry.current_balance || 0).toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              )}
              <label className="billing-label">
                Phone
                <input
                  className="form-control form-control-sm billing-input"
                  value={customer.phone}
                  onChange={(event) => setCustomer((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </label>
              {customer.id && (
                <div className="mt-2">
                  <small className="text-light d-block">
                    Balance: INR {Number(customer.current_balance || 0).toFixed(2)} · Limit: INR {Number(customer.credit_limit || 0).toFixed(2)} · Available: INR {Math.max(Number(customer.credit_limit || 0) - Number(customer.current_balance || 0), 0).toFixed(2)}
                  </small>
                  {paymentMethod === 'credit' &&
                    Number(customer.credit_limit || 0) > 0 &&
                    Number(customer.current_balance || 0) + totals.grandTotal > Number(customer.credit_limit || 0) && (
                      <small className="text-danger d-block">Credit limit will be exceeded.</small>
                    )}
                </div>
              )}
            </div>
            <div className="billing-option-group">
              <span className="billing-option-title">Payment</span>
              <div className="billing-option-row">
                {['cash', 'bank', 'credit'].map((method) => (
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
          </div>

          <button
            className="btn btn-success billing-checkout"
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting || items.length === 0}
          >
            {isSubmitting ? 'Processing...' : 'Save Wholesale'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WholesaleBilling;
