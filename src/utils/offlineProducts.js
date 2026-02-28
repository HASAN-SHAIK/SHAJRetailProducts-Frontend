const STORAGE_KEY = 'offline_products_cache_v1';

export const saveProductsCache = (products) => {
  try {
    const safe = Array.isArray(products)
      ? products.map((p) => ({
          ...p,
          stock_quantity:
            p?.stock_quantity ??
            p?.stockQuantity ??
            p?.stock ??
            p?.quantity ??
            null,
        }))
      : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // ignore cache failures
  }
};

export const loadProductsCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const searchCachedProducts = (term) => {
  const query = (term || '').trim().toLowerCase();
  if (!query) return [];
  const products = loadProductsCache();
  return products.filter((p) => {
    const name = (p.name || p.product_name || '').toLowerCase();
    const company = (p.company || '').toLowerCase();
    return name.includes(query) || company.includes(query);
  });
};
