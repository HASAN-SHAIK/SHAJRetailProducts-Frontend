/**
 * @typedef {object} IOfflineOperationRepository
 * @property {(operation: object) => Promise<object>} enqueueOperation
 * @property {(operation: object) => Promise<object|null>} updateOperation
 * @property {(filters?: object) => Promise<object[]>} listOperations
 * @property {(query: object) => Promise<object|null>} findOperation
 * @property {() => Promise<number>} countPendingOperations
 * @property {() => Promise<object>} getQueueSummary
 */

export {};
