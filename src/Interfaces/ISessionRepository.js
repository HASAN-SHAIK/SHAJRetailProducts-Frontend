/**
 * @typedef {object} ISessionRepository
 * @property {(key: string, value: unknown) => Promise<void>} saveSessionValue
 * @property {(key: string) => Promise<unknown>} getSessionValue
 * @property {(key: string) => Promise<void>} clearSessionValue
 * @property {() => Promise<void>} clearSessionStore
 */

export {};
