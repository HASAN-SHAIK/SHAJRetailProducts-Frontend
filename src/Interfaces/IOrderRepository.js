/**
 * @typedef {object} IOrderRepository
 * @property {(orders: object|object[]) => Promise<void>} upsertOrders
 * @property {(orders: object[]) => Promise<void>} replaceAllOrders
 * @property {(orderId: string|number) => Promise<object|undefined>} getCachedOrderById
 * @property {(orderId: string|number) => Promise<object[]>} getCachedOrderItems
 * @property {(orderId: string|number, items?: object[]) => Promise<void>} replaceCachedOrderItems
 * @property {(type?: string) => Promise<object[]>} getCachedOrdersByType
 * @property {(type?: string, orders?: object[]) => Promise<void>} replaceCachedOrdersByType
 * @property {(type?: string) => Promise<void>} clearCachedOrdersByType
 * @property {(orderId: string|number) => Promise<object[]>} getCachedOrderTransactions
 * @property {(payload?: {order?: object, items?: object[], payments?: object[]}) => Promise<void>} upsertOrderDetailsCache
 * @property {(orderId: string|number) => Promise<{order?: object, items?: object[], payments?: object[]}|undefined>} getCachedOrderDetails
 * @property {(options?: {page?: number, limit?: number}) => Promise<{orders: object[], total: number}>} getCachedOrdersPage
 * @property {() => Promise<object[]>} getAllCachedOrders
 * @property {(customer?: object) => Promise<object[]>} getCachedOrdersByCustomer
 * @property {() => Promise<void>} clearOrdersCache
 * @property {(ids?: Array<string|number>) => Promise<number>} deleteOrdersByIds
 * @property {() => Promise<object[]>} getAllOrderRecords
 * @property {(orderId: string|number) => Promise<object|undefined>} getOrderRecordById
 * @property {(orderId: string|number) => Promise<object[]>} getOrderItemsByOrderId
 * @property {() => Promise<object[]>} getSalesOrderRecords
 * @property {() => Promise<object[]>} getPurchaseOrderRecords
 * @property {(rows: object[]) => Promise<void>} bulkPutSalesOrders
 * @property {(rows: object[]) => Promise<void>} bulkPutPurchaseOrders
 * @property {() => Promise<void>} clearSalesOrders
 * @property {() => Promise<void>} clearPurchaseOrders
 * @property {() => Promise<[object[], object[]]>} getSalesAndPurchaseOrderCounts
 * @property {(options?: object) => Promise<{list: object[], pagination: object}>} listOrders
 * @property {(orderId: string|number) => Promise<object|null>} getOrderDetail
 * @property {(payload: object, options?: object) => Promise<{order: object|null, orderId: string|number|null, data: object}>} createOrder
 * @property {(orderId: string|number, payload: object) => Promise<object>} updateOrder
 * @property {(orderId: string|number) => Promise<void>} deleteOrder
 * @property {(payload: object) => Promise<{results: object[]}>} syncOfflineOrders
 * @property {(payload: object) => Promise<object>} markOrderPaid
 * @property {(orderId: string|number, payload: object) => Promise<object>} createOrderReturn
 * @property {() => Promise<object[]>} fetchReturns
 * @property {() => Promise<object[]>} fetchCorrections
 * @property {(payload: object) => Promise<object>} createCorrection
 * @property {(returnId: string|number) => Promise<void>} deleteReturn
 * @property {(returnId: string|number|null, payload: object) => Promise<void>} upsertReturn
 * @property {(correctionId: string|number) => Promise<void>} deleteCorrection
 * @property {(correctionId: string|number|null, payload: object) => Promise<void>} upsertCorrection
 */

export {};
