import { getOfflineRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';
import { isLegacyBrowserSyncAllowed } from '../../utils/legacyBrowserSyncAuthority';

const offlineFacade = createRepositoryFacade(() => getOfflineRepository(), [
  'getOfflineOrders',
  'saveOfflineOrdersBulk',
  'upsertOfflineOrder',
  'deleteOfflineOrdersByIds',
  'getOfflineImports',
  'upsertOfflinePurchase',
  'addOfflinePurchaseItems',
  'getOfflinePurchases',
  'getOfflinePurchaseItems',
  'upsertOfflinePurchaseReturn',
  'getOfflinePurchaseReturns',
  'addOfflineImport',
  'getOfflineImportItems',
  'updateOfflineImport',
  'updateOfflineImportStatus',
]);

export const {
  saveOfflineOrdersBulk,
  upsertOfflineOrder,
  deleteOfflineOrdersByIds,
  upsertOfflinePurchase,
  addOfflinePurchaseItems,
  getOfflinePurchases,
  getOfflinePurchaseItems,
  upsertOfflinePurchaseReturn,
  getOfflinePurchaseReturns,
  addOfflineImport,
  getOfflineImportItems,
  updateOfflineImport,
  updateOfflineImportStatus,
} = offlineFacade;

export const getOfflineOrders = (...args) =>
  isLegacyBrowserSyncAllowed() ? offlineFacade.getOfflineOrders(...args) : Promise.resolve([]);

export const getOfflineImports = (...args) =>
  isLegacyBrowserSyncAllowed() ? offlineFacade.getOfflineImports(...args) : Promise.resolve([]);
