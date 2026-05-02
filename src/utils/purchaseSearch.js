import api from './axios';
import {
  getAllProductsCache,
  getProductCacheByBarcode,
  updateProductsBulk,
} from '../core/db';

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const isLocalId = (value) => {
  const text = String(value || '').toLowerCase();
  return (
    text.startsWith('temp_') ||
    text.startsWith('temp:') ||
    text.startsWith('local_') ||
    text.startsWith('local:') ||
    text.startsWith('tmp:')
  );
};

const normalizeProduct = (product) => ({
  ...product,
  name: product?.name ?? product?.product_name ?? product?.product ?? '',
  company: product?.company ?? product?.company_name ?? '',
});

const productIdentityKey = (product) => {
  const barcode = String(product?.barcode || '').trim();
  if (barcode && !barcode.startsWith('id:')) return `barcode:${barcode.toLowerCase()}`;
  const name = normalizeText(product?.name ?? product?.product_name ?? product?.product ?? '');
  const company = normalizeText(product?.company ?? product?.company_name ?? '');
  const branch = normalizeText(product?.branch_id ?? product?.branchId ?? '');
  return `name:${name}|company:${company}|branch:${branch}`;
};

const pickPreferred = (current, candidate) => {
  if (!current) return candidate;
  const score = (item) => {
    const id = item?.id ?? item?.product_id ?? item?.productId ?? '';
    const synced = String(item?.sync_status ?? item?.syncStatus ?? '').toLowerCase() === 'synced';
    const updatedAt = new Date(item?.updated_at ?? item?.updatedAt ?? item?.created_at ?? 0).getTime() || 0;
    return (isLocalId(id) ? 0 : 20) + (synced ? 10 : 0) + (updatedAt / 1e13);
  };
  return score(candidate) >= score(current) ? candidate : current;
};

const dedupeProducts = (products = []) => {
  const map = new Map();
  (Array.isArray(products) ? products : []).forEach((product) => {
    const key = productIdentityKey(product);
    const existing = map.get(key);
    map.set(key, pickPreferred(existing, product));
  });
  return Array.from(map.values());
};

const isBranchMatch = (product, branchId) => {
  if (!branchId) return true;
  const productBranch = product?.branch_id ?? product?.branchId ?? null;
  if (!productBranch) return true;
  return productBranch === branchId;
};

export const searchProducts = async (query, branchId = null, { allowRemote = false } = {}) => {
  const term = normalizeText(query);
  if (!term) return [];

  const exact = await getProductCacheByBarcode(term);
  if (exact && isBranchMatch(exact, branchId)) {
    return [normalizeProduct(exact)];
  }

  const cached = dedupeProducts(await getAllProductsCache());
  const filtered = cached
    .filter((product) => isBranchMatch(product, branchId))
    .map(normalizeProduct)
    .filter((product) => {
      if (product.is_deleted) return false;
      const name = normalizeText(product.name);
      const company = normalizeText(product.company);
      const barcode = normalizeText(product.barcode);
      return (
        name.includes(term) ||
        company.includes(term) ||
        barcode.includes(term)
      );
    });

  if (filtered.length) {
    const startsWith = [];
    const contains = [];
    filtered.forEach((product) => {
      const name = normalizeText(product.name);
      if (name.startsWith(term)) {
        startsWith.push(product);
      } else {
        contains.push(product);
      }
    });
    return [...startsWith, ...contains].slice(0, 15);
  }

  if (!allowRemote || !navigator.onLine) return [];

  try {
    const headers = branchId ? { 'x-branch-id': branchId } : undefined;
    const response = await api.get('/products/search/purchase', {
      params: { name: term },
      headers,
    });
    const payload = response?.data?.data ?? response?.data?.products ?? response?.data ?? [];
    const list = Array.isArray(payload) ? payload : [];
    if (list.length) {
      await updateProductsBulk(list).catch(() => {});
      return list.map(normalizeProduct).filter((product) => isBranchMatch(product, branchId));
    }
  } catch {
    // ignore network failures
  }
  return [];
};

export const findProductByBarcode = async (barcode, branchId = null) => {
  const term = normalizeText(barcode);
  if (!term) return null;
  const exact = await getProductCacheByBarcode(term);
  if (exact && isBranchMatch(exact, branchId)) return normalizeProduct(exact);
  const results = await searchProducts(term, branchId, { allowRemote: true });
  return results.find((product) => normalizeText(product.barcode) === term) || results[0] || null;
};

export const searchProductsLocal = async (query, branchId = null) =>
  searchProducts(query, branchId, { allowRemote: false });

export const findProductByBarcodeLocal = async (barcode, branchId = null) => {
  const term = normalizeText(barcode);
  if (!term) return null;
  const exact = await getProductCacheByBarcode(term);
  if (exact && isBranchMatch(exact, branchId)) return normalizeProduct(exact);
  const results = await searchProducts(term, branchId, { allowRemote: false });
  return results.find((product) => normalizeText(product.barcode) === term) || results[0] || null;
};
