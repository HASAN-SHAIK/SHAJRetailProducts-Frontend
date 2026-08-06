import * as storage from './internal/storage';

/** @implements {import('../Interfaces/IProductRepository').IProductRepository} */
export class IndexedDbProductRepository {
  saveProductsBulk(products) {
    return storage.saveProductsBulk(products);
  }

  saveBatchesBulk(batches) {
    return storage.saveBatchesBulk(batches);
  }

  updateBatchesBulk(batches) {
    return storage.updateBatchesBulk(batches);
  }

  getAllBatches() {
    return storage.getAllBatches();
  }

  getAllBatchesCache() {
    return storage.getAllBatchesCache();
  }

  getBatchCacheById(batchId) {
    return storage.getBatchCacheById(batchId);
  }

  getLatestBatchForProduct(productId, branchId = null) {
    return storage.getLatestBatchForProduct(productId, branchId);
  }

  getBatchesForProduct(productId, branchId = null) {
    return storage.getBatchesForProduct(productId, branchId);
  }

  getProductByBarcode(barcode, branchId = null) {
    return storage.getProductByBarcode(barcode, branchId);
  }

  updateProduct(product) {
    return storage.updateProduct(product);
  }

  getAllProducts() {
    return storage.getAllProducts();
  }

  updateProductsBulk(products) {
    return storage.updateProductsBulk(products);
  }

  getAllProductsCache() {
    return storage.getAllProductsCache();
  }

  getProductCacheByBarcode(barcode) {
    return storage.getProductCacheByBarcode(barcode);
  }

  getProductCacheById(productId) {
    return storage.getProductCacheById(productId);
  }

  updateProductsCacheBulk(products) {
    return storage.updateProductsCacheBulk(products);
  }

  deleteProductsCacheByIds(ids = []) {
    return storage.deleteProductsCacheByIds(ids);
  }

  deleteBatchesCacheByIds(ids = []) {
    return storage.deleteBatchesCacheByIds(ids);
  }

  updateProductsCacheStock(productId, delta, branchId = null) {
    return storage.updateProductsCacheStock(productId, delta, branchId);
  }

  addLocalBatchCache(batch) {
    return storage.addLocalBatchCache(batch);
  }

  upsertLocalProduct(product) {
    return storage.upsertLocalProduct(product);
  }

  getLocalProducts(status = null) {
    return storage.getLocalProducts(status);
  }

  getLocalProductById(productId) {
    return storage.db.products.get(productId);
  }

  deleteLocalProduct(productId) {
    return storage.db.products.delete(productId);
  }
}
