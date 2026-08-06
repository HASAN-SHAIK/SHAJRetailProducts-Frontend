import * as storage from './internal/storage';

const aggregateExpenseSummary = (expenses = []) => {
  const categoryMap = new Map();
  let total = 0;
  expenses.forEach((item) => {
    const amount = Number(item.amount || 0);
    total += amount;
    const category = item.category || 'Uncategorized';
    categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
  });
  return {
    total,
    categories: Array.from(categoryMap.entries()).map(([category, amount]) => ({ category, amount })),
  };
};

const monthRange = (monthValue) => {
  const [yearRaw, monthRaw] = String(monthValue || '').split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return { from: null, to: null };
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const toLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  return { from: toLocalDate(start), to: toLocalDate(end) };
};

/** @implements {import('../Interfaces/IReportRepository').IReportRepository} */
export class IndexedDbReportRepository {
  async getDailyExpenseReport({ date } = {}) {
    const list = await storage.getLocalExpenses({ from: date, to: date });
    return aggregateExpenseSummary(list.filter((item) => !item.isDeleted && !item.is_deleted));
  }

  async getMonthlyExpenseReport({ month } = {}) {
    const range = monthRange(month);
    if (!range.from || !range.to) return { total: 0, categories: [] };
    const list = await storage.getLocalExpenses({ from: range.from, to: range.to });
    return aggregateExpenseSummary(list.filter((item) => !item.isDeleted && !item.is_deleted));
  }

  async getStaffExpenses({ staffId = null, type = 'staff' } = {}) {
    const list = await storage.getLocalExpenses({ type, staffId: staffId || undefined });
    return list.filter((item) => !item.isDeleted && !item.is_deleted);
  }

  async getStaffExpenseTotal({ staffId, from, to } = {}) {
    const list = await storage.getLocalExpenses({
      type: 'staff',
      staffId: staffId || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    return list
      .filter((item) => !item.isDeleted && !item.is_deleted)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

  async getEwayBills() {
    return storage.getLocalEwayBills();
  }
}
