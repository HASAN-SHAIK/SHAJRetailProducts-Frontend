import * as storage from './internal/storage';

/** @implements {import('../Interfaces/IStaffRepository').IStaffRepository} */
export class IndexedDbStaffRepository {
  upsertLocalStaff(staff) {
    return storage.upsertLocalStaff(staff);
  }

  getLocalStaff(filters = {}) {
    return storage.getLocalStaff(filters);
  }

  getLocalStaffById(staffId) {
    return storage.getLocalStaffById(staffId);
  }

  deleteLocalStaff(staffId) {
    return storage.deleteLocalStaff(staffId);
  }

  upsertLocalSalary(salary) {
    return storage.upsertLocalSalary(salary);
  }

  getLocalSalaries(filters = {}) {
    return storage.getLocalSalaries(filters);
  }

  getLocalSalaryById(salaryId) {
    return storage.getLocalSalaryById(salaryId);
  }

  deleteLocalSalary(salaryId) {
    return storage.deleteLocalSalary(salaryId);
  }

  upsertLocalExpense(expense) {
    return storage.upsertLocalExpense(expense);
  }

  getLocalExpenses(filters = {}) {
    return storage.getLocalExpenses(filters);
  }

  getLocalExpenseById(expenseId) {
    return storage.getLocalExpenseById(expenseId);
  }

  deleteLocalExpense(expenseId) {
    return storage.deleteLocalExpense(expenseId);
  }

  getStaffRecords() {
    return storage.db.staff.toArray();
  }

  getSalaryRecords() {
    return storage.db.salaries.toArray();
  }

  getExpenseRecords() {
    return storage.db.expenses.toArray();
  }

  putStaffRecord(entry) {
    return storage.db.staff.put(entry);
  }

  putSalaryRecord(entry) {
    return storage.db.salaries.put(entry);
  }

  putExpenseRecord(entry) {
    return storage.db.expenses.put(entry);
  }

  runStaffSalariesExpensesTransaction(callback) {
    return storage.db.transaction('rw', storage.db.staff, storage.db.salaries, storage.db.expenses, callback);
  }

  async mergeRemoteStaffRecords(records, idKey = 'staffId') {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return;
    const localMap = new Map((await this.getStaffRecords()).map((item) => [String(item[idKey]), item]));
    const updates = [];
    const nowIso = new Date().toISOString();
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
        updatedAt: record.updatedAt || record.updated_at || nowIso,
      });
    });
    if (updates.length) {
      await storage.db.staff.bulkPut(updates);
    }
  }

  async mergeRemoteSalaryRecords(records, idKey = 'salaryId') {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return;
    const localMap = new Map((await this.getSalaryRecords()).map((item) => [String(item[idKey]), item]));
    const updates = [];
    const nowIso = new Date().toISOString();
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
        updatedAt: record.updatedAt || record.updated_at || nowIso,
      });
    });
    if (updates.length) {
      await storage.db.salaries.bulkPut(updates);
    }
  }

  async mergeRemoteExpenseRecords(records, idKey = 'expenseId') {
    const list = Array.isArray(records) ? records : [];
    if (!list.length) return;
    const localMap = new Map((await this.getExpenseRecords()).map((item) => [String(item[idKey]), item]));
    const updates = [];
    const nowIso = new Date().toISOString();
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
        updatedAt: record.updatedAt || record.updated_at || nowIso,
      });
    });
    if (updates.length) {
      await storage.db.expenses.bulkPut(updates);
    }
  }
}
