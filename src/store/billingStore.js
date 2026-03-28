import { create } from 'zustand';

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

const toKey = (product) => product?.id ?? product?.product_id ?? product?.productId ?? product?.barcode;

const normalizeItem = (product, qty = 1) => ({
  key: toKey(product),
  id: product?.id ?? product?.product_id ?? product?.productId ?? null,
  barcode: product?.barcode ?? null,
  name: product?.name ?? product?.product_name ?? '-',
  mrp: Number(product?.mrp ?? product?.mrp_price ?? 0) || 0,
  price: getProductPrice(product),
  gstPercent: getProductGst(product),
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

export const useBillingStore = create((set) => ({
  items: [],
  selectedKey: null,
  isGSTEnabled: true,
  setGSTEnabled: (value) => set({ isGSTEnabled: value }),
  setItems: (items) => set({ items: Array.isArray(items) ? items : [] }),
  setSelectedKey: (key) => set({ selectedKey: key || null }),
  selectItem: (key) => set({ selectedKey: key }),
  clearCart: () => set({ items: [], selectedKey: null }),
  addItem: (product, qty = 1) => {
    const key = toKey(product);
    if (!key) return;
    set((state) => {
      const existing = state.items.find((item) => item.key === key);
      if (existing) {
        const updated = state.items.map((item) =>
          item.key === key ? { ...item, qty: item.qty + qty } : item
        );
        return { items: updated, selectedKey: key };
      }
      const next = [...state.items, normalizeItem(product, qty)];
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
      const updated = state.items.map((item) =>
        item.key === key ? { ...item, qty: normalized } : item
      );
      return { items: updated };
    });
  },
  updatePrice: (key, price) => {
    const parsed = Number(price);
    set((state) => {
      if (!Number.isFinite(parsed) || parsed < 0) return state;
      const updated = state.items.map((item) =>
        item.key === key ? { ...item, price: parsed } : item
      );
      return { items: updated };
    });
  },
  updateGst: (key, gstPercent) => {
    const parsed = Number(gstPercent);
    set((state) => {
      if (!Number.isFinite(parsed) || parsed < 0) return state;
      const updated = state.items.map((item) =>
        item.key === key ? { ...item, gstPercent: parsed } : item
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

