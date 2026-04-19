import api from '../utils/axios';
import type { SyncHandlerMap, SyncOperation } from './types';

const toPath = (entity: string, id: string): string => {
  switch (entity) {
    case 'product':
      return `/products/${encodeURIComponent(id)}`;
    case 'invoice':
      return `/orders/${encodeURIComponent(id)}`;
    case 'customer':
      return `/customers/${encodeURIComponent(id)}`;
    default:
      return `/${entity}/${encodeURIComponent(id)}`;
  }
};

const toCollectionPath = (entity: string): string => {
  switch (entity) {
    case 'product':
      return '/products';
    case 'invoice':
      return '/orders';
    case 'customer':
      return '/customers';
    default:
      return `/${entity}`;
  }
};

const callApi = async (
  entity: string,
  operation: SyncOperation,
  entityId: string,
  payload: unknown
): Promise<void> => {
  switch (operation) {
    case 'create':
      await api.post(toCollectionPath(entity), payload);
      return;
    case 'update':
      await api.put(toPath(entity, entityId), payload);
      return;
    case 'delete':
      await api.delete(toPath(entity, entityId));
      return;
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
};

const entityHandlers = (entity: string): SyncHandlerMap[string] => ({
  create: async ({ queueItem }) => callApi(entity, 'create', queueItem.entityId, queueItem.payload),
  update: async ({ queueItem }) => callApi(entity, 'update', queueItem.entityId, queueItem.payload),
  delete: async ({ queueItem }) => callApi(entity, 'delete', queueItem.entityId, queueItem.payload),
});

export const defaultSyncHandlers: SyncHandlerMap = {
  product: entityHandlers('product'),
  invoice: entityHandlers('invoice'),
  customer: entityHandlers('customer'),
};
