/**
 * @typedef {object} IOfflineRepository
 * @property {() => Promise<object[]>} getOfflineOrders
 * @property {(orders: object[]) => Promise<void>} saveOfflineOrdersBulk
 * @property {(entry: object) => Promise<void>} upsertOfflineOrder
 * @property {(ids: Array<string|number>) => Promise<void>} deleteOfflineOrdersByIds
 * @property {(purchase: object) => Promise<void>} upsertOfflinePurchase
 * @property {(items?: object[]) => Promise<void>} addOfflinePurchaseItems
 * @property {(status?: string|null) => Promise<object[]>} getOfflinePurchases
 * @property {(localPurchaseId: string|number) => Promise<object[]>} getOfflinePurchaseItems
 * @property {(returnEntry: object) => Promise<void>} upsertOfflinePurchaseReturn
 * @property {(status?: string|null) => Promise<object[]>} getOfflinePurchaseReturns
 * @property {(payload?: object) => Promise<object>} addOfflineImport
 * @property {() => Promise<object[]>} getOfflineImports
 * @property {(importId: string|number) => Promise<object[]>} getOfflineImportItems
 * @property {(entry: object) => Promise<void>} updateOfflineImport
 * @property {(importId: string|number, status: string) => Promise<void>} updateOfflineImportStatus
 */

export {};
