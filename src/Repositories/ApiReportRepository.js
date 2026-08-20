import {
  fetchDailyExpenseReportRemote,
  fetchEwayBillsRemote,
  fetchMonthlyExpenseReportRemote,
  fetchStaffExpenseTotalRemote,
  fetchStaffExpensesRemote,
  isOnline,
} from './api/reportApiClient';

/** @implements {import('../Interfaces/IReportRepository').IReportRepository} */
export class ApiReportRepository {
  async getDailyExpenseReport(options = {}) {
    if (isOnline()) {
      try {
        return await fetchDailyExpenseReportRemote(options);
      } catch {
        // fall back to empty aggregation
      }
    }
    return { total: 0, categories: [] };
  }

  async getMonthlyExpenseReport(options = {}) {
    if (isOnline()) {
      try {
        return await fetchMonthlyExpenseReportRemote(options);
      } catch {
        // fall back to empty aggregation
      }
    }
    return { total: 0, categories: [] };
  }

  async getStaffExpenses(options = {}) {
    if (isOnline()) {
      try {
        return await fetchStaffExpensesRemote(options);
      } catch {
        // fall back to empty list
      }
    }
    return [];
  }

  async getStaffExpenseTotal(options = {}) {
    if (isOnline()) {
      try {
        return await fetchStaffExpenseTotalRemote(options);
      } catch {
        // fall back to empty total
      }
    }
    return 0;
  }

  async getEwayBills() {
    if (isOnline()) {
      try {
        const list = await fetchEwayBillsRemote();
        if (list.length) {
          const { mergeRemoteEwayRecords } = await import('../services/local/returnsLocalService');
          await mergeRemoteEwayRecords(list).catch(() => {});
        }
        return list;
      } catch {
        // fall back to empty list
      }
    }
    return [];
  }
}
