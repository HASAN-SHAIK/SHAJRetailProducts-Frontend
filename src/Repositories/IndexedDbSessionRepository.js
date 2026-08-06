import * as storage from './internal/storage';

/** @implements {import('../Interfaces/ISessionRepository').ISessionRepository} */
export class IndexedDbSessionRepository {
  saveSessionValue(key, value) {
    return storage.saveSessionValue(key, value);
  }

  getSessionValue(key) {
    return storage.getSessionValue(key);
  }

  clearSessionValue(key) {
    return storage.clearSessionValue(key);
  }

  clearSessionStore() {
    return storage.clearSessionStore();
  }
}
