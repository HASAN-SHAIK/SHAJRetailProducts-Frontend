import { getDeviceId } from './device';
import { getAuthToken } from './sessionStorage';
import { saveProductsBulk } from '../core/db';

const extractProductsPayload = async (response) => {
  const payload = response?.data ?? response;
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

export const preloadProductsViaFetch = async (baseURL) => {
  const resolvedBase = baseURL ? baseURL.replace(/\/$/, '') : `${window.location.origin}/api`;
  const url = `${resolvedBase}/products/cache-db`;
  console.log('[cacheDB] fetch start', url);

  const deviceId = getDeviceId();
  let token = null;
  try {
    token = await getAuthToken();
  } catch (err) {
    token = null;
  }
  const headers = { 'x-device-id': deviceId };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
  const json = await res.json();
  const products = await extractProductsPayload(json);
  const normalizedProducts = products.map((product) => normalizeProduct(product));
  // Some products may not have barcodes. Cache what we can instead of failing.
  const safeProducts = normalizedProducts.filter(Boolean);
  if (!safeProducts.length) return;
  console.log('[cacheDB] saving products', safeProducts.length);
  const savedCount = await saveProductsBulk(safeProducts);
  console.log('[cacheDB] preload complete', savedCount);
};
