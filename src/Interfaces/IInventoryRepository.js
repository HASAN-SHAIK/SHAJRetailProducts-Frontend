/**
 * @typedef {object} IInventoryRepository
 * @property {(productId: string|number, options?: object) => Promise<object[]>} getBranchStock
 * @property {() => Promise<object|null>} getStockConsistencyLatest
 * @property {(options?: object) => Promise<object>} runStockConsistency
 * @property {(options?: object) => Promise<object>} fetchInventoryIntelligence
 * @property {(product?: object|null) => number|null} getStockCount
 * @property {(batch?: object|null) => boolean} isBatchExpired
 * @property {(batches?: object[]) => number} sumBatchQuantityRemaining
 */

export {};
