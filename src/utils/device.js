let cachedDeviceId = null;

const createDeviceId = () => {
  const canUseCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
  return canUseCrypto
    ? crypto.randomUUID()
    : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const deviceId = localStorage.getItem('device_id');
    if (deviceId) cachedDeviceId = deviceId;
    return deviceId || null;
  } catch {
    return null;
  }
}

// Device IDs are now created only as part of the POS registration flow. Merely
// opening the browser must not make an unregistered machine look registered.
export function ensureRegistrationDeviceId() {
  const existing = getDeviceId();
  if (existing) return existing;
  const deviceId = createDeviceId();
  try { localStorage.setItem('device_id', deviceId); } catch {}
  cachedDeviceId = deviceId;
  return deviceId;
}

export function clearDeviceId() {
  cachedDeviceId = null;
  try { localStorage.removeItem('device_id'); } catch {}
}
