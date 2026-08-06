import api from '../../utils/axios';
import {
  buildCustomerPayload,
  normalizeApiCustomer,
  normalizeCustomerList,
} from './customerNormalizer';

export const extractCustomersPayload = (response) => {
  const data = response?.data ?? {};
  if (Array.isArray(data.data?.customers)) return data.data.customers;
  if (Array.isArray(data.customers)) return data.customers;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

export const extractCustomerRecord = (response) => {
  const data = response?.data ?? {};
  return (
    data.data?.customer ||
    data.customer ||
    data.data?.data?.customer ||
    (data.data && !Array.isArray(data.data) && data.data.id ? data.data : null) ||
    null
  );
};

export const fetchCustomers = async ({ search = '', limit = 500, page = 1 } = {}) => {
  try {
    const response = await api.get('/v1/customers', {
      params: {
        search: search || undefined,
        limit,
        page,
      },
    });
    return normalizeCustomerList(extractCustomersPayload(response));
  } catch {
    const response = await api.get('/customers', {
      params: search ? { search } : { limit },
    });
    return normalizeCustomerList(extractCustomersPayload(response));
  }
};

export const fetchCustomerDetail = async (customerId) => {
  const id = encodeURIComponent(String(customerId || '').trim());
  try {
    const response = await api.get(`/v1/customers/${id}`);
    const payload = response?.data?.data ?? response?.data ?? {};
    const customer = normalizeApiCustomer(payload.customer ?? payload);
    return {
      customer,
      orders: Array.isArray(payload.orders) ? payload.orders : [],
      payments: Array.isArray(payload.payments) ? payload.payments : [],
    };
  } catch {
    const response = await api.get(`/customers/${id}`);
    const payload = response?.data?.data ?? response?.data ?? {};
    const customer = normalizeApiCustomer(payload.customer ?? payload);
    return {
      customer,
      orders: Array.isArray(payload.orders) ? payload.orders : [],
      payments: Array.isArray(payload.payments) ? payload.payments : [],
    };
  }
};

export const createCustomerRemote = async (payload) => {
  const body = buildCustomerPayload(payload);
  try {
    const response = await api.post('/v1/customers', body);
    return normalizeApiCustomer(extractCustomerRecord(response));
  } catch {
    const response = await api.post('/customers', body);
    return normalizeApiCustomer(extractCustomerRecord(response));
  }
};

export const updateCustomerRemote = async (customerId, payload) => {
  const id = encodeURIComponent(String(customerId || '').trim());
  const body = buildCustomerPayload(payload);
  try {
    const response = await api.put(`/v1/customers/${id}`, body);
    return normalizeApiCustomer(extractCustomerRecord(response));
  } catch {
    const response = await api.put(`/customers/${id}`, body);
    return normalizeApiCustomer(extractCustomerRecord(response));
  }
};

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;
