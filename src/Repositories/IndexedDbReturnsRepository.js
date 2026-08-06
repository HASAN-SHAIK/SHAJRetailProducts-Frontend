import * as storage from './internal/storage';

/** @implements {import('../Interfaces/IReturnsRepository').IReturnsRepository} */
export class IndexedDbReturnsRepository {
  upsertLocalSalesReturn(entry) {
    return storage.upsertLocalSalesReturn(entry);
  }

  getLocalSalesReturns(filters = {}) {
    return storage.getLocalSalesReturns(filters);
  }

  getLocalSalesReturnById(returnId) {
    return storage.getLocalSalesReturnById(returnId);
  }

  deleteLocalSalesReturn(returnId) {
    return storage.deleteLocalSalesReturn(returnId);
  }

  upsertLocalCorrection(entry) {
    return storage.upsertLocalCorrection(entry);
  }

  getLocalCorrections(filters = {}) {
    return storage.getLocalCorrections(filters);
  }

  getLocalCorrectionById(correctionId) {
    return storage.getLocalCorrectionById(correctionId);
  }

  deleteLocalCorrection(correctionId) {
    return storage.deleteLocalCorrection(correctionId);
  }

  upsertLocalGstEntry(entry) {
    return storage.upsertLocalGstEntry(entry);
  }

  getLocalGstEntries(filters = {}) {
    return storage.getLocalGstEntries(filters);
  }

  upsertLocalEwayBill(entry) {
    return storage.upsertLocalEwayBill(entry);
  }

  getLocalEwayBills(filters = {}) {
    return storage.getLocalEwayBills(filters);
  }

  deleteLocalEwayBill(ewayId) {
    return storage.deleteLocalEwayBill(ewayId);
  }

  getUnsyncedSalesReturns() {
    return storage.db.sales_returns.where('isSynced').equals(false).toArray();
  }

  getUnsyncedCorrections() {
    return storage.db.corrections.where('isSynced').equals(false).toArray();
  }

  getUnsyncedGstEntries() {
    return storage.db.gst_ledger.where('isSynced').equals(false).toArray();
  }

  getUnsyncedEwayBills() {
    return storage.db.eway_bills.where('isSynced').equals(false).toArray();
  }

  markSalesReturnSynced(entry) {
    return storage.db.sales_returns.put(entry);
  }

  markCorrectionSynced(entry) {
    return storage.db.corrections.put(entry);
  }

  markGstEntrySynced(entry) {
    return storage.db.gst_ledger.put(entry);
  }

  deleteGstEntryById(gstEntryId) {
    return storage.db.gst_ledger.delete(gstEntryId);
  }

  markEwayBillSynced(entry) {
    return storage.db.eway_bills.put(entry);
  }

  bulkPutSalesReturns(entries) {
    return storage.db.sales_returns.bulkPut(entries);
  }

  bulkPutCorrections(entries) {
    return storage.db.corrections.bulkPut(entries);
  }

  bulkPutGstEntries(entries) {
    return storage.db.gst_ledger.bulkPut(entries);
  }

  bulkPutEwayBills(entries) {
    return storage.db.eway_bills.bulkPut(entries);
  }

  async mergeRemoteSalesReturnRecords(records, idKey = 'returnId') {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return;
    const localRows = await storage.db.sales_returns.toArray();
    const localMap = new Map(localRows.map((item) => [String(item[idKey]), item]));
    const updates = [];
    const nowIso = new Date().toISOString();
    list.forEach((record) => {
      const id = record[idKey];
      if (!id) return;
      const local = localMap.get(String(id));
      if (local && local.isSynced === false) return;
      updates.push({
        ...local,
        ...record,
        isSynced: true,
        syncAction: null,
        updatedAt: record.updatedAt || record.updated_at || nowIso(),
      });
    });
    if (updates.length) {
      await storage.db.sales_returns.bulkPut(updates);
    }
  }

  async mergeRemoteCorrectionRecords(records, idKey = 'correctionId') {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return;
    const localRows = await storage.db.corrections.toArray();
    const localMap = new Map(localRows.map((item) => [String(item[idKey]), item]));
    const updates = [];
    const nowIso = new Date().toISOString();
    list.forEach((record) => {
      const id = record[idKey];
      if (!id) return;
      const local = localMap.get(String(id));
      if (local && local.isSynced === false) return;
      updates.push({
        ...local,
        ...record,
        isSynced: true,
        syncAction: null,
        updatedAt: record.updatedAt || record.updated_at || nowIso(),
      });
    });
    if (updates.length) {
      await storage.db.corrections.bulkPut(updates);
    }
  }

  async mergeRemoteGstRecords(records, idKey = 'gstEntryId') {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return;
    const localRows = await storage.db.gst_ledger.toArray();
    const localMap = new Map(localRows.map((item) => [String(item[idKey]), item]));
    const updates = [];
    const nowIso = new Date().toISOString();
    list.forEach((record) => {
      const id = record[idKey];
      if (!id) return;
      const local = localMap.get(String(id));
      if (local && local.isSynced === false) return;
      updates.push({
        ...local,
        ...record,
        isSynced: true,
        syncAction: null,
        updatedAt: record.updatedAt || record.updated_at || nowIso(),
      });
    });
    if (updates.length) {
      await storage.db.gst_ledger.bulkPut(updates);
    }
  }

  async mergeRemoteEwayRecords(records, idKey = 'ewayId') {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return;
    const localRows = await storage.db.eway_bills.toArray();
    const localMap = new Map(localRows.map((item) => [String(item[idKey]), item]));
    const updates = [];
    const nowIso = new Date().toISOString();
    list.forEach((record) => {
      const id = record[idKey];
      if (!id) return;
      const local = localMap.get(String(id));
      if (local && local.isSynced === false) return;
      updates.push({
        ...local,
        ...record,
        isSynced: true,
        syncAction: null,
        updatedAt: record.updatedAt || record.updated_at || nowIso(),
      });
    });
    if (updates.length) {
      await storage.db.eway_bills.bulkPut(updates);
    }
  }

  markSalesReturnSyncedEntry(entry) {
    return this.markSalesReturnSynced({
      ...entry,
      isSynced: true,
      syncAction: null,
      updatedAt: new Date().toISOString(),
    });
  }

  markCorrectionSyncedEntry(entry) {
    return this.markCorrectionSynced({
      ...entry,
      isSynced: true,
      syncAction: null,
      updatedAt: new Date().toISOString(),
    });
  }

  markGstEntrySyncedEntry(entry) {
    return this.markGstEntrySynced({
      ...entry,
      isSynced: true,
      syncAction: null,
      updatedAt: new Date().toISOString(),
    });
  }

  markEwayBillSyncedEntry(entry) {
    return this.markEwayBillSynced({
      ...entry,
      isSynced: true,
      syncAction: null,
      updatedAt: new Date().toISOString(),
    });
  }
}
