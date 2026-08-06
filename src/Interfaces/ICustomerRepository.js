/**
 * @typedef {object} ICustomerRepository
 * @property {() => Promise<object[]>} getAllCustomers
 * @property {(customer: object) => Promise<void>} upsertCustomerLocal
 * @property {(customerId: string|number) => Promise<object|undefined>} getCustomerById
 * @property {(customers: object[]) => Promise<void>} saveCustomersBulk
 * @property {(customers: object[]) => Promise<void>} upsertCustomersBulk
 * @property {() => Promise<object[]>} getAllCustomerRecords
 * @property {(options?: { search?: string, limit?: number }) => Promise<object[]>} searchCustomers
 * @property {(customerId: string|number) => Promise<object|null>} getCustomerDetail
 * @property {(payload: object) => Promise<object|null>} createCustomer
 * @property {(customerId: string|number, payload: object) => Promise<object|null>} updateCustomer
 */

export {};
