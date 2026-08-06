/**
 * @typedef {object} IPurchaseRepository
 * @property {(purchase: object) => Promise<void>} upsertLocalPurchase
 * @property {(purchases?: object[]) => Promise<void>} upsertLocalPurchasesBulk
 * @property {(status?: string|null) => Promise<object[]>} getLocalPurchases
 * @property {(purchaseId: string|number) => Promise<object|undefined>} getLocalPurchaseById
 * @property {(items?: object[]) => Promise<void>} addLocalPurchaseItems
 * @property {(purchaseId: string|number) => Promise<object[]>} getLocalPurchaseItems
 * @property {(entry: object) => Promise<void>} upsertLocalPurchaseReturn
 * @property {(status?: string|null) => Promise<object[]>} getLocalPurchaseReturns
 * @property {(returnId: string|number) => Promise<object|undefined>} getLocalPurchaseReturnById
 * @property {(options?: object) => Promise<object[]>} listPurchases
 * @property {(purchaseId: string|number) => Promise<object|null>} getPurchaseDetail
 * @property {(payload: object) => Promise<{ orderId: string|number|null, batches: object[], data: object }>} createPurchase
 * @property {(formData: FormData) => Promise<object>} importPurchasePdf
 * @property {(payload: object) => Promise<{ serverId: string|number|null, data: object }>} createPurchaseReturn
 */

export {};
