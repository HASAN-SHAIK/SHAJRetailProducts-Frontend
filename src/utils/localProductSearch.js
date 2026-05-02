import { getAllProducts } from '../core/db';

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

export const searchLocalProducts = async (term) => {
  const query = String(term || '').trim().toLowerCase();
  if (!query) return [];
  const products = dedupeProducts(await getAllProducts());
  return products.filter((product) => {
    if (product?.is_deleted) return false;
    const name = normalizeName(product).toLowerCase();
    const company = String(product?.company || '').toLowerCase();
    const barcode = String(product?.barcode || '').toLowerCase();
    return name.includes(query) || company.includes(query) || barcode.includes(query);
  });
};

export const normalizeDisplayProduct = (product) => {
  if (!product) return product;
  return {
    ...product,
    name: normalizeName(product),
  };
};
