import api from './axios';
import {
  createCorrection,
  deleteCorrection,
  deleteReturn,
  upsertCorrection,
  upsertReturn,
} from '../services/returnsCorrectionsApi';
import * as returnsLocal from '../services/local/returnsLocalService';
import { isLegacyBrowserSyncAllowed, localPosSyncSkippedResult } from './legacyBrowserSyncAuthority';

const normalizeAction = (value) => {
  const action = String(value || '').toUpperCase();
  if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') return action;
  return 'UPDATE';
};

const syncReturn = async (entry) => {
  const action = normalizeAction(entry.syncAction);
  if (action === 'DELETE') {
    await deleteReturn(entry.returnId);
    await returnsLocal.deleteLocalSalesReturn(entry.returnId);
    return;
  }
  if (action === 'CREATE') {
    await upsertReturn(null, entry);
  } else {
    await upsertReturn(entry.returnId, entry);
  }
  await returnsLocal.markSalesReturnSyncedEntry(entry);
};

const syncCorrection = async (entry) => {
  const action = normalizeAction(entry.syncAction);
  if (action === 'DELETE') {
    await deleteCorrection(entry.correctionId);
    await returnsLocal.deleteLocalCorrection(entry.correctionId);
    return;
  }
  if (action === 'CREATE') {
    await upsertCorrection(null, entry);
  } else {
    await upsertCorrection(entry.correctionId, entry);
  }
  await returnsLocal.markCorrectionSyncedEntry(entry);
};

const syncGstEntry = async (entry) => {
  const action = normalizeAction(entry.syncAction);
  if (action === 'DELETE') {
    await api.delete(`/gst/ledger/${encodeURIComponent(entry.gstEntryId)}`);
    await returnsLocal.deleteGstEntryById(entry.gstEntryId);
    return;
  }
  if (action === 'CREATE') {
    await api.post('/gst/ledger', entry);
  } else {
    await api.put(`/gst/ledger/${encodeURIComponent(entry.gstEntryId)}`, entry);
  }
  await returnsLocal.markGstEntrySyncedEntry(entry);
};

export const syncReturnsCorrections = async () => {
  if (!isLegacyBrowserSyncAllowed()) {
    return localPosSyncSkippedResult({ processed: 0, failed: 0 });
  }
  if (!navigator.onLine) return { processed: 0, failed: 0 };

  const [returns, corrections, gstEntries] = await Promise.all([
    returnsLocal.getUnsyncedSalesReturns(),
    returnsLocal.getUnsyncedCorrections(),
    returnsLocal.getUnsyncedGstEntries(),
  ]);

  let processed = 0;
  let failed = 0;

  for (const entry of returns) {
    try {
      await syncReturn(entry);
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  for (const entry of corrections) {
    try {
      await syncCorrection(entry);
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  for (const entry of gstEntries) {
    try {
      await syncGstEntry(entry);
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed, failed };
};

export const pullReturnsCorrectionsFromServer = async () => {
  if (!isLegacyBrowserSyncAllowed()) {
    return localPosSyncSkippedResult();
  }
  if (!navigator.onLine) return;
  const { fetchReturns, fetchCorrections, fetchGstLedger } = await import('../services/returnsCorrectionsApi');
  const { fetchEwayBillsRemote } = await import('../Repositories/api/reportApiClient');
  const [serverReturns, serverCorrections, gstLedger, ewayBills] = await Promise.all([
    fetchReturns(),
    fetchCorrections(),
    fetchGstLedger(),
    fetchEwayBillsRemote(),
  ]);
  if (Array.isArray(serverReturns) && serverReturns.length) {
    await returnsLocal.mergeRemoteSalesReturnRecords(serverReturns).catch(() => {});
  }
  if (Array.isArray(serverCorrections) && serverCorrections.length) {
    await returnsLocal.mergeRemoteCorrectionRecords(serverCorrections).catch(() => {});
  }
  if (Array.isArray(gstLedger) && gstLedger.length) {
    await returnsLocal.mergeRemoteGstRecords(gstLedger).catch(() => {});
  }
  if (Array.isArray(ewayBills) && ewayBills.length) {
    await returnsLocal.mergeRemoteEwayRecords(ewayBills).catch(() => {});
  }
};

export const syncReturnsCorrectionsQueue = syncReturnsCorrections;

export const syncAllReturnsCorrections = async (options = {}) => {
  if (!isLegacyBrowserSyncAllowed()) {
    return localPosSyncSkippedResult({ processed: 0, failed: 0 });
  }
  const queueResult = await syncReturnsCorrections();
  if (!navigator.onLine) return queueResult;
  const refreshRemote = options?.refreshRemote !== false;
  if (refreshRemote) {
    await pullReturnsCorrectionsFromServer().catch(() => {});
  }
  return queueResult;
};