import { create } from 'zustand';

const STORAGE_KEY = 'selected_branch_id';

const getStoredBranchId = () => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const useBranchStore = create((set) => ({
  branches: [],
  selectedBranchId: getStoredBranchId(),
  setBranches: (branches) => set({ branches: Array.isArray(branches) ? branches : [] }),
  setSelectedBranchId: (branchId) => {
    if (typeof window !== 'undefined') {
      try {
        if (branchId) {
          localStorage.setItem(STORAGE_KEY, branchId);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }
    }
    set({ selectedBranchId: branchId || null });
  },
}));
