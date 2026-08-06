import api from '../../utils/axios';
import { unwrapBody, unwrapList, unwrapMeta } from '../../utils/apiClient';

export const fetchMobileDashboardRemote = async ({ threshold } = {}) => {
  const response = await api.get('/mobile/dashboard', {
    params: { threshold: threshold || undefined },
  });
  return unwrapBody(response);
};

export const fetchMobileSalesSummaryRemote = async () => {
  const response = await api.get('/mobile/sales-summary');
  return unwrapBody(response);
};

export const fetchMobileLowStockRemote = async ({ threshold, page, limit } = {}) => {
  const response = await api.get('/mobile/low-stock', {
    params: {
      threshold: threshold || undefined,
      page: page || undefined,
      limit: limit || undefined,
    },
  });
  return {
    products: unwrapList(response, ['products']),
    meta: unwrapMeta(response),
  };
};

export { isOnline } from '../../utils/apiClient';
