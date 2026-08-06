import { initDB, validateAndPrepare } from './internal/storage';

/** @implements {import('../Interfaces/IDatabaseRepository').IDatabaseRepository} */
export class IndexedDbDatabaseRepository {
  initDB() {
    return initDB();
  }

  validateAndPrepare(entityType, data) {
    return validateAndPrepare(entityType, data);
  }
}
