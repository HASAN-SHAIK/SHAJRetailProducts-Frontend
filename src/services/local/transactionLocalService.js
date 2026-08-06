import { getTransactionRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  saveTransactionsBulk,
  upsertTransaction,
  getTransactions,
  getTransactionById,
  upsertAccountingTransaction,
  getAccountingTransactions,
  getAllTransactionRecords,
} = createRepositoryFacade(() => getTransactionRepository(), [
  'saveTransactionsBulk',
  'upsertTransaction',
  'getTransactions',
  'getTransactionById',
  'upsertAccountingTransaction',
  'getAccountingTransactions',
  'getAllTransactionRecords',
]);
