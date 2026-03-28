import api from '../utils/axios';

export const sendBillViaWhatsApp = async (payload) => {
  const response = await api.post('/whatsapp/send-bill', payload);
  return response?.data ?? response;
};
