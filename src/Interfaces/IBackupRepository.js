/**
 * @typedef {object} IBackupRepository
 * @property {() => Promise<object>} exportLocalDbSnapshot
 * @property {(snapshot?: object) => Promise<void>} restoreLocalDbSnapshot
 */

export {};
