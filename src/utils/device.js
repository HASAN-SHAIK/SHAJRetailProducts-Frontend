let cachedDeviceId = null;

export function getDeviceId() {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  let deviceId;
  try {
    deviceId = localStorage.getItem('device_id');
  } catch (err) {
    deviceId = null;
  }

  if (!deviceId) {
    const canUseCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
    deviceId = canUseCrypto
      ? crypto.randomUUID()
      : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem('device_id', deviceId);
    } catch (err) {
      // Ignore storage failures (private mode / blocked storage)
    }
  }

  cachedDeviceId = deviceId;
  return deviceId;
}
