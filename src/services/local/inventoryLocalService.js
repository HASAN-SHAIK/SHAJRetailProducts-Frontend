import { getInventoryRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export {
  listPurchases,
  getPurchaseDetail,
  createPurchase,
  importPurchasePdf,
  createPurchaseReturn,
} from './purchaseLocalService';

export const {
  getBranchStock,
  getStockConsistencyLatest,
  runStockConsistency,
  fetchInventoryIntelligence,
  getStockCount,
  isBatchExpired,
  sumBatchQuantityRemaining,
} = createRepositoryFacade(() => getInventoryRepository(), [
  'getBranchStock',
  'getStockConsistencyLatest',
  'runStockConsistency',
  'fetchInventoryIntelligence',
  'getStockCount',
  'isBatchExpired',
  'sumBatchQuantityRemaining',
]);
