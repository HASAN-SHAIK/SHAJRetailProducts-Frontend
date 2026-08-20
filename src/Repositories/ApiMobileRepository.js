import {
  fetchMobileDashboardRemote,
  fetchMobileLowStockRemote,
  fetchMobileSalesSummaryRemote,
  isOnline,
} from './api/mobileApiClient';

/** @implements {import('../Interfaces/IMobileRepository').IMobileRepository} */
export class ApiMobileRepository {
  async getDashboard(options = {}) {
    if (isOnline()) {
      try {
        return await fetchMobileDashboardRemote(options);
      } catch {
        // fall back to empty payload
      }
    }
    return null;
  }

  async getSalesSummary() {
    if (isOnline()) {
      try {
        return await fetchMobileSalesSummaryRemote();
      } catch {
        // fall back to empty payload
      }
    }
    return null;
  }

  async getLowStock(options = {}) {
    if (isOnline()) {
      try {
        return await fetchMobileLowStockRemote(options);
      } catch {
        // fall back to empty payload
      }
    }
    return { products: [], meta: null };
  }
}
