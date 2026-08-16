import { db } from '../core/db';
import { isLocalPosEnabled, localPosRequest } from '../Repositories/local/posLocalApiClient';

const normalizeName = (product) =>
  product?.name ||
  product?.product_name ||
  product?.product ||
  product?.title ||
  '';

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

const productIdentityKey = (product) => {
  const barcode = String(product?.barcode || '').trim();
  if (barcode && !barcode.startsWith('id:')) {
    return `barcode:${barcode.toLowerCase()}`;
  }
  const name = normalizeName(product).trim().toLowerCase();
  const company = String(product?.company || product?.company_name || '').trim().toLowerCase();
  const branch = String(product?.branch_id ?? product?.branchId ?? '').trim().toLowerCase();
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

const SEARCH_LIMIT = 50;

const normalizePosSearchProduct = (product) => {
  if (!product) return product;
  const price = product.price || null;
  const primaryBarcode = product.barcode || (Array.isArray(product.barcodes) ? product.barcodes[0] : undefined);
  return {
    ...product,
    barcode: primaryBarcode,
    product_id: product.product_id || product.id,
    selling_price: product.selling_price ?? (price ? Number(price.amount_minor || 0) / 100 : undefined),
    price: product.selling_price ?? (price ? Number(price.amount_minor || 0) / 100 : product.price),
  };
};

const searchPosCatalog = async (term) => {
  const query = String(term || '').trim();
  if (!query) return [];
  const payload = await localPosRequest(
    `/catalog/products?q=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`
  );
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .map(normalizePosSearchProduct)
    .filter((product) => product && product.is_active !== false)
    .slice(0, SEARCH_LIMIT);
};

export const searchLocalProducts = async (term) => {
  const query = String(term || '').trim().toLowerCase();
  if (!query) return [];

  if (isLocalPosEnabled()) {
    return searchPosCatalog(term);
  }

  const candidates = [];
  const barcode = String(term || '').trim();
  if (barcode) {
    const byBarcode = await db.products_cache.where('barcode').equals(barcode).toArray();
    candidates.push(...byBarcode);
  }

  if (candidates.length < SEARCH_LIMIT) {
    const byPrefix = await db.products_cache
      .where('name_lower')
      .startsWith(query)
      .limit(SEARCH_LIMIT * 3)
      .toArray();
    candidates.push(...byPrefix);
  }

  if (candidates.length < SEARCH_LIMIT) {
    const supplemental = await db.products_cache
      .filter((product) => {
        if (product?.is_deleted) return false;
        const name = normalizeName(product).toLowerCase();
        const company = String(product?.company || '').toLowerCase();
        const barcodeValue = String(product?.barcode || '').toLowerCase();
        return name.includes(query) || company.includes(query) || barcodeValue.includes(query);
      })
      .limit(SEARCH_LIMIT * 2)
      .toArray();
    candidates.push(...supplemental);
  }

  return dedupeProducts(candidates)
    .filter((product) => !product?.is_deleted)
    .slice(0, SEARCH_LIMIT);
};

export const normalizeDisplayProduct = (product) => {
  if (!product) return product;
  return {
    ...product,
    name: normalizeName(product),
  };
};
