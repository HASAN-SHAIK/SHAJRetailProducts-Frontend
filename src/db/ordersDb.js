/**
 * @deprecated Use `services/local/orderLocalService` instead. Kept for backward compatibility.
 */
export {
  upsertOrders,
  replaceAllOrders,
  getCachedOrderById,
  getCachedOrderItems,
  replaceCachedOrderItems,
  getCachedOrdersByType,
  replaceCachedOrdersByType,
  clearCachedOrdersByType,
  getCachedOrderTransactions,
  upsertOrderDetailsCache,
  getCachedOrderDetails,
  getCachedOrdersPage,
  getAllCachedOrders,
  getCachedOrdersByCustomer,
  clearOrdersCache,
  deleteOrdersByIds,
} from '../services/local/orderLocalService';

export { default } from '../services/local/orderLocalService';
