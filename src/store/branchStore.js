import { create } from 'zustand';

const STORAGE_KEY = 'selected_branch_id';
const CONFIRM_KEY = 'selected_branch_confirmed';
const NAME_KEY = 'selected_branch_name';

const getStoredBranchId = () => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const getStoredBranchName = () => {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};

const getStoredBranchConfirmed = () => {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem(CONFIRM_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
    // Fallback: if a branch is already stored, treat it as confirmed.
    return Boolean(getStoredBranchId());
  } catch {
    return false;
  }
};

export const useBranchStore = create((set) => ({
  branches: [],
  selectedBranchId: getStoredBranchId(),
  selectedBranchName: getStoredBranchName(),
  branchConfirmed: getStoredBranchConfirmed(),
  setBranches: (branches) => set({ branches: Array.isArray(branches) ? branches : [] }),
  setSelectedBranchId: (branchId, options = {}) => {
    const normalized = branchId ? String(branchId) : null;
    if (typeof window !== 'undefined') {
      try {
        if (normalized) {
          localStorage.setItem(STORAGE_KEY, normalized);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore storage errors
      }
    }
    set((state) => {
      const confirmed = normalized ? (options.confirmed ?? true) : false;
      const nextName = normalized ? (options.name ?? state.selectedBranchName ?? '') : '';
      if (typeof window !== 'undefined') {
        try {
          if (confirmed) {
            localStorage.setItem(CONFIRM_KEY, '1');
          } else {
            localStorage.removeItem(CONFIRM_KEY);
          }
          if (nextName) {
            localStorage.setItem(NAME_KEY, nextName);
          } else {
            localStorage.removeItem(NAME_KEY);
          }
        } catch {
          // ignore storage errors
        }
      }
      return {
        selectedBranchId: normalized,
        selectedBranchName: nextName,
        branchConfirmed: confirmed
      };
    });
  },
}));
