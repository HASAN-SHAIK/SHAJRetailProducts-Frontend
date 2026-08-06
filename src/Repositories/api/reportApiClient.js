import api from '../../utils/axios';
import { unwrapBody, unwrapRecord } from '../../utils/apiClient';

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

const getSelectedBranchId = () => {
  if (typeof window === 'undefined') return null;
  try {
    const branchId = localStorage.getItem('selected_branch_id');
    return branchId && branchId !== 'all' ? branchId : null;
  } catch {
    return null;
  }
};

const withBranchHeaders = () => {
  const branchId = getSelectedBranchId();
  return branchId ? { 'x-branch-id': branchId } : undefined;
};

const normalizeExpenseReport = (report = {}) => ({
  total: Number(report.total || 0),
  categories: (Array.isArray(report.categories) ? report.categories : []).map((row) => ({
    category: row.category || 'Uncategorized',
    amount: Number(row.total ?? row.amount ?? 0),
  })),
});

export const fetchDailyExpenseReportRemote = async ({ date } = {}) => {
  const response = await api.get('/expenses/daily', {
    params: { date: date || undefined, branch_id: getSelectedBranchId() || undefined },
    headers: withBranchHeaders(),
  });
  return normalizeExpenseReport(unwrapRecord(response, ['report']));
};

export const fetchMonthlyExpenseReportRemote = async ({ month } = {}) => {
  const response = await api.get('/expenses/monthly', {
    params: { month: month || undefined, branch_id: getSelectedBranchId() || undefined },
    headers: withBranchHeaders(),
  });
  return normalizeExpenseReport(unwrapRecord(response, ['report']));
};

export const fetchStaffExpensesRemote = async ({ staffId = null, type = 'staff' } = {}) => {
  const response = await api.get('/expenses', {
    params: {
      type: type || undefined,
      staff_id: staffId || undefined,
      branch_id: getSelectedBranchId() || undefined,
    },
    headers: withBranchHeaders(),
  });
  const list = unwrapBody(response, { key: 'expenses' });
  const safeList = Array.isArray(list) ? list : [];
  return safeList.map((item) => ({
    ...item,
    expenseId: item.expenseId ?? item.id,
    staffId: item.staffId ?? item.staff_id ?? null,
    paymentMethod: item.paymentMethod ?? item.payment_method ?? null,
    isDeleted: false,
    isSynced: true,
  }));
};

export const fetchStaffExpenseTotalRemote = async ({ staffId, from, to } = {}) => {
  const response = await api.get('/expenses/staff-total', {
    params: {
      staff_id: staffId || undefined,
      from: from || undefined,
      to: to || undefined,
      branch_id: getSelectedBranchId() || undefined,
    },
    headers: withBranchHeaders(),
  });
  const body = unwrapBody(response);
  return Number(body?.total ?? 0);
};

export const fetchEwayBillsRemote = async () => {
  const response = await api.get('/eway-bills', { headers: withBranchHeaders() });
  const list = unwrapBody(response, { key: 'ewayBills' });
  const safeList = Array.isArray(list) ? list : [];
  return safeList.map((item) => ({
    ...item,
    ewayId: item.ewayId ?? item.id,
    billId: item.billId ?? item.bill_id,
    transportDetails: item.transportDetails ?? item.transport_details ?? '',
    generatedNumber: item.generatedNumber ?? item.generated_number ?? '',
    isSynced: item.isSynced ?? item.is_synced ?? true,
  }));
};

