import { getOrderRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';
import { isLocalPosEnabled, localPosRequest } from '../../Repositories/local/posLocalApiClient';
import { requestManagerApproval } from '../managerApprovalService';
import { signalRefundDiagnosticsRefresh } from './refundDiagnosticsEvents';

const orderFacade = createRepositoryFacade(() => getOrderRepository(), [
  'upsertOrders',
  'replaceAllOrders',
  'getCachedOrderById',
  'getCachedOrderItems',
  'replaceCachedOrderItems',
  'getCachedOrdersByType',
  'replaceCachedOrdersByType',
  'clearCachedOrdersByType',
  'getCachedOrderTransactions',
  'upsertOrderDetailsCache',
  'getCachedOrderDetails',
  'getCachedOrdersPage',
  'getAllCachedOrders',
  'getCachedOrdersByCustomer',
  'clearOrdersCache',
  'deleteOrdersByIds',
  'getAllOrderRecords',
  'getOrderRecordById',
  'getOrderItemsByOrderId',
  'getSalesOrderRecords',
  'getPurchaseOrderRecords',
  'bulkPutSalesOrders',
  'bulkPutPurchaseOrders',
  'clearSalesOrders',
  'clearPurchaseOrders',
  'getSalesAndPurchaseOrderCounts',
  'listOrders',
  'getOrderDetail',
  'createOrder',
  'updateOrder',
  'deleteOrder',
  'syncOfflineOrders',
  'markOrderPaid',
  'createOrderReturn',
  'fetchReturns',
  'fetchCorrections',
  'createCorrection',
  'deleteReturn',
  'upsertReturn',
  'deleteCorrection',
  'upsertCorrection',
]);

export const {
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
  getAllOrderRecords,
  getOrderRecordById,
  getOrderItemsByOrderId,
  getSalesOrderRecords,
  getPurchaseOrderRecords,
  bulkPutSalesOrders,
  bulkPutPurchaseOrders,
  clearSalesOrders,
  clearPurchaseOrders,
  getSalesAndPurchaseOrderCounts,
  listOrders,
  getOrderDetail,
  createOrder,
  updateOrder,
  syncOfflineOrders,
  markOrderPaid,
  createOrderReturn,
  fetchReturns,
  fetchCorrections,
  createCorrection,
  deleteReturn,
  upsertReturn,
  deleteCorrection,
  upsertCorrection,
} = orderFacade;

const localVoidReason = (options = {}) =>
  String(options.reason || 'Order cancelled from Orders screen').trim();

const runLocalVoid = (orderId, options = {}) =>
  localPosRequest(`/orders/${encodeURIComponent(String(orderId))}/void`, {
    method: 'POST',
    body: { reason: localVoidReason(options) },
    approvalToken: options.approvalToken || null,
  });

export const deleteOrder = async (orderId, options = {}) => {
  if (!isLocalPosEnabled()) {
    return orderFacade.deleteOrder(orderId, options);
  }
  if (!orderId) throw new Error('order_id_required');

  try {
    return await runLocalVoid(orderId, options);
  } catch (error) {
    const code = error?.payload?.error || error?.response?.data?.error || error?.message;
    const requiredPermission =
      error?.payload?.required_permission ||
      error?.response?.data?.required_permission ||
      'pos:void';

    if (code !== 'manager_approval_required' || options?.approvalToken) {
      throw error;
    }

    const approval = await requestManagerApproval(requiredPermission, { orderId });
    return runLocalVoid(orderId, {
      ...options,
      approvalToken: approval.approval_token,
    });
  }
};

const localRefundReason = (options = {}) => String(options.reason || '').trim();

const runLocalRefund = (orderId, options = {}) =>
  localPosRequest(`/orders/${encodeURIComponent(String(orderId))}/refund`, {
    method: 'POST',
    body: { reason: localRefundReason(options) },
    approvalToken: options.approvalToken || null,
  });

const runFullRefundAndSignal = async (orderId, options = {}) => {
  try {
    const result = await runLocalRefund(orderId, options);
    signalRefundDiagnosticsRefresh(orderId, 'full_refund_succeeded');
    return result;
  } catch (error) {
    const code = error?.payload?.error || error?.response?.data?.error || error?.message;
    if (code === 'refund_reconciliation_required') {
      signalRefundDiagnosticsRefresh(orderId, code);
    }
    throw error;
  }
};

export const refundOrder = async (orderId, options = {}) => {
  if (!isLocalPosEnabled()) throw new Error('local_pos_refund_not_enabled');
  if (!orderId) throw new Error('order_id_required');
  if (!localRefundReason(options)) throw new Error('refund_reason_required');

  try {
    return await runFullRefundAndSignal(orderId, options);
  } catch (error) {
    const code = error?.payload?.error || error?.response?.data?.error || error?.message;
    const requiredPermission =
      error?.payload?.required_permission ||
      error?.response?.data?.required_permission ||
      'pos:refund';

    if (code !== 'manager_approval_required' || options?.approvalToken) {
      throw error;
    }

    const approval = await requestManagerApproval(requiredPermission, { orderId });
    return runFullRefundAndSignal(orderId, {
      ...options,
      approvalToken: approval.approval_token,
    });
  }
};

const orderCacheApi = {
  upsertOrders,
  replaceAllOrders,
  getCachedOrdersByType,
  replaceCachedOrdersByType,
  clearCachedOrdersByType,
  getCachedOrdersPage,
  getAllCachedOrders,
  clearOrdersCache,
  deleteOrdersByIds,
};

export default orderCacheApi;
