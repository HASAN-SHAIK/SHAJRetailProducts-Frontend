import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  tenantConfig: null,
  tenantId: null,
  role: null,
  userId: null,
  subscriptionStatus: null,
  configStatus: 'idle', // idle | loading | loaded | error
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setTenantIdentity: (state, action) => {
      const { tenantId, role, userId } = action.payload || {};
      state.tenantId = tenantId ?? state.tenantId;
      state.role = role ?? state.role;
      state.userId = userId ?? state.userId;
    },
    setTenantConfig: (state, action) => {
      state.tenantConfig = action.payload || null;
      state.configStatus = 'loaded';
    },
    setTenantConfigStatus: (state, action) => {
      state.configStatus = action.payload || 'idle';
    },
    setSubscriptionStatus: (state, action) => {
      state.subscriptionStatus = action.payload ?? null;
    },
    clearTenantState: (state) => {
      state.tenantConfig = null;
      state.tenantId = null;
      state.role = null;
      state.userId = null;
      state.subscriptionStatus = null;
      state.configStatus = 'idle';
    },
  },
});

export const {
  setTenantIdentity,
  setTenantConfig,
  setTenantConfigStatus,
  setSubscriptionStatus,
  clearTenantState,
} = tenantSlice.actions;

export default tenantSlice.reducer;
