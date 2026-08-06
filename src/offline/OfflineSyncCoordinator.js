import { getSyncPlan } from '../utils/syncStrategy';
import { canReachServer } from './offlineFirstPolicy';
import { SYNC_STATUS } from './constants';
import {
  countPendingOperations,
  getQueueSummary,
  listOperations,
  updateOperation,
} from '../services/local/offlineOperationLocalService';
import { submitSyncOperations } from '../Repositories/api/syncOperationApiClient';

const mapApiResultToLocalStatus = (result = {}) => {
  if (!result?.ok) return SYNC_STATUS.FAILED;
  if (result.status === SYNC_STATUS.SYNCED || result.duplicate) return SYNC_STATUS.SYNCED;
  if (result.queued) return SYNC_STATUS.PROCESSING;
  if (result.applied?.status === SYNC_STATUS.SYNCED) return SYNC_STATUS.SYNCED;
  return SYNC_STATUS.PENDING;
};

/**
 * Offline sync coordinator.
 * Submits queued operations to the server sync API (RabbitMQ when enabled).
 */
export class OfflineSyncCoordinator {
  async getStatus(context = {}) {
    const [summary, pendingCount, plan] = await Promise.all([
      getQueueSummary(),
      countPendingOperations(),
      getSyncPlan(context).catch(() => ({ mode: 'delta', reason: 'unknown' })),
    ]);
    return {
      online: canReachServer(),
      pendingCount,
      summary,
      plan,
      syncEnabled: true,
    };
  }

  async listPending(filters = {}) {
    return listOperations({
      statuses: ['pending', 'failed', 'processing'],
      ...filters,
    });
  }

  async processQueue(options = {}) {
    if (!canReachServer()) {
      return {
        status: 'offline',
        processed: 0,
        failed: 0,
        message: 'Server is unreachable. Operations remain queued locally.',
      };
    }

    const batchSize = Number(options.batchSize || 25);
    const pending = await this.listPending();
    if (pending.length === 0) {
      return {
        status: 'empty',
        processed: 0,
        failed: 0,
        message: 'No pending operations in local queue.',
      };
    }

    const batch = pending.slice(0, batchSize);
    let processed = 0;
    let failed = 0;
    const results = [];

    try {
      const response = await submitSyncOperations(batch);
      const apiResults = Array.isArray(response?.results) ? response.results : [];

      for (let index = 0; index < batch.length; index += 1) {
        const localOp = batch[index];
        const apiResult =
          apiResults.find(
            (entry) =>
              entry?.clientId === localOp.clientId ||
              entry?.clientId === localOp.client_id
          ) || apiResults[index];

        const nextStatus = mapApiResultToLocalStatus(apiResult);
        if (localOp?.id) {
          await updateOperation({
            ...localOp,
            status: nextStatus,
            lastError: apiResult?.error || apiResult?.code || null,
          });
        }

        if (nextStatus === SYNC_STATUS.FAILED) failed += 1;
        else processed += 1;
        results.push({ localId: localOp.id, clientId: localOp.clientId, apiResult, nextStatus });
      }

      return {
        status: failed > 0 ? 'partial' : 'completed',
        processed,
        failed,
        mode: response?.meta?.mode || 'unknown',
        results,
      };
    } catch (error) {
      return {
        status: 'error',
        processed,
        failed: batch.length - processed,
        message: error?.message || 'Failed to submit sync operations.',
      };
    }
  }

  async prepareSyncCycle(context = {}, options = {}) {
    const plan = await getSyncPlan(context, options);
    const summary = await getQueueSummary();
    return {
      plan,
      summary,
      ready: canReachServer(),
      note: 'Sync cycle prepared. Call processQueue() to submit queued operations.',
    };
  }
}

export const offlineSyncCoordinator = new OfflineSyncCoordinator();
