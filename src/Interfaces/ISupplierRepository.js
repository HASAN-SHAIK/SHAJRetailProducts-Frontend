/**
 * @typedef {object} ISupplierRepository
 * @property {(suppliers: object[]) => Promise<void>} updateSuppliersCacheBulk
 * @property {() => Promise<object[]>} getAllSuppliersCache
 * @property {(supplierId: string|number) => Promise<object|undefined>} getSupplierCacheById
 * @property {(ids?: Array<string|number>) => Promise<void>} deleteSuppliersCacheByIds
 * @property {(entry: object) => Promise<void>} upsertSupplierLedgerEntry
 * @property {(entries?: object[]) => Promise<void>} upsertSupplierLedgerBulk
 * @property {(supplierId: string|number) => Promise<object[]>} getSupplierLedgerBySupplierId
 * @property {() => Promise<void>} dedupeSuppliersCache
 * @property {(supplier: object) => Promise<void>} upsertLocalSupplier
 * @property {(status?: string|null) => Promise<object[]>} getLocalSuppliers
 * @property {(supplierId: string|number) => Promise<object|undefined>} getLocalSupplierById
 * @property {(supplierId: string|number) => Promise<void>} deleteLocalSupplier
 * @property {(options?: { search?: string, limit?: number, branchId?: string|null }) => Promise<object[]>} searchSuppliers
 * @property {(supplierId: string|number) => Promise<object|undefined>} getSupplierById
 * @property {(supplierId: string|number) => Promise<object|null>} getSupplierLedgerDetail
 * @property {(payload: object) => Promise<object|null>} createSupplier
 * @property {(supplierId: string|number, payload: object) => Promise<object|null>} updateSupplier
 * @property {(supplierId: string|number) => Promise<void>} deleteSupplier
 */

export {};
