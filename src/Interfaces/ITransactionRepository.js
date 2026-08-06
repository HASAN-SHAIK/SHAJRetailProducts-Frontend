/**
 * @typedef {object} ITransactionRepository
 * @property {(transactions: object[]) => Promise<void>} saveTransactionsBulk
 * @property {(transaction: object) => Promise<void>} upsertTransaction
 * @property {() => Promise<object[]>} getTransactions
 * @property {(transactionId: string|number) => Promise<object|undefined>} getTransactionById
 * @property {(transaction: object) => Promise<void>} upsertAccountingTransaction
 * @property {(filters?: object) => Promise<object[]>} getAccountingTransactions
 * @property {() => Promise<object[]>} getAllTransactionRecords
 */

export {};
