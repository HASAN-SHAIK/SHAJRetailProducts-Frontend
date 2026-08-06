import api from './axios';
import * as staffLocal from '../services/local/staffLocalService';

const nowIso = () => new Date().toISOString();

const normalizeAction = (value) => {
  const action = String(value || '').toUpperCase();
  if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') return action;
  return 'UPDATE';
};

const markStaffSynced = async (staff) => {
  await staffLocal.upsertLocalStaff({
    ...staff,
    isSynced: true,
    syncAction: null,
    updatedAt: nowIso(),
  });
};

const markSalarySynced = async (salary) => {
  await staffLocal.upsertLocalSalary({
    ...salary,
    isSynced: true,
    syncAction: null,
    updatedAt: nowIso(),
  });
};

const markExpenseSynced = async (expense) => {
  await staffLocal.upsertLocalExpense({
    ...expense,
    isSynced: true,
    syncAction: null,
    updatedAt: nowIso(),
  });
};

const syncStaffRecord = async (staff) => {
  const action = normalizeAction(staff.syncAction);
  if (action === 'DELETE') {
    await api.delete(`/staff/${encodeURIComponent(staff.staffId)}`);
    await staffLocal.deleteLocalStaff(staff.staffId);
    return;
  }
  const payload = {
    id: staff.staffId,
    name: staff.name,
    phone: staff.phone,
    role: staff.role,
    salary: staff.salary,
    joinDate: staff.joinDate,
    status: staff.status,
  };
  if (action === 'CREATE') {
    await api.post('/staff', payload);
  } else {
    await api.put(`/staff/${encodeURIComponent(staff.staffId)}`, payload);
  }
  await markStaffSynced(staff);
};

const syncSalaryRecord = async (salary) => {
  const action = normalizeAction(salary.syncAction);
  if (action === 'DELETE') {
    await api.delete(`/salary/${encodeURIComponent(salary.salaryId)}`);
    await staffLocal.deleteLocalSalary(salary.salaryId);
    return;
  }
  const payload = {
    id: salary.salaryId,
    staffId: salary.staffId,
    month: salary.month,
    baseSalary: salary.baseSalary,
    bonus: salary.bonus,
    deductions: salary.deductions,
    netSalary: salary.netSalary,
    paidAmount: salary.paidAmount,
    pendingAmount: salary.pendingAmount,
    paymentStatus: salary.paymentStatus,
  };
  if (action === 'CREATE') {
    await api.post('/salary', payload);
  } else {
    await api.put(`/salary/${encodeURIComponent(salary.salaryId)}`, payload);
  }
  await markSalarySynced(salary);
};

const syncExpenseRecord = async (expense) => {
  const action = normalizeAction(expense.syncAction);
  if (action === 'DELETE') {
    await api.delete(`/expenses/${encodeURIComponent(expense.expenseId)}`);
    await staffLocal.deleteLocalExpense(expense.expenseId);
    return;
  }
  const payload = {
    id: expense.expenseId,
    type: expense.type,
    category: expense.category,
    amount: expense.amount,
    date: expense.date,
    staffId: expense.staffId || null,
    paymentMethod: expense.paymentMethod,
    notes: expense.notes,
  };
  if (action === 'CREATE') {
    await api.post('/expenses', payload);
  } else {
    await api.put(`/expenses/${encodeURIComponent(expense.expenseId)}`, payload);
  }
  await markExpenseSynced(expense);
};

const emitSyncEvent = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('staff-expenses-sync-updated'));
  } catch {
    // ignore
  }
};

export const processStaffExpensesSync = async () => {
  if (!navigator.onLine) return { synced: [], failed: [] };
  const synced = [];
  const failed = [];
  const staffPending = (await staffLocal.getStaffRecords()).filter((entry) => entry?.isSynced !== true);
  const salaryPending = (await staffLocal.getSalaryRecords()).filter((entry) => entry?.isSynced !== true);
  const expensePending = (await staffLocal.getExpenseRecords()).filter((entry) => entry?.isSynced !== true);

  for (const staff of staffPending) {
    try {
      await syncStaffRecord(staff);
      synced.push({ type: 'staff', id: staff.staffId });
    } catch (error) {
      failed.push({
        type: 'staff',
        id: staff.staffId,
        message: error?.response?.data?.error || error?.message || 'sync failed',
      });
    }
  }
  for (const salary of salaryPending) {
    try {
      await syncSalaryRecord(salary);
      synced.push({ type: 'salary', id: salary.salaryId });
    } catch (error) {
      failed.push({
        type: 'salary',
        id: salary.salaryId,
        message: error?.response?.data?.error || error?.message || 'sync failed',
      });
    }
  }
  for (const expense of expensePending) {
    try {
      await syncExpenseRecord(expense);
      synced.push({ type: 'expense', id: expense.expenseId });
    } catch (error) {
      failed.push({
        type: 'expense',
        id: expense.expenseId,
        message: error?.response?.data?.error || error?.message || 'sync failed',
      });
    }
  }

  if (synced.length) {
    emitSyncEvent();
  }
  return { synced, failed };
};

export const syncAllStaffExpenses = async (options = {}) => {
  const queueResult = await processStaffExpensesSync();
  if (!navigator.onLine) return queueResult;
  const refreshRemote = options?.refreshRemote !== false;
  if (!refreshRemote) {
    return {
      synced: queueResult?.synced || [],
      failed: queueResult?.failed || [],
      remoteErrors: [],
    };
  }

  const remoteFetches = await Promise.allSettled([
    api.get('/staff'),
    api.get('/salary'),
    api.get('/expenses'),
  ]);

  const remoteErrors = [];
  const [staffRes, salaryRes, expenseRes] = remoteFetches;

  if (staffRes.status === 'fulfilled') {
    await staffLocal.mergeRemoteStaffRecords(
      staffRes.value?.data?.staff || staffRes.value?.data?.data || staffRes.value?.data || [],
      'staffId'
    );
  } else {
    remoteErrors.push(staffRes.reason?.response?.data?.error || staffRes.reason?.message || 'staff refresh failed');
  }

  if (salaryRes.status === 'fulfilled') {
    await staffLocal.mergeRemoteSalaryRecords(
      salaryRes.value?.data?.salaries || salaryRes.value?.data?.data || salaryRes.value?.data || [],
      'salaryId'
    );
  } else {
    remoteErrors.push(salaryRes.reason?.response?.data?.error || salaryRes.reason?.message || 'salary refresh failed');
  }

  if (expenseRes.status === 'fulfilled') {
    await staffLocal.mergeRemoteExpenseRecords(
      expenseRes.value?.data?.expenses || expenseRes.value?.data?.data || expenseRes.value?.data || [],
      'expenseId'
    );
  } else {
    remoteErrors.push(expenseRes.reason?.response?.data?.error || expenseRes.reason?.message || 'expense refresh failed');
  }

  emitSyncEvent();
  return {
    synced: queueResult?.synced || [],
    failed: queueResult?.failed || [],
    remoteErrors,
  };
};
