import { getConfigRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const { saveConfigValue, getConfigValue } = createRepositoryFacade(() => getConfigRepository(), [
  'saveConfigValue',
  'getConfigValue',
]);
