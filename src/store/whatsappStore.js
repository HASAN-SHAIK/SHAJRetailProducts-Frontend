import { create } from 'zustand';

export const useWhatsappStore = create((set) => ({
  whatsappEnabled: false,
  selectedOrderId: null,
  phone: '',
  setWhatsappEnabled: (value) => set({ whatsappEnabled: Boolean(value) }),
  setSelectedOrderId: (orderId) => set({ selectedOrderId: orderId ?? null }),
  setPhone: (phone) => set({ phone: phone ?? '' }),
  resetWhatsappState: () => set({ selectedOrderId: null, phone: '' }),
}));
