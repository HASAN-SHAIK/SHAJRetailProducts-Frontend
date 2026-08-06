export const extractOrdersPayload = (response) => {
  const payload = response?.data ?? {};
  const list =
    (Array.isArray(payload?.orders) && payload.orders) ||
    (Array.isArray(payload?.data?.orders) && payload.data.orders) ||
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.results) && payload.results) ||
    [];
  return {
    list,
    pagination: payload.pagination || payload?.data?.pagination || {},
  };
};

export const extractOrderDetail = (response) => {
  const data = response?.data ?? {};
  return data?.order || data?.data?.order || data?.data || data || null;
};

export const extractOrderCreateResponse = (response) => {
  const data = response?.data ?? {};
  const order =
    data?.order ||
    data?.data?.order ||
    data?.data ||
    (data?.id ? data : null);
  const orderId = order?.id ?? order?.order_id ?? data?.order_id ?? data?.id ?? null;
  return { order, orderId, data, response };
};

export const extractOfflineSyncResponse = (response) => {
  const data = response?.data ?? {};
  const results =
    (Array.isArray(data?.results) && data.results) ||
    (Array.isArray(data?.data?.results) && data.data.results) ||
    [];
  return { results, data, response };
};
