export const extractPurchasesPayload = (response) => {
  const data = response?.data ?? {};
  if (Array.isArray(data.data?.purchases)) return data.data.purchases;
  if (Array.isArray(data.purchases)) return data.purchases;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

export const extractPurchaseDetail = (response) => {
  const data = response?.data?.data ?? response?.data ?? null;
  if (!data) return null;
  return data;
};

export const extractPurchaseCreateResponse = (response) => {
  const data = response?.data?.data ?? response?.data ?? {};
  const orderId =
    data?.order_id ??
    data?.id ??
    data?.order?.id ??
    data?.purchase?.id ??
    null;
  const batches = Array.isArray(data?.batches) ? data.batches : [];
  return {
    orderId,
    batches,
    data,
    response,
  };
};

export const extractPurchaseReturnResponse = (response) => {
  const data = response?.data?.data ?? response?.data ?? {};
  const serverId =
    data?.id ??
    data?.return_id ??
    data?.purchase_return_id ??
    data?.data?.id ??
    null;
  return { serverId, data, response };
};

export const normalizeBranchStockRows = (response) => {
  const payload = response?.data ?? {};
  const list = Array.isArray(payload.stock)
    ? payload.stock
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];
  return list.map((row) => ({
    branch_id: row?.branch_id ?? row?.id ?? null,
    branch: row?.branch ?? row?.name ?? null,
    quantity: Number(row?.quantity ?? 0),
  }));
};

export const normalizePurchaseList = (list = []) => (Array.isArray(list) ? list : []);
