/**
 * @typedef {object} ISyncRepository
 * @property {(entry: object) => Promise<void>} addInventorySyncQueueEntry
 * @property {(entry: object) => Promise<void>} updateInventorySyncQueueEntry
 * @property {(statuses?: string[]) => Promise<object[]>} getInventorySyncQueueEntries
 * @property {(type: string, entityId: string|number, action: string) => Promise<object|undefined>} findInventorySyncQueueEntry
 * @property {(payload: object) => Promise<void>} addSyncLog
 * @property {(oldId: string|number, newId: string|number) => Promise<void>} replaceProductIdReferences
 * @property {(oldId: string|number, newId: string|number) => Promise<void>} replaceSupplierIdReferences
 * @property {(oldId: string|number, newId: string|number) => Promise<void>} replaceCustomerIdReferences
 * @property {(entry: object) => Promise<void>} addSyncQueueItem
 * @property {(entry: object) => Promise<void>} updateSyncQueueItem
 * @property {(filters?: object) => Promise<object[]>} getSyncQueueItems
 * @property {(payload: object) => Promise<void>} addProductIdMapping
 * @property {() => Promise<object[]>} getProductIdMappings
 * @property {() => Promise<object[]>} getAllSyncQueueRecords
 */

export {};
