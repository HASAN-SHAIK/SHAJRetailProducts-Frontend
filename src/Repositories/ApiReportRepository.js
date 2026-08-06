import { IndexedDbReportRepository } from './IndexedDbReportRepository';
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
  constructor() {
    this.cache = new IndexedDbReportRepository();
  }

  async getDailyExpenseReport(options = {}) {
    if (isOnline()) {
      try {
        return await fetchDailyExpenseReportRemote(options);
      } catch {
        // fall back to local aggregation
      }
    }
    return this.cache.getDailyExpenseReport(options);
  }

  async getMonthlyExpenseReport(options = {}) {
    if (isOnline()) {
      try {
        return await fetchMonthlyExpenseReportRemote(options);
      } catch {
        // fall back to local aggregation
      }
    }
    return this.cache.getMonthlyExpenseReport(options);
  }

  async getStaffExpenses(options = {}) {
    if (isOnline()) {
      try {
        return await fetchStaffExpensesRemote(options);
      } catch {
        // fall back to local cache
      }
    }
    return this.cache.getStaffExpenses(options);
  }

  async getStaffExpenseTotal(options = {}) {
    if (isOnline()) {
      try {
        return await fetchStaffExpenseTotalRemote(options);
      } catch {
        // fall back to local aggregation
      }
    }
    return this.cache.getStaffExpenseTotal(options);
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
        // fall back to local cache
      }
    }
    return this.cache.getEwayBills();
  }
}
