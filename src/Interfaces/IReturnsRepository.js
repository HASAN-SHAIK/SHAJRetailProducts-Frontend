/**
 * @typedef {object} IReturnsRepository
 * @property {(entry: object) => Promise<void>} upsertLocalSalesReturn
 * @property {(filters?: object) => Promise<object[]>} getLocalSalesReturns
 * @property {(returnId: string|number) => Promise<object|undefined>} getLocalSalesReturnById
 * @property {(returnId: string|number) => Promise<void>} deleteLocalSalesReturn
 * @property {(entry: object) => Promise<void>} upsertLocalCorrection
 * @property {(filters?: object) => Promise<object[]>} getLocalCorrections
 * @property {(correctionId: string|number) => Promise<object|undefined>} getLocalCorrectionById
 * @property {(correctionId: string|number) => Promise<void>} deleteLocalCorrection
 * @property {(entry: object) => Promise<void>} upsertLocalGstEntry
 * @property {(filters?: object) => Promise<object[]>} getLocalGstEntries
 * @property {(entry: object) => Promise<void>} upsertLocalEwayBill
 * @property {(filters?: object) => Promise<object[]>} getLocalEwayBills
 * @property {(ewayId: string|number) => Promise<void>} deleteLocalEwayBill
 * @property {() => Promise<object[]>} getUnsyncedSalesReturns
 * @property {() => Promise<object[]>} getUnsyncedCorrections
 * @property {() => Promise<object[]>} getUnsyncedGstEntries
 * @property {() => Promise<object[]>} getUnsyncedEwayBills
 * @property {(entry: object) => Promise<void>} markSalesReturnSynced
 * @property {(entry: object) => Promise<void>} markCorrectionSynced
 * @property {(entry: object) => Promise<void>} markGstEntrySynced
 * @property {(gstEntryId: string|number) => Promise<void>} deleteGstEntryById
 * @property {(entry: object) => Promise<void>} markEwayBillSynced
 * @property {(entries: object[]) => Promise<void>} bulkPutSalesReturns
 * @property {(entries: object[]) => Promise<void>} bulkPutCorrections
 * @property {(entries: object[]) => Promise<void>} bulkPutGstEntries
 * @property {(entries: object[]) => Promise<void>} bulkPutEwayBills
 * @property {(records: object[], idKey?: string) => Promise<void>} mergeRemoteSalesReturnRecords
 * @property {(records: object[], idKey?: string) => Promise<void>} mergeRemoteCorrectionRecords
 * @property {(records: object[], idKey?: string) => Promise<void>} mergeRemoteGstRecords
 * @property {(records: object[], idKey?: string) => Promise<void>} mergeRemoteEwayRecords
 * @property {(entry: object) => Promise<void>} markSalesReturnSyncedEntry
 * @property {(entry: object) => Promise<void>} markCorrectionSyncedEntry
 * @property {(entry: object) => Promise<void>} markGstEntrySyncedEntry
 * @property {(entry: object) => Promise<void>} markEwayBillSyncedEntry
 */

export {};
