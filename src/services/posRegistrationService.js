const STORAGE_KEY = 'shaj_pos_registration_request_v1';

const centralBase = () => {
  const configured = String(process.env.REACT_APP_CENTRAL_API_URL || 'http://localhost:5001/api').replace(/\/$/, '');
  return configured.endsWith('/api') ? `${configured.slice(0, -4)}/api/v1` : `${configured}/v1`;
};

const jsonFetch = async (path, { method = 'GET', tenantId, registrationToken, body } = {}) => {
  const response = await fetch(`${centralBase()}${path}`, {
    method,
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

export const requestPosRegistration = async ({ tenantId, device }) => {
  const payload = await jsonFetch('/pos-registration/requests', {
    method: 'POST',
    tenantId,
    body: {
      device_id: String(device?.device_id || '').trim(),
      installation_id: String(device?.installation_id || '').trim() || undefined,
      device_name: String(device?.device_name || window?.navigator?.platform || 'SHAJ POS').trim(),
      os_info: String(window?.navigator?.userAgent || '').slice(0, 500),
    },
  });
  const pending = {
    tenant_id: String(tenantId),
    request_id: payload.request_id,
    request_token: payload.request_token,
    device_id: String(device?.device_id || ''),
    status: payload.status || 'PENDING',
  };
  savePending(pending);
  return pending;
};

export const getPosRegistrationStatus = async (pending = loadPendingPosRegistration()) => {
  if (!pending?.request_id || !pending?.request_token || !pending?.tenant_id) return null;
  const payload = await jsonFetch(`/pos-registration/requests/${encodeURIComponent(pending.request_id)}`, {
    tenantId: pending.tenant_id,
    registrationToken: pending.request_token,
  });
  const next = { ...pending, ...payload, tenant_id: pending.tenant_id, request_token: pending.request_token };
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
