let cachedDeviceId = null;

const createDeviceId = () => {
  const canUseCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
  return canUseCrypto ? crypto.randomUUID() : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const deviceId = localStorage.getItem('device_id');
    if (deviceId) cachedDeviceId = deviceId;
    return deviceId || null;
  } catch { return null; }
}

export function setDeviceId(deviceId) {
  const normalized = String(deviceId || '').trim();
  if (!normalized) return null;
  try { localStorage.setItem('device_id', normalized); } catch {}
  cachedDeviceId = normalized;
  return normalized;
}

// IDs are created only as part of registration. Opening the browser alone must
// never make a new machine appear registered.
export function ensureRegistrationDeviceId(preferredDeviceId = '') {
  const existing = getDeviceId();
  if (existing) return existing;
  return setDeviceId(String(preferredDeviceId || '').trim() || createDeviceId());
}

export function clearDeviceId() {
  cachedDeviceId = null;
  try { localStorage.removeItem('device_id'); } catch {}
}
