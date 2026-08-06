import * as storage from './internal/storage';

/** @implements {import('../Interfaces/ITransactionRepository').ITransactionRepository} */
export class IndexedDbTransactionRepository {
  saveTransactionsBulk(transactions) {
    return storage.saveTransactionsBulk(transactions);
  }

  upsertTransaction(transaction) {
    return storage.upsertTransaction(transaction);
  }

  getTransactions() {
    return storage.getTransactions();
  }

  getTransactionById(transactionId) {
    return storage.getTransactionById(transactionId);
  }

  upsertAccountingTransaction(transaction) {
    return storage.upsertAccountingTransaction(transaction);
  }

  getAccountingTransactions(filters = {}) {
    return storage.getAccountingTransactions(filters);
  }

  getAllTransactionRecords() {
    return storage.db.transactions.toArray();
  }
}
