import api from '../utils/axios';

export const DENOMINATION_MULTIPLIERS = {
  '500': 500,
  '200': 200,
  '100': 100,
  '50': 50,
  '20': 20,
  '10': 10,
  '5': 5,
};

export const calculateDenominationsTotal = (denominations = {}) => {
  if (!denominations || typeof denominations !== 'object') return 0;
  let total = 0;
  for (const [key, val] of Object.entries(denominations)) {
    const num = Math.max(0, Number(val) || 0);
    if (key === 'coins' || key === 'others') {
      total += num;
    } else if (DENOMINATION_MULTIPLIERS[key]) {
      total += num * DENOMINATION_MULTIPLIERS[key];
    }
  }
  return Math.round(total * 100) / 100;
};

export const fetchCurrentShift = async () => {
  const res = await api.get('/shifts/current');
  return res?.data?.shift || null;
};

export const openShift = async (payload = {}) => {
  const res = await api.post('/shifts/open', payload);
  return res?.data?.shift || null;
};

export const declareAndCloseShift = async (payload = {}) => {
  const res = await api.post('/shifts/declare', payload);
  return res?.data || null;
};

export const fetchShiftHistory = async ({ from, to } = {}) => {
  const res = await api.get('/shifts', {
    params: {
      from: from || undefined,
      to: to || undefined,
    },
  });
  return res?.data?.shifts || [];
};
