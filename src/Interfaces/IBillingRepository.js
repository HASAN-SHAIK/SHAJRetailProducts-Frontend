/**
 * @typedef {object} IBillingRepository
 * @property {(products: object[]) => Promise<void>} upsertProducts
 * @property {(term: string) => Promise<object[]>} searchProducts
 * @property {(barcode: string) => Promise<object|undefined>} getProductByBarcode
 * @property {(order: object) => Promise<object>} saveOrder
 * @property {(orderId: string|number) => Promise<object|undefined>} getOrderById
 * @property {(status: string, transactionType?: string) => Promise<object[]>} getOrdersByStatus
 * @property {(orders: object[]) => Promise<void>} updateOrdersBulk
 * @property {(orderId: string|number, items: object[]) => Promise<void>} replaceOrderItems
 * @property {(orderId: string|number) => Promise<object[]>} getOrderItems
 * @property {(entry: object) => Promise<void>} addSyncQueueEntry
 * @property {(entry: object) => Promise<void>} updateSyncQueueEntry
 * @property {() => Promise<object[]>} getPendingSyncEntries
 * @property {(orderId: string|number, action: string) => Promise<object|undefined>} findPendingSyncEntry
 * @property {() => Promise<object[]>} getAllCustomers
 */

export {};
