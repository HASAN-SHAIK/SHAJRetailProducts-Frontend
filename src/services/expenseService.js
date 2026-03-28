import api from '../utils/axios';

export const addExpense = async (payload) => {
  const response = await api.post('/expenses', payload);
  return response?.data ?? response;
};

export const getExpenses = async (params) => {
  const response = await api.get('/expenses', { params });
  return response?.data ?? response;
};

export const getExpenseSummary = async () => {
  const response = await api.get('/expenses/summary');
  return response?.data ?? response;
};
