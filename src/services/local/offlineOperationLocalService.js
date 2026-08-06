import { getOfflineOperationRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  enqueueOperation,
  updateOperation,
  listOperations,
  findOperation,
  countPendingOperations,
  getQueueSummary,
} = createRepositoryFacade(() => getOfflineOperationRepository(), [
  'enqueueOperation',
  'updateOperation',
  'listOperations',
  'findOperation',
  'countPendingOperations',
  'getQueueSummary',
]);
