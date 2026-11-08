import api from '../utils/axios';

export const sendCustomerReminder = async (customerId, payload = {}) => {
  const res = await api.post(`/customers/${encodeURIComponent(customerId)}/send-reminder`, payload);
  return res?.data?.data || res?.data || null;
};

export const fetchCustomerReminders = async (customerId) => {
  const res = await api.get(`/customers/${encodeURIComponent(customerId)}/reminders`);
  return res?.data?.data?.reminders || res?.data?.reminders || [];
};
