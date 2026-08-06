/**
 * @typedef {object} IProductRepository
 * @property {(products: object[]) => Promise<void>} saveProductsBulk
 * @property {(batches: object[]) => Promise<void>} saveBatchesBulk
 * @property {(batches: object[]) => Promise<void>} updateBatchesBulk
 * @property {() => Promise<object[]>} getAllBatches
 * @property {() => Promise<object[]>} getAllBatchesCache
 * @property {(batchId: string|number) => Promise<object|undefined>} getBatchCacheById
 * @property {(productId: string|number, branchId?: string|number|null) => Promise<object|undefined>} getLatestBatchForProduct
 * @property {(barcode: string, branchId?: string|number|null) => Promise<object|undefined>} getProductByBarcode
 * @property {(product: object) => Promise<void>} updateProduct
 * @property {() => Promise<object[]>} getAllProducts
 * @property {(products: object[]) => Promise<void>} updateProductsBulk
 * @property {() => Promise<object[]>} getAllProductsCache
 * @property {(barcode: string) => Promise<object|undefined>} getProductCacheByBarcode
 * @property {(productId: string|number) => Promise<object|undefined>} getProductCacheById
 * @property {(products: object[]) => Promise<void>} updateProductsCacheBulk
 * @property {(ids?: Array<string|number>) => Promise<void>} deleteProductsCacheByIds
 * @property {(ids?: Array<string|number>) => Promise<void>} deleteBatchesCacheByIds
 * @property {(productId: string|number, delta: number, branchId?: string|number|null) => Promise<void>} updateProductsCacheStock
 * @property {(batch: object) => Promise<void>} addLocalBatchCache
 * @property {(product: object) => Promise<void>} upsertLocalProduct
 * @property {(status?: string|null) => Promise<object[]>} getLocalProducts
 * @property {(productId: string|number) => Promise<object|undefined>} getLocalProductById
 * @property {(productId: string|number) => Promise<void>} deleteLocalProduct
 */

export {};
