import api from './axios';
import {
  db,
  upsertLocalSalesReturn,
  upsertLocalCorrection,
  upsertLocalGstEntry,
  upsertLocalEwayBill,
  deleteLocalSalesReturn,
  deleteLocalCorrection,
  deleteLocalEwayBill,
} from '../core/db';

const nowIso = () => new Date().toISOString();

const normalizeAction = (value) => {
  const action = String(value || '').toUpperCase();
  if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') return action;
  return 'UPDATE';
};

const markSynced = async (table, entry) => {
  await table.put({
    ...entry,
    isSynced: true,
    syncAction: null,
    updatedAt: nowIso(),
  });
};

const syncReturn = async (entry) => {
  const action = normalizeAction(entry.syncAction);
  if (action === 'DELETE') {
    await api.delete(`/returns/${encodeURIComponent(entry.returnId)}`);
    await deleteLocalSalesReturn(entry.returnId);
    return;
  }
  if (action === 'CREATE') {
    await api.post('/returns', entry);
  } else {
    await api.put(`/returns/${encodeURIComponent(entry.returnId)}`, entry);
  }
  await markSynced(db.sales_returns, entry);
};

const syncCorrection = async (entry) => {
  const action = normalizeAction(entry.syncAction);
  if (action === 'DELETE') {
    await api.delete(`/corrections/${encodeURIComponent(entry.correctionId)}`);
    await deleteLocalCorrection(entry.correctionId);
    return;
  }
  if (action === 'CREATE') {
    await api.post('/corrections', entry);
  } else {
    await api.put(`/corrections/${encodeURIComponent(entry.correctionId)}`, entry);
  }
  await markSynced(db.corrections, entry);
};

const syncGstEntry = async (entry) => {
  const action = normalizeAction(entry.syncAction);
  if (action === 'DELETE') {
    await api.delete(`/gst/ledger/${encodeURIComponent(entry.gstEntryId)}`);
    await db.gst_ledger.delete(entry.gstEntryId);
    return;
  }
  if (action === 'CREATE') {
    await api.post('/gst/ledger', entry);
  } else {
    await api.put(`/gst/ledger/${encodeURIComponent(entry.gstEntryId)}`, entry);
  }
  await markSynced(db.gst_ledger, entry);
};

const syncEway = async (entry) => {
  const action = normalizeAction(entry.syncAction);
  if (action === 'DELETE') {
    await api.delete(`/eway-bills/${encodeURIComponent(entry.ewayId)}`);
    await deleteLocalEwayBill(entry.ewayId);
    return;
  }
  if (action === 'CREATE') {
    await api.post('/eway-bills', entry);
  } else {
    await api.put(`/eway-bills/${encodeURIComponent(entry.ewayId)}`, entry);
  }
  await markSynced(db.eway_bills, entry);
};

const emitSyncEvent = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('returns-corrections-sync-updated'));
  } catch {
    // ignore
  }
};

export const processReturnsCorrectionsSync = async () => {
  if (!navigator.onLine) return [];
  const synced = [];
  const returnsPending = await db.sales_returns.where('isSynced').equals(false).toArray();
  const correctionsPending = await db.corrections.where('isSynced').equals(false).toArray();
  const gstPending = await db.gst_ledger.where('isSynced').equals(false).toArray();
  const ewayPending = await db.eway_bills.where('isSynced').equals(false).toArray();

  for (const entry of returnsPending) {
    await syncReturn(entry);
    synced.push({ type: 'return', id: entry.returnId });
  }
  for (const entry of correctionsPending) {
    await syncCorrection(entry);
    synced.push({ type: 'correction', id: entry.correctionId });
  }
  for (const entry of gstPending) {
    await syncGstEntry(entry);
    synced.push({ type: 'gst', id: entry.gstEntryId });
  }
  for (const entry of ewayPending) {
    await syncEway(entry);
    synced.push({ type: 'eway', id: entry.ewayId });
  }

  if (synced.length) emitSyncEvent();
  return synced;
};

const mergeRemote = async (table, records, idKey) => {
  const list = Array.isArray(records) ? records : [];
  if (!list.length) return;
  const localMap = new Map((await table.toArray()).map((item) => [String(item[idKey]), item]));
  const updates = [];
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
    await table.bulkPut(updates);
  }
};

export const syncAllReturnsCorrections = async () => {
  await processReturnsCorrectionsSync();
  if (!navigator.onLine) return;
  const [returnsRes, correctionsRes, gstRes, ewayRes] = await Promise.all([
    api.get('/returns'),
    api.get('/corrections'),
    api.get('/gst/ledger'),
    api.get('/eway-bills'),
  ]);
  await mergeRemote(db.sales_returns, returnsRes?.data?.returns || returnsRes?.data?.data || returnsRes?.data || [], 'returnId');
  await mergeRemote(db.corrections, correctionsRes?.data?.corrections || correctionsRes?.data?.data || correctionsRes?.data || [], 'correctionId');
  await mergeRemote(db.gst_ledger, gstRes?.data?.entries || gstRes?.data?.data || gstRes?.data || [], 'gstEntryId');
  await mergeRemote(db.eway_bills, ewayRes?.data?.ewayBills || ewayRes?.data?.data || ewayRes?.data || [], 'ewayId');
  emitSyncEvent();
};
