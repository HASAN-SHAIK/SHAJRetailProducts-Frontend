import { getBackupRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const { exportLocalDbSnapshot, restoreLocalDbSnapshot } = createRepositoryFacade(
  () => getBackupRepository(),
  ['exportLocalDbSnapshot', 'restoreLocalDbSnapshot']
);
