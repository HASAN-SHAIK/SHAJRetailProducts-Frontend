import { IndexedDbOrderRepository } from './IndexedDbOrderRepository';
import {
  createCorrectionRemote,
  createOrderRemote,
  createOrderReturnRemote,
  deleteCorrectionRemote,
  deleteOrderRemote,
  deleteReturnRemote,
  fetchCorrectionsRemote,
  fetchOrderDetailRemote,
  fetchReturnsRemote,
  listOrdersRemote,
  markOrderPaidRemote,
  syncOfflineOrdersRemote,
  updateOrderRemote,
  upsertCorrectionRemote,
  upsertReturnRemote,
} from './api/saleApiClient';

/** @implements {import('../Interfaces/IOrderRepository').IOrderRepository} */
export class ApiOrderRepository extends IndexedDbOrderRepository {
  listOrders(options = {}) {
    return listOrdersRemote(options);
  }

  getOrderDetail(orderId) {
    return fetchOrderDetailRemote(orderId);
  }

  createOrder(payload, options = {}) {
    return createOrderRemote(payload, options);
  }

  updateOrder(orderId, payload) {
    return updateOrderRemote(orderId, payload);
  }

  deleteOrder(orderId) {
    return deleteOrderRemote(orderId);
  }

  syncOfflineOrders(payload) {
    return syncOfflineOrdersRemote(payload);
  }

  markOrderPaid(payload) {
    return markOrderPaidRemote(payload);
  }

  createOrderReturn(orderId, payload) {
    return createOrderReturnRemote(orderId, payload);
  }

  fetchReturns() {
    return fetchReturnsRemote();
  }

  fetchCorrections() {
    return fetchCorrectionsRemote();
  }

  createCorrection(payload) {
    return createCorrectionRemote(payload);
  }

  deleteReturn(returnId) {
    return deleteReturnRemote(returnId);
  }

  upsertReturn(returnId, payload) {
    return upsertReturnRemote(returnId, payload);
  }

  deleteCorrection(correctionId) {
    return deleteCorrectionRemote(correctionId);
  }

  upsertCorrection(correctionId, payload) {
    return upsertCorrectionRemote(correctionId, payload);
  }
}
