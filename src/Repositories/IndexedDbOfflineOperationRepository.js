import { OFFLINE_EVENTS, SYNC_STATUS } from '../offline/constants';
import { buildSyncOperationEnvelope } from '../offline/conflictResolution';

const emit = (eventName, detail = {}) => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch {
    // ignore
  }
};

const normalizeOperation = (entry = {}) => ({
  id: entry.id ?? null,
  module: entry.module || entry.payload?.module || 'general',
  entityType: entry.entityType || entry.type || 'unknown',
  entityId: entry.entityId ?? entry.refId ?? entry.order_id ?? null,
  action: String(entry.action || 'UPDATE').toUpperCase(),
  status: String(entry.status || SYNC_STATUS.PENDING).toLowerCase(),
  priority: Number(entry.priority || 3),
  clientId: entry.client_id || entry.clientId || entry.payload?.client_id || null,
  payload: entry.payload || null,
  retryCount: Number(entry.retry_count ?? entry.retryCount ?? 0),
  lastError: entry.last_error || entry.lastError || null,
  createdAt: entry.createdAt || entry.created_at || null,
  updatedAt: entry.updated_at || entry.updatedAt || null,
  type: entry.type || entry.entityType || 'unknown',
  order_id: entry.order_id ?? null,
  refId: entry.refId ?? null,
});

const toQueueRecord = (operation = {}) => {
  const entityType = operation.entityType || operation.type || 'unknown';
  return {
    module: operation.module || 'general',
    entityType,
    type: entityType,
    entityId: operation.entityId,
    action: operation.action,
    status: operation.status || SYNC_STATUS.PENDING,
    priority: operation.priority || 3,
    client_id: operation.clientId || operation.client_id || null,
    payload: operation.payload || null,
    retry_count: operation.retryCount || 0,
    last_error: operation.lastError || null,
    order_id: operation.order_id || operation.entityId || null,
    refId: operation.refId || operation.entityId || null,
    createdAt: operation.createdAt || new Date().toISOString(),
    updated_at: operation.updatedAt || new Date().toISOString(),
  };
};

/** @implements {import('../Interfaces/IOfflineOperationRepository').IOfflineOperationRepository} */
export class IndexedDbOfflineOperationRepository {
  constructor() {
    this.syncApi = null;
  }

  async getSyncApi() {
    if (!this.syncApi) {
      this.syncApi = await import('../services/local/syncLocalService');
    }
    return this.syncApi;
  }

  async enqueueOperation(operation = {}) {
    const syncApi = await this.getSyncApi();
    const enveloped = buildSyncOperationEnvelope(operation);
    const normalized = toQueueRecord({
      ...enveloped,
      action: String(enveloped.action || operation.action || 'UPDATE').toUpperCase(),
      status: SYNC_STATUS.PENDING,
    });

    const existing = await syncApi.findInventorySyncQueueEntry(
      normalized.type,
      normalized.entityId,
      normalized.action
    );
    if (existing?.id) {
      const updated = await syncApi.updateInventorySyncQueueEntry({
        ...existing,
        ...normalized,
        id: existing.id,
        status: SYNC_STATUS.PENDING,
      });
      const result = normalizeOperation(updated);
      emit(OFFLINE_EVENTS.OPERATION_UPDATED, { operation: result });
      emit(OFFLINE_EVENTS.QUEUE_UPDATED, { count: await this.countPendingOperations() });
      return result;
    }

    const created = await syncApi.addInventorySyncQueueEntry(normalized);
    const result = normalizeOperation(created);
    emit(OFFLINE_EVENTS.OPERATION_QUEUED, { operation: result });
    emit(OFFLINE_EVENTS.QUEUE_UPDATED, { count: await this.countPendingOperations() });
    return result;
  }

  async updateOperation(operation = {}) {
    if (!operation?.id) return null;
    const syncApi = await this.getSyncApi();
    const updated = await syncApi.updateInventorySyncQueueEntry(toQueueRecord(operation));
    const result = normalizeOperation(updated);
    emit(OFFLINE_EVENTS.OPERATION_UPDATED, { operation: result });
    emit(OFFLINE_EVENTS.QUEUE_UPDATED, { count: await this.countPendingOperations() });
    return result;
  }

  async listOperations(filters = {}) {
    const syncApi = await this.getSyncApi();
    const statuses = filters.statuses || [SYNC_STATUS.PENDING, SYNC_STATUS.FAILED, SYNC_STATUS.PROCESSING];
    const list = await syncApi.getInventorySyncQueueEntries(statuses);
    return list
      .map(normalizeOperation)
      .filter((entry) => {
        if (filters.module && entry.module !== filters.module) return false;
        if (filters.entityType && entry.entityType !== filters.entityType) return false;
        if (filters.action && entry.action !== String(filters.action).toUpperCase()) return false;
        return true;
      })
      .sort((a, b) => {
        const priorityDelta = Number(a.priority || 3) - Number(b.priority || 3);
        if (priorityDelta !== 0) return priorityDelta;
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      });
  }

  async findOperation({ module, entityType, entityId, action }) {
    const syncApi = await this.getSyncApi();
    const match = await syncApi.findInventorySyncQueueEntry(entityType, entityId, action);
    if (!match) return null;
    const normalized = normalizeOperation(match);
    if (module && normalized.module !== module) return null;
    return normalized;
  }

  async countPendingOperations() {
    const pending = await this.listOperations({
      statuses: [SYNC_STATUS.PENDING, SYNC_STATUS.FAILED, SYNC_STATUS.PROCESSING],
    });
    return pending.length;
  }

  async getQueueSummary() {
    const all = await this.listOperations({
      statuses: [SYNC_STATUS.PENDING, SYNC_STATUS.FAILED, SYNC_STATUS.PROCESSING, SYNC_STATUS.SYNCED],
    });
    const summary = {
      total: all.length,
      pending: 0,
      processing: 0,
      failed: 0,
      synced: 0,
      byModule: {},
    };
    all.forEach((entry) => {
      const status = String(entry.status || '').toLowerCase();
      if (status === SYNC_STATUS.PENDING) summary.pending += 1;
      else if (status === SYNC_STATUS.PROCESSING) summary.processing += 1;
      else if (status === SYNC_STATUS.FAILED) summary.failed += 1;
      else if (status === SYNC_STATUS.SYNCED) summary.synced += 1;
      const moduleName = entry.module || 'general';
      if (!summary.byModule[moduleName]) {
        summary.byModule[moduleName] = { pending: 0, failed: 0, total: 0 };
      }
      summary.byModule[moduleName].total += 1;
      if (status === SYNC_STATUS.PENDING || status === SYNC_STATUS.PROCESSING) {
        summary.byModule[moduleName].pending += 1;
      }
      if (status === SYNC_STATUS.FAILED) summary.byModule[moduleName].failed += 1;
    });
    return summary;
  }
}

export { normalizeOperation, toQueueRecord };
