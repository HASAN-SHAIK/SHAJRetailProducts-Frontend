import { getConfigValue, saveConfigValue } from '../core/db';

const SYNC_STATE_KEY = 'sync_strategy_state_v1';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeId = (value, fallback = 'unknown') => {
  const text = String(value || '').trim();
  return text || fallback;
};

const getContextKey = ({ tenantId, userId, branchId } = {}) => {
  const tenant = normalizeId(tenantId, 'tenant');
  const user = normalizeId(userId, 'user');
  const branch = normalizeId(branchId, 'all');
  return `${tenant}:${user}:${branch}`;
};

const readState = async () => {
  const raw = await getConfigValue(SYNC_STATE_KEY);
  if (!raw || typeof raw !== 'object') return {};
  return raw;
};

const writeState = async (state) => {
  await saveConfigValue(SYNC_STATE_KEY, state || {});
};

export const getSyncPlan = async (context = {}, options = {}) => {
  const forceFull = options?.forceFull === true;
  const now = Date.now();
  const state = await readState();
  const key = getContextKey(context);
  const entry = state?.[key] || {};
  const hasBootstrap = Boolean(entry.bootstrapDoneAt);
  const lastFullAt = entry.lastFullSyncAt ? new Date(entry.lastFullSyncAt).getTime() : null;
  const dailyFullDue = !lastFullAt || Number.isNaN(lastFullAt) || now - lastFullAt >= DAY_IN_MS;

  if (forceFull) {
    return { mode: 'full', reason: 'manual', key };
  }
  if (!hasBootstrap) {
    return { mode: 'full', reason: 'bootstrap', key };
  }
  if (dailyFullDue) {
    return { mode: 'full', reason: 'daily', key };
  }
  return { mode: 'delta', reason: 'steady', key };
};

export const markSyncPlanComplete = async (context = {}, plan = {}) => {
  const state = await readState();
  const key = plan?.key || getContextKey(context);
  const nowIso = new Date().toISOString();
  const prev = state?.[key] || {};
  const next = {
    ...prev,
    bootstrapDoneAt: prev.bootstrapDoneAt || nowIso,
    lastMode: plan?.mode || prev.lastMode || 'delta',
    lastReason: plan?.reason || prev.lastReason || 'steady',
    lastSyncAt: nowIso,
  };
  if ((plan?.mode || '').toLowerCase() === 'full') {
    next.lastFullSyncAt = nowIso;
  }
  state[key] = next;
  await writeState(state);
  return next;
};

export const resetSyncStrategyState = async () => {
  await writeState({});
};
