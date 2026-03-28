import api from '../utils/axios';

export const createOrder = async (payload) => {
  const response = await api.post('/orders', payload);
  return response?.data ?? response;
};
