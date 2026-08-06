import { getDatabaseRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

const { initDB, validateAndPrepare } = createRepositoryFacade(() => getDatabaseRepository(), [
  'initDB',
  'validateAndPrepare',
]);

export { initDB, validateAndPrepare };
