export const normalizeBranchLabel = (value) =>
  String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const getBranchId = (branch) =>
  branch?.id ?? branch?.branch_id ?? branch?.branchId ?? branch?.store_id ?? branch?.storeId ?? null;

export const getBranchDisplayName = (branch, fallback = '') => {
  const value =
    branch?.name ??
    branch?.branch_name ??
    branch?.branchName ??
    branch?.display_name ??
    branch?.displayName ??
    branch?.store_name ??
    branch?.storeName ??
    branch?.title ??
    branch?.branch?.name ??
    branch?.branch ??
    fallback;
  return normalizeBranchLabel(value);
};

export const findBranchById = (branches = [], branchId) => {
  const target = String(branchId ?? '');
  if (!target) return null;
  return (Array.isArray(branches) ? branches : []).find((branch) => String(getBranchId(branch) ?? '') === target) || null;
};
