import api from '../../utils/axios';
import { unwrapBody, unwrapMeta } from '../../utils/apiClient';
import { buildSyncOperationEnvelope } from '../../offline/conflictResolution';

const toApiOperation = (operation = {}) => {
  const enveloped = buildSyncOperationEnvelope(operation);
  const payload = enveloped.payload || {};
  return {
    clientId:
      enveloped.clientId ||
      operation.clientId ||
      operation.client_id ||
      payload.client_id ||
      payload.client_order_id ||
      `local-${operation.id || Date.now()}`,
    module: operation.module || 'general',
    entityType: operation.entityType || operation.type || 'unknown',
    entityId: operation.entityId ?? operation.refId ?? operation.order_id ?? null,
    action: String(operation.action || 'UPDATE').toUpperCase(),
    payload,
  };
};

export const submitSyncOperations = async (operations = []) => {
  const payload = {
    operations: (Array.isArray(operations) ? operations : [operations]).map(toApiOperation),
  };
  const response = await api.post('/sync/operations', payload);
  const body = unwrapBody(response) || {};
  const results = Array.isArray(body.results) ? body.results : Array.isArray(body) ? body : [];
  return {
    results,
    meta: unwrapMeta(response),
  };
};

export const getSyncOperationsStatus = async () => {
  const response = await api.get('/sync/operations/status');
  return unwrapBody(response);
};

export const getSyncMetrics = async () => {
  const response = await api.get('/sync/metrics', {
    headers: { Accept: 'text/plain' },
    responseType: 'text',
    transformResponse: [(value) => value],
  });
  return response.data;
};
