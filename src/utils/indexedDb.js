import api from './axios';
import { saveProductsBulk } from '../core/db';

const extractProductsPayload = (response) => {
  const payload = response?.data?.data ?? response?.data?.products ?? response?.data ?? [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getBarcodeKey = (product) =>
  product?.barcode ||
  product?.barcode_number ||
  product?.barcodeNumber ||
  product?.product_barcode ||
  product?.productBarcode ||
  product?.code ||
  product?.product_code ||
  product?.productCode ||
  null;

const normalizeProduct = (product) => {
  const barcode = getBarcodeKey(product);
  if (!barcode) return null;
  return { ...product, barcode };
};

export const preloadProductsToIndexedDb = async () => {
  console.log('\u{1F4E6} Fetching products from API');
  const res = await api.get('/products/cache-db');
  const products = extractProductsPayload(res);
  const normalizedProducts = products.map((product) => normalizeProduct(product));
  if (normalizedProducts.some((product) => !product)) {
    throw new Error('Missing barcode in product payload');
  }
  console.log('\u{1F4E5} Bulk inserting products');
  const savedCount = await saveProductsBulk(normalizedProducts);
  console.log('\u2705 IndexedDB fully loaded', savedCount);
};
