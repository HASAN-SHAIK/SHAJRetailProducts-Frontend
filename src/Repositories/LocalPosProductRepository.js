import { ApiProductRepository } from './ApiProductRepository';
import { isLocalPosEnabled, localPosRequest } from './local/posLocalApiClient';

const normalizeProduct = (product) => {
  if (!product) return product;
  const price = product.price || null;
  return {
    ...product,
    product_id: product.product_id || product.id,
    selling_price: product.selling_price ?? (price ? Number(price.amount_minor || 0) / 100 : undefined),
    price: product.selling_price ?? (price ? Number(price.amount_minor || 0) / 100 : product.price),
  };
};

/** Keeps existing IndexedDB cache behavior while sourcing sale-time catalog data locally. */
export class LocalPosProductRepository extends ApiProductRepository {
  async getProductByBarcode(barcode, branchId = null) {
    if (!isLocalPosEnabled()) return super.getProductByBarcode(barcode, branchId);
    const product = normalizeProduct(
      await localPosRequest(`/catalog/products/barcode/${encodeURIComponent(String(barcode || '').trim())}`)
    );
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
