import * as storage from './internal/storage';

/** @implements {import('../Interfaces/IConfigRepository').IConfigRepository} */
export class IndexedDbConfigRepository {
  saveConfigValue(key, value) {
    return storage.saveConfigValue(key, value);
  }

  getConfigValue(key) {
    return storage.getConfigValue(key);
  }
}
