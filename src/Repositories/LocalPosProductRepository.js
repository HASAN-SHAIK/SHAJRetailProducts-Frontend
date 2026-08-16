import { ApiProductRepository } from './ApiProductRepository';
import { isLocalPosEnabled, localPosRequest } from './local/posLocalApiClient';

const normalizeBarcode = (barcode) =>
  String(barcode || '').trim().replace(/^["']+|["']+$/g, '').trim();

const normalizeProduct = (product) => {
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

/** Keeps existing IndexedDB cache behavior while sourcing sale-time catalog data locally. */
export class LocalPosProductRepository extends ApiProductRepository {
  async searchLocalCatalog(search = '', limit = 50) {
    if (!isLocalPosEnabled()) return [];
    const query = String(search || '').trim();
    if (!query) return [];
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
    const payload = await localPosRequest(
      `/catalog/products?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(safeLimit))}`
    );
    const products = Array.isArray(payload?.items) ? payload.items.map(normalizeProduct) : [];
    if (products.length) await this.cache.updateProductsBulk(products).catch(() => {});
    return products;
  }

  async getProductByBarcode(barcode, branchId = null) {
    if (!isLocalPosEnabled()) return super.getProductByBarcode(barcode, branchId);
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) return null;
    let product = null;
    try {
      product = normalizeProduct(
        await localPosRequest(`/catalog/products/barcode/${encodeURIComponent(normalizedBarcode)}`)
      );
    } catch (error) {
      if (error?.status === 404 || error?.message === 'product_not_found' || error?.payload?.error === 'product_not_found') {
        return null;
      }
      throw error;
    }
    if (product) await this.cache.updateProductsBulk([product]).catch(() => {});
    return product;
  }

  async getProductCacheByBarcode(barcode) {
    const cached = await this.cache.getProductCacheByBarcode(barcode);
    if (cached) return cached;
    return this.getProductByBarcode(barcode);
  }

  async getProductCacheById(productId) {
    const cached = await this.cache.getProductCacheById(productId);
    if (cached || !isLocalPosEnabled()) return cached || super.getProductCacheById(productId);
    const product = normalizeProduct(
      await localPosRequest(`/catalog/products/${encodeURIComponent(String(productId || '').trim())}`)
    );
    if (product) await this.cache.updateProductsBulk([product]).catch(() => {});
    return product;
  }
}
