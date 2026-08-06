/**
 * @typedef {object} IDatabaseRepository
 * @property {() => Promise<import('dexie').Dexie>} initDB
 * @property {(entityType: string, data: object) => object} validateAndPrepare
 */

export {};
