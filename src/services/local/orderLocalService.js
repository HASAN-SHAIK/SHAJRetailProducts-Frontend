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
  createOrderReturn: createOrderReturnViaRepository,
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

const createReturnId = (orderId) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `ret_${String(orderId || 'order')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const toQuantityMilli = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 1000);
};

const normalizeReturnLinesForLocal = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) throw new Error('partial_refund_lines_required');
  const seen = new Set();
  return items.map((item) => {
    const orderItemId = String(item?.orderItemId ?? item?.order_item_id ?? item?.item_id ?? '').trim();
    const quantityMilli = Number.isInteger(Number(item?.quantityMilli ?? item?.quantity_milli))
      ? Number(item?.quantityMilli ?? item?.quantity_milli)
      : toQuantityMilli(item?.quantity);
    if (!orderItemId || !Number.isInteger(quantityMilli) || quantityMilli <= 0) {
      throw new Error('partial_refund_line_invalid');
    }
    if (seen.has(orderItemId)) throw new Error('partial_refund_line_duplicate');
    seen.add(orderItemId);
    return { order_item_id: orderItemId, quantity_milli: quantityMilli };
  });
};

const runLocalOrderReturn = (orderId, payload = {}, options = {}) =>
  localPosRequest(`/orders/${encodeURIComponent(String(orderId))}/refund`, {
    method: 'POST',
    body: {
      reason: localRefundReason(payload),
      return_id: String(payload.returnId || payload.return_id || createReturnId(orderId)).trim(),
      lines: normalizeReturnLinesForLocal(payload.items),
    },
    approvalToken: options.approvalToken || payload.approvalToken || null,
  });

export const createOrderReturn = async (orderId, payload = {}, options = {}) => {
  if (!isLocalPosEnabled()) return createOrderReturnViaRepository(orderId, payload, options);
  if (!orderId) throw new Error('order_id_required');
  if (!localRefundReason(payload)) throw new Error('refund_reason_required');

  try {
    const result = await runLocalOrderReturn(orderId, payload, options);
    signalRefundDiagnosticsRefresh(orderId, 'partial_refund_succeeded');
    return result;
  } catch (error) {
    const code = error?.payload?.error || error?.response?.data?.error || error?.message;
    const requiredPermission =
      error?.payload?.required_permission ||
      error?.response?.data?.required_permission ||
      'pos:refund';

    if (code === 'refund_reconciliation_required') {
      signalRefundDiagnosticsRefresh(orderId, code);
    }

    if (code !== 'manager_approval_required' || options?.approvalToken || payload?.approvalToken) {
      throw error;
    }

    const approval = await requestManagerApproval(requiredPermission, { orderId, actionScope: 'refund_partial' });
    try {
      const result = await runLocalOrderReturn(orderId, payload, {
        ...options,
        approvalToken: approval.approval_token,
      });
      signalRefundDiagnosticsRefresh(orderId, 'partial_refund_succeeded');
      return result;
    } catch (approvedError) {
      const approvedCode = approvedError?.payload?.error || approvedError?.response?.data?.error || approvedError?.message;
      if (approvedCode === 'refund_reconciliation_required') {
        signalRefundDiagnosticsRefresh(orderId, approvedCode);
      }
      throw approvedError;
    }
  }
};

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

    const approval = await requestManagerApproval(requiredPermission, { orderId, actionScope: 'refund_full' });
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
