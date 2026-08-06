import * as storage from './internal/storage';

const CACHE_KEYS = {
  dashboard: 'mobile_dashboard_cache_v1',
  salesSummary: 'mobile_sales_summary_cache_v1',
  lowStock: 'mobile_low_stock_cache_v1',
};

/** @implements {import('../Interfaces/IMobileRepository').IMobileRepository} */
export class IndexedDbMobileRepository {
  async getDashboard() {
    return storage.getConfigValue(CACHE_KEYS.dashboard);
  }

  async getSalesSummary() {
    return storage.getConfigValue(CACHE_KEYS.salesSummary);
  }

  async getLowStock(options = {}) {
    const cached = await storage.getConfigValue(CACHE_KEYS.lowStock);
    if (!cached) return { products: [], meta: null };
    const products = Array.isArray(cached.products) ? cached.products : [];
    if (!options?.threshold) return { products, meta: cached.meta || null };
    return {
      products: products.filter((item) => Number(item?.stock ?? 0) <= Number(options.threshold)),
      meta: cached.meta || null,
    };
  }

  async cacheDashboard(payload) {
    if (payload) await storage.saveConfigValue(CACHE_KEYS.dashboard, payload);
  }

  async cacheSalesSummary(payload) {
    if (payload) await storage.saveConfigValue(CACHE_KEYS.salesSummary, payload);
  }

  async cacheLowStock(payload) {
    if (payload) await storage.saveConfigValue(CACHE_KEYS.lowStock, payload);
  }
}

export { CACHE_KEYS };
