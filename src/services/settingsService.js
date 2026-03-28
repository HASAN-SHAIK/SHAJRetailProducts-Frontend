import api from '../utils/axios';

export const getSettings = async () => {
  const response = await api.get('/settings');
  return response?.data ?? response;
};
