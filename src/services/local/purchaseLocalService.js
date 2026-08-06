import { getPurchaseRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  upsertLocalPurchase,
  upsertLocalPurchasesBulk,
  getLocalPurchases,
  getLocalPurchaseById,
  addLocalPurchaseItems,
  getLocalPurchaseItems,
  upsertLocalPurchaseReturn,
  getLocalPurchaseReturns,
  getLocalPurchaseReturnById,
  listPurchases,
  getPurchaseDetail,
  createPurchase,
  importPurchasePdf,
  createPurchaseReturn,
} = createRepositoryFacade(() => getPurchaseRepository(), [
  'upsertLocalPurchase',
  'upsertLocalPurchasesBulk',
  'getLocalPurchases',
  'getLocalPurchaseById',
  'addLocalPurchaseItems',
  'getLocalPurchaseItems',
  'upsertLocalPurchaseReturn',
  'getLocalPurchaseReturns',
  'getLocalPurchaseReturnById',
  'listPurchases',
  'getPurchaseDetail',
  'createPurchase',
  'importPurchasePdf',
  'createPurchaseReturn',
]);
