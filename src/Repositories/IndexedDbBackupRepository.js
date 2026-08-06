import * as storage from './internal/storage';

/** @implements {import('../Interfaces/IBackupRepository').IBackupRepository} */
export class IndexedDbBackupRepository {
  exportLocalDbSnapshot() {
    return storage.exportLocalDbSnapshot();
  }

  restoreLocalDbSnapshot(snapshot = {}) {
    return storage.restoreLocalDbSnapshot(snapshot);
  }
}
