import api from './axios';
import { exportLocalDbSnapshot, restoreLocalDbSnapshot } from '../core/db';

const textToHash = async (text) => {
  if (!window?.crypto?.subtle) return null;
  const buffer = new TextEncoder().encode(text);
  const hash = await window.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const buildFullBackup = async () => {
  const [local, serverResponse] = await Promise.all([
    exportLocalDbSnapshot(),
    api.get('/data-quality/backup/export'),
  ]);
  const serverBackup = serverResponse?.data?.data?.backup || null;
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    local,
    server: serverBackup,
  };
  const checksum = await textToHash(JSON.stringify(payload));
  return { ...payload, checksum };
};

export const verifyBackup = async (payload = {}) => {
  const localStores = payload?.local?.stores || {};
  const localCounts = Object.fromEntries(
    Object.entries(localStores).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0])
  );
  const computedChecksum = await textToHash(
    JSON.stringify({
      version: payload?.version || 1,
      exportedAt: payload?.exportedAt || null,
      local: payload?.local || null,
      server: payload?.server || null
    })
  );
  let serverVerification = null;
  if (payload?.server) {
    const res = await api.post('/data-quality/backup/verify', { backup: payload.server });
    serverVerification = res?.data?.data?.verification || null;
  }
  return {
    local: {
      counts: localCounts,
      checksumMatches: payload?.checksum ? payload.checksum === computedChecksum : null
    },
    server: serverVerification
  };
};

export const restoreLocalFromBackup = async (payload = {}) => {
  const local = payload?.local;
  if (!local?.stores) {
    throw new Error('Local backup stores are missing.');
  }
  await restoreLocalDbSnapshot(local);
  return true;
};
