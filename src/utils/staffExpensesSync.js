import api from './axios';
import {
  db,
  upsertLocalStaff,
  upsertLocalSalary,
  upsertLocalExpense,
  deleteLocalStaff,
  deleteLocalSalary,
  deleteLocalExpense,
} from '../core/db';

const nowIso = () => new Date().toISOString();

const normalizeAction = (value) => {
  const action = String(value || '').toUpperCase();
  if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') return action;
  return 'UPDATE';
};

const markStaffSynced = async (staff) => {
  await upsertLocalStaff({
    ...staff,
    isSynced: true,
    syncAction: null,
    updatedAt: nowIso(),
  });
};

const markSalarySynced = async (salary) => {
  await upsertLocalSalary({
    ...salary,
    isSynced: true,
    syncAction: null,
    updatedAt: nowIso(),
  });
};

const markExpenseSynced = async (expense) => {
  await upsertLocalExpense({
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
    await deleteLocalStaff(staff.staffId);
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
    await deleteLocalSalary(salary.salaryId);
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
    await deleteLocalExpense(expense.expenseId);
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
  if (!navigator.onLine) return [];
  const synced = [];
  const staffPending = await db.staff.where('isSynced').equals(false).toArray();
  const salaryPending = await db.salaries.where('isSynced').equals(false).toArray();
  const expensePending = await db.expenses.where('isSynced').equals(false).toArray();

  for (const staff of staffPending) {
    await syncStaffRecord(staff);
    synced.push({ type: 'staff', id: staff.staffId });
  }
  for (const salary of salaryPending) {
    await syncSalaryRecord(salary);
    synced.push({ type: 'salary', id: salary.salaryId });
  }
  for (const expense of expensePending) {
    await syncExpenseRecord(expense);
    synced.push({ type: 'expense', id: expense.expenseId });
  }

  if (synced.length) {
    emitSyncEvent();
  }
  return synced;
};

const mergeRemoteRecords = async (table, records, idKey) => {
  const list = Array.isArray(records) ? records : [];
  if (!list.length) return;
  const localMap = new Map((await table.toArray()).map((item) => [String(item[idKey]), item]));
  const updates = [];
  list.forEach((record) => {
    const id = record[idKey];
    if (!id) return;
    const local = localMap.get(String(id));
    if (local && local.isSynced === false) return;
    updates.push({
      ...local,
      ...record,
      isSynced: true,
      syncAction: null,
      updatedAt: record.updatedAt || record.updated_at || nowIso(),
    });
  });
  if (updates.length) {
    await table.bulkPut(updates);
  }
};

export const syncAllStaffExpenses = async () => {
  await processStaffExpensesSync();
  if (!navigator.onLine) return;
  const [staffRes, salaryRes, expenseRes] = await Promise.all([
    api.get('/staff'),
    api.get('/salary'),
    api.get('/expenses'),
  ]);
  await mergeRemoteRecords(db.staff, staffRes?.data?.staff || staffRes?.data?.data || staffRes?.data || [], 'staffId');
  await mergeRemoteRecords(db.salaries, salaryRes?.data?.salaries || salaryRes?.data?.data || salaryRes?.data || [], 'salaryId');
  await mergeRemoteRecords(db.expenses, expenseRes?.data?.expenses || expenseRes?.data?.data || expenseRes?.data || [], 'expenseId');
  emitSyncEvent();
};
