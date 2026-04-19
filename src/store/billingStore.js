import { create } from 'zustand';
import { calculateGST, normalizeGstMode } from '../services/gstService';

const getProductPrice = (product) =>
  Number(
    product?.selling_price ??
      product?.sellingPrice ??
      product?.price ??
      product?.purchase_price ??
      0
  );

const getProductGst = (product) =>
  Number(
    product?.gst_percent ??
      product?.gst_percentage ??
      product?.gst ??
      product?.gstPercent ??
      product?.gstPercentage ??
      0
  );

const applyGstTotals = (price, qty, gstPercent, gstMode) => {
  const { basePrice, gstAmount, total } = calculateGST({
    price,
    qty,
    gstPercent,
    gstMode
  });
  return {
    basePrice: Math.round((Number(basePrice || 0) + Number.EPSILON) * 100) / 100,
    gstAmount: Math.round((Number(gstAmount || 0) + Number.EPSILON) * 100) / 100,
    lineTotal: Math.round((Number(total || 0) + Number.EPSILON) * 100) / 100
  };
};

const getProductStock = (product) => {
  const raw =
    product?.stock_quantity ??
    product?.stockQuantity ??
    product?.quantity ??
    product?.stock ??
    null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const toKey = (product) => {
  const batchId = product?.batch_id ?? product?.batchId ?? null;
  if (batchId !== null && batchId !== undefined && String(batchId).trim() !== '') {
    const productId =
      product?.id ??
      product?.product_id ??
      product?.productId ??
      product?.barcode ??
      'unknown';
    return `p:${String(productId)}|b:${String(batchId)}`;
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
  const name =
    product?.name ??
    product?.product_name ??
    product?.product ??
    null;
  if (name !== null && name !== undefined && String(name).trim() !== '') {
    return `name:${String(name).trim().toLowerCase()}`;
  }
  return null;
};

const normalizeItem = (product, qty = 1, gstMode = 'INCLUSIVE') => ({
  key: toKey(product),
  id: product?.id ?? product?.product_id ?? product?.productId ?? null,
  batch_id: product?.batch_id ?? product?.batchId ?? null,
  batch_number: product?.batch_number ?? product?.batchNumber ?? null,
  barcode: product?.barcode ?? null,
  name: product?.name ?? product?.product_name ?? '-',
  mrp: Number(product?.mrp ?? product?.mrp_price ?? 0) || 0,
  price: getProductPrice(product),
  gstPercent: getProductGst(product),
  ...applyGstTotals(getProductPrice(product), qty, getProductGst(product), gstMode),
  qty,
  is_weight_based: product?.is_weight_based ?? product?.isWeightBased ?? product?.weight_based ?? 0,
  __stock: getProductStock(product),
});

const isWeightBased = (item) => {
  const value = item?.is_weight_based;
  if (value === true) return true;
  if (value === false || value == null) return false;
  return String(value) === '1';
};

export const useBillingStore = create((set, get) => ({
  items: [],
  selectedKey: null,
  isGSTEnabled: true,
  gstMode: 'INCLUSIVE',
  setGSTEnabled: (value) => set({ isGSTEnabled: value }),
  setGstMode: (mode) =>
    set((state) => {
      const nextMode = normalizeGstMode(mode);
      const updated = state.items.map((item) => ({
        ...item,
        ...applyGstTotals(item.price, item.qty, item.gstPercent, nextMode),
      }));
      return { gstMode: nextMode, items: updated };
    }),
  setItems: (items) => set((state) => {
    const gstMode = state.gstMode || 'INCLUSIVE';
    const nextItems = Array.isArray(items) ? items : [];
    const normalized = nextItems.map((item) => ({
      ...item,
      ...applyGstTotals(item.price, item.qty, item.gstPercent, gstMode),
    }));
    return { items: normalized };
  }),
  setSelectedKey: (key) => set({ selectedKey: key || null }),
  selectItem: (key) => set({ selectedKey: key }),
  clearCart: () => set({ items: [], selectedKey: null }),
  addItem: (product, qty = 1) => {
    const key = toKey(product);
    if (!key) return;
    const parsedQty = Number(qty);
    const safeQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
    const gstMode = get().gstMode;
    set((state) => {
      const existing = state.items.find((item) => item.key === key);
      if (existing) {
        const updatedQty = (itemQty) => itemQty + safeQty;
        const updated = state.items.map((item) =>
          item.key === key
            ? {
                ...item,
                qty: updatedQty(item.qty),
                ...applyGstTotals(item.price, updatedQty(item.qty), item.gstPercent, gstMode),
              }
            : item
        );
        return { items: updated, selectedKey: key };
      }
      const next = [...state.items, normalizeItem(product, safeQty, gstMode)];
      return { items: next, selectedKey: key };
    });
  },
  updateQty: (key, qty) => {
    if (qty === '' || qty === null || qty === undefined) {
      return;
    }
    const parsed = Number(qty);
    set((state) => {
      if (!Number.isFinite(parsed)) return state;
      const target = state.items.find((item) => item.key === key);
      const weight = isWeightBased(target);
      const stock = Number.isFinite(target?.__stock) ? target.__stock : null;
      let normalized = weight ? parsed : Math.floor(parsed);
      if (stock !== null) {
        if (stock <= 0) {
          return state;
        }
        if (normalized > stock) {
          normalized = stock;
        }
      }
      if (normalized <= 0) {
        const filtered = state.items.filter((item) => item.key !== key);
        const nextSelected = state.selectedKey === key ? null : state.selectedKey;
        return { items: filtered, selectedKey: nextSelected };
      }
      const gstMode = state.gstMode || 'INCLUSIVE';
      const updated = state.items.map((item) =>
        item.key === key
          ? {
              ...item,
              qty: normalized,
              ...applyGstTotals(item.price, normalized, item.gstPercent, gstMode),
            }
          : item
      );
      return { items: updated };
    });
  },
  updatePrice: (key, price) => {
    const parsed = Number(price);
    set((state) => {
      if (!Number.isFinite(parsed) || parsed < 0) return state;
      const gstMode = state.gstMode || 'INCLUSIVE';
      const updated = state.items.map((item) =>
        item.key === key
          ? {
              ...item,
              price: parsed,
              ...applyGstTotals(parsed, item.qty, item.gstPercent, gstMode),
            }
          : item
      );
      return { items: updated };
    });
  },
  updateGst: (key, gstPercent) => {
    const parsed = Number(gstPercent);
    set((state) => {
      if (!Number.isFinite(parsed) || parsed < 0) return state;
      const gstMode = state.gstMode || 'INCLUSIVE';
      const updated = state.items.map((item) =>
        item.key === key
          ? {
              ...item,
              gstPercent: parsed,
              ...applyGstTotals(item.price, item.qty, parsed, gstMode),
            }
          : item
      );
      return { items: updated };
    });
  },
  removeItem: (key) =>
    set((state) => ({
      items: state.items.filter((item) => item.key !== key),
      selectedKey: state.selectedKey === key ? null : state.selectedKey,
    })),
}));

