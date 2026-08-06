import { getBillingRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  upsertProducts,
  searchProducts,
  getProductByBarcode,
  saveOrder,
  getOrderById,
  getOrdersByStatus,
  updateOrdersBulk,
  replaceOrderItems,
  getOrderItems,
  addSyncQueueEntry,
  updateSyncQueueEntry,
  getPendingSyncEntries,
  findPendingSyncEntry,
  getAllCustomers,
} = createRepositoryFacade(() => getBillingRepository(), [
  'upsertProducts',
  'searchProducts',
  'getProductByBarcode',
  'saveOrder',
  'getOrderById',
  'getOrdersByStatus',
  'updateOrdersBulk',
  'replaceOrderItems',
  'getOrderItems',
  'addSyncQueueEntry',
  'updateSyncQueueEntry',
  'getPendingSyncEntries',
  'findPendingSyncEntry',
  'getAllCustomers',
]);
