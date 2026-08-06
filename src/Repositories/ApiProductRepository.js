import { IndexedDbProductRepository } from './IndexedDbProductRepository';
import {
  fetchProductByBarcode,
  fetchProductById,
  isOnline,
  updateProductRemote,
} from './api/productApiClient';
import { isTempEntityId } from './api/productNormalizer';

/** @implements {import('../Interfaces/IProductRepository').IProductRepository} */
export class ApiProductRepository {
  constructor() {
    this.cache = new IndexedDbProductRepository();
  }

  saveProductsBulk(products) {
    return this.cache.saveProductsBulk(products);
  }

  saveBatchesBulk(batches) {
    return this.cache.saveBatchesBulk(batches);
  }

  updateBatchesBulk(batches) {
    return this.cache.updateBatchesBulk(batches);
  }

  async getAllBatches() {
    return this.cache.getAllBatches();
  }

  getAllBatchesCache() {
    return this.cache.getAllBatchesCache();
  }

  getBatchCacheById(batchId) {
    return this.cache.getBatchCacheById(batchId);
  }

  getLatestBatchForProduct(productId, branchId = null) {
    return this.cache.getLatestBatchForProduct(productId, branchId);
  }

  getBatchesForProduct(productId, branchId = null) {
    return this.cache.getBatchesForProduct(productId, branchId);
  }

  async getProductByBarcode(barcode, branchId = null) {
    const cached = await this.cache.getProductByBarcode(barcode, branchId);
    if (cached) return cached;
    if (!isOnline()) return null;

    const remote = await fetchProductByBarcode(barcode, { branchId, context: 'sale' }).catch(() => null);
    if (!remote) return null;
    await this.cache.updateProductsBulk([remote]).catch(() => {});
    return (await this.cache.getProductByBarcode(barcode, branchId)) || remote;
  }

  async updateProduct(product) {
    const productId = product?.id ?? product?.product_id ?? product?.productId;
    if (isOnline() && productId && !isTempEntityId(productId)) {
      try {
        const updated = await updateProductRemote(productId, product);
        if (updated) {
          await this.cache.updateProduct(updated);
          return;
        }
      } catch {
        // Fall back to local cache update for offline-tolerant flows.
      }
    }
    return this.cache.updateProduct(product);
  }

  getAllProducts() {
    return this.cache.getAllProducts();
  }

  updateProductsBulk(products) {
    return this.cache.updateProductsBulk(products);
  }

  getAllProductsCache() {
    return this.cache.getAllProductsCache();
  }

  async getProductCacheByBarcode(barcode) {
    const cached = await this.cache.getProductCacheByBarcode(barcode);
    if (cached) return cached;
    return this.getProductByBarcode(barcode);
  }

  async getProductCacheById(productId) {
    const cached = await this.cache.getProductCacheById(productId);
    if (cached) return cached;
    if (!isOnline() || !productId || isTempEntityId(productId)) return cached;

    const remote = await fetchProductById(productId).catch(() => null);
    if (!remote) return cached;
    await this.cache.updateProductsBulk([remote]).catch(() => {});
    return (await this.cache.getProductCacheById(productId)) || remote;
  }

  updateProductsCacheBulk(products) {
    return this.cache.updateProductsCacheBulk(products);
  }

  deleteProductsCacheByIds(ids = []) {
    return this.cache.deleteProductsCacheByIds(ids);
  }

  deleteBatchesCacheByIds(ids = []) {
    return this.cache.deleteBatchesCacheByIds(ids);
  }

  updateProductsCacheStock(productId, delta, branchId = null) {
    return this.cache.updateProductsCacheStock(productId, delta, branchId);
  }

  addLocalBatchCache(batch) {
    return this.cache.addLocalBatchCache(batch);
  }

  upsertLocalProduct(product) {
    return this.cache.upsertLocalProduct(product);
  }

  getLocalProducts(status = null) {
    return this.cache.getLocalProducts(status);
  }

  getLocalProductById(productId) {
    return this.cache.getLocalProductById(productId);
  }

  deleteLocalProduct(productId) {
    return this.cache.deleteLocalProduct(productId);
  }
}
