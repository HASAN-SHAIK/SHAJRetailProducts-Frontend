/**
 * Shared REST response helpers for desktop and mobile API clients.
 */

export const unwrapBody = (response, options = {}) => {
  const body = response?.data ?? {};
  if (!body || typeof body !== 'object') return body;
  if (body.success === false) return options.onError ?? null;

  const { key } = options;
  if (key) {
    if (body.data?.[key] !== undefined) return body.data[key];
    if (body[key] !== undefined) return body[key];
  }
  if (body.data !== undefined) return body.data;
  return body;
};

export const unwrapList = (response, keys = []) => {
  const body = unwrapBody(response);
  if (Array.isArray(body)) return body;
  const candidates = keys.length
    ? keys
    : ['items', 'products', 'orders', 'customers', 'suppliers', 'expenses', 'returns', 'corrections', 'entries', 'reports', 'ewayBills', 'staff', 'salaries', 'batches', 'categories'];
  for (const key of candidates) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
};

export const unwrapRecord = (response, keys = []) => {
  const body = unwrapBody(response);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const candidates = keys.length ? keys : ['record', 'order', 'product', 'customer', 'supplier', 'settings', 'report', 'shop_details'];
  for (const key of candidates) {
    if (body[key] !== undefined) return body[key];
  }
  return body;
};

export const unwrapMeta = (response) => {
  const body = response?.data ?? {};
  if (body.meta) return body.meta;
  if (body.pagination) {
    const pagination = body.pagination;
    return {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total_records ?? pagination.total,
      total_pages: pagination.total_pages,
    };
  }
  return null;
};

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

export const requestRemote = async (remoteFn, fallbackFn) => {
  if (!isOnline()) {
    return typeof fallbackFn === 'function' ? fallbackFn() : null;
  }
  try {
    return await remoteFn();
  } catch {
    return typeof fallbackFn === 'function' ? fallbackFn() : null;
  }
};
