/**
 * @typedef {object} IMobileRepository
 * @property {(options?: object) => Promise<object|null>} getDashboard
 * @property {() => Promise<object|null>} getSalesSummary
 * @property {(options?: object) => Promise<{ products: object[], meta: object|null }>} getLowStock
 */

export {};
