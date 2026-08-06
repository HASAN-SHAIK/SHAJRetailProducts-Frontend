import { IndexedDbMobileRepository } from './IndexedDbMobileRepository';
import {
  fetchMobileDashboardRemote,
  fetchMobileLowStockRemote,
  fetchMobileSalesSummaryRemote,
  isOnline,
} from './api/mobileApiClient';

/** @implements {import('../Interfaces/IMobileRepository').IMobileRepository} */
export class ApiMobileRepository {
  constructor() {
    this.cache = new IndexedDbMobileRepository();
  }

  async getDashboard(options = {}) {
    if (isOnline()) {
      try {
        const payload = await fetchMobileDashboardRemote(options);
        if (payload) {
          await this.cache.cacheDashboard(payload);
          return payload;
        }
      } catch {
        // fall back to cache
      }
    }
    return this.cache.getDashboard();
  }

  async getSalesSummary() {
    if (isOnline()) {
      try {
        const payload = await fetchMobileSalesSummaryRemote();
        if (payload) {
          await this.cache.cacheSalesSummary(payload);
          return payload;
        }
      } catch {
        // fall back to cache
      }
    }
    return this.cache.getSalesSummary();
  }

  async getLowStock(options = {}) {
    if (isOnline()) {
      try {
        const payload = await fetchMobileLowStockRemote(options);
        await this.cache.cacheLowStock(payload);
        return payload;
      } catch {
        // fall back to cache
      }
    }
    return this.cache.getLowStock(options);
  }
}
