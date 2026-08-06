import { getSessionRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  saveSessionValue,
  getSessionValue,
  clearSessionValue,
  clearSessionStore,
} = createRepositoryFacade(() => getSessionRepository(), [
  'saveSessionValue',
  'getSessionValue',
  'clearSessionValue',
  'clearSessionStore',
]);
