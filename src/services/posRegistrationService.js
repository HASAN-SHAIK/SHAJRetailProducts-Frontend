const STORAGE_KEY = 'shaj_pos_registration_request_v2';
const STATUS_CHECK_THROTTLE_MS = 60 * 1000;

const centralBase = () => {
  const configured = String(process.env.REACT_APP_CENTRAL_API_URL || 'http://localhost:5001/api').replace(/\/$/, '');
  return configured.endsWith('/api') ? `${configured.slice(0, -4)}/api/v1` : `${configured}/v1`;
};

const jsonFetch = async (path, { method = 'GET', tenantId, registrationToken, body } = {}) => {
  const response = await fetch(`${centralBase()}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(tenantId ? { 'X-POS-Tenant-ID': String(tenantId) } : {}),
      ...(registrationToken ? { 'X-POS-Registration-Token': String(registrationToken) } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.code || `pos_registration_http_${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};

export const loadPendingPosRegistration = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const savePending = (value) => {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
};

const recentlyChecked = (pending) => {
  const checkedAt = Number(pending?.status_checked_at || 0);
  return checkedAt > 0 && Date.now() - checkedAt < STATUS_CHECK_THROTTLE_MS;
};

export const requestPosRegistration = async ({ tenantId, device, storeNumber, posNo, touchpointId }) => {
  const businessIdentity = {
    store_number: String(storeNumber || '').trim().toUpperCase(),
    pos_no: String(posNo || '').trim().toUpperCase(),
    touchpoint_id: String(touchpointId || '').trim().toUpperCase(),
  };
  if (!businessIdentity.store_number || !businessIdentity.pos_no || !businessIdentity.touchpoint_id) {
    throw new Error('store_number_pos_no_touchpoint_id_required');
  }
  const payload = await jsonFetch('/pos-registration/requests', {
    method: 'POST',
    tenantId,
    body: {
      device_id: String(device?.device_id || '').trim(),
      installation_id: String(device?.installation_id || '').trim() || undefined,
      device_name: String(device?.device_name || window?.navigator?.platform || 'SHAJ POS').trim(),
      os_info: String(window?.navigator?.userAgent || '').slice(0, 500),
      ...businessIdentity,
    },
  });
  const pending = {
    tenant_id: String(tenantId),
    request_id: payload.request_id,
    request_token: payload.request_token,
    device_id: String(device?.device_id || ''),
    ...businessIdentity,
    status: payload.status || 'PENDING',
    status_checked_at: Date.now(),
  };
  savePending(pending);
  return pending;
};

export const getPosRegistrationStatus = async (pending = loadPendingPosRegistration(), { force = false } = {}) => {
  if (!pending?.request_id || !pending?.request_token || !pending?.tenant_id) return null;
  if (!force && recentlyChecked(pending)) return pending;
  const payload = await jsonFetch(`/pos-registration/requests/${encodeURIComponent(pending.request_id)}`, {
    tenantId: pending.tenant_id,
    registrationToken: pending.request_token,
  });
  const next = { ...pending, ...payload, tenant_id: pending.tenant_id, request_token: pending.request_token, status_checked_at: Date.now() };
  savePending(next);
  return next;
};

export const claimPosRegistration = async (pending = loadPendingPosRegistration()) => {
  if (!pending?.request_id || !pending?.request_token || !pending?.tenant_id) throw new Error('pos_registration_request_missing');
  const payload = await jsonFetch(`/pos-registration/requests/${encodeURIComponent(pending.request_id)}/claim`, {
    method: 'POST',
    tenantId: pending.tenant_id,
    registrationToken: pending.request_token,
  });
  savePending(null);
  return payload;
};

export const clearPosRegistration = () => savePending(null);
