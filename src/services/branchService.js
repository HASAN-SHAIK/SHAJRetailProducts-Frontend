import api from '../utils/axios';

export const getBranches = async () => {
  const response = await api.get('/branches');
  return response?.data ?? response;
};
