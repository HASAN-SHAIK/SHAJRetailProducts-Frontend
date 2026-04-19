import { getAllProducts } from '../core/db';

const normalizeName = (product) =>
  product?.name ||
  product?.product_name ||
  product?.product ||
  product?.title ||
  '';

export const searchLocalProducts = async (term) => {
  const query = String(term || '').trim().toLowerCase();
  if (!query) return [];
  const products = await getAllProducts();
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
