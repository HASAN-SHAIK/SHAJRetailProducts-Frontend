import * as storage from './internal/storage';
import {
  createSupplierRemote,
  deleteSupplierRemote,
  fetchSupplierById,
  fetchSupplierLedger,
  fetchSuppliers,
  isOnline,
  updateSupplierRemote,
} from './api/supplierApiClient';
import { filterSuppliersByTerm, isTempEntityId } from './api/supplierNormalizer';

/** @implements {import('../Interfaces/ISupplierRepository').ISupplierRepository} */
export class ApiSupplierRepository {
  constructor() {
    this.cache = storage;
  }

  updateSuppliersCacheBulk(suppliers) {
    return this.cache.updateSuppliersCacheBulk(suppliers);
  }

  getAllSuppliersCache() {
    return this.cache.getAllSuppliersCache();
  }

  async getSupplierCacheById(supplierId) {
    const cached = await this.cache.getSupplierCacheById(supplierId);
    if (cached) return cached;
    return this.getSupplierById(supplierId);
  }

  async getSupplierById(supplierId) {
    if (isOnline() && supplierId && !isTempEntityId(supplierId)) {
      try {
        const supplier = await fetchSupplierById(supplierId);
        if (supplier) {
          await this.cache.updateSuppliersCacheBulk([supplier]);
          return (await this.cache.getSupplierCacheById(supplierId)) || supplier;
        }
      } catch {
        // fall through to cache
      }
    }
    return this.cache.getSupplierCacheById(supplierId);
  }

  deleteSuppliersCacheByIds(ids = []) {
    return this.cache.deleteSuppliersCacheByIds(ids);
  }

  upsertSupplierLedgerEntry(entry) {
    return this.cache.upsertSupplierLedgerEntry(entry);
  }

  upsertSupplierLedgerBulk(entries = []) {
    return this.cache.upsertSupplierLedgerBulk(entries);
  }

  getSupplierLedgerBySupplierId(supplierId) {
    return this.cache.getSupplierLedgerBySupplierId(supplierId);
  }

  dedupeSuppliersCache() {
    return this.cache.dedupeSuppliersCache();
  }

  upsertLocalSupplier(supplier) {
    return this.cache.upsertLocalSupplier(supplier);
  }

  getLocalSuppliers(status = null) {
    return this.cache.getLocalSuppliers(status);
  }

  getLocalSupplierById(supplierId) {
    return this.cache.getLocalSupplierById(supplierId);
  }

  deleteLocalSupplier(supplierId) {
    return this.cache.deleteLocalSupplier(supplierId);
  }

  async searchSuppliers(options = {}) {
    const search = String(options.search || '').trim();
    const limit = options.limit || 500;
    const branchId = options.branchId || null;

    if (isOnline()) {
      try {
        const suppliers = await fetchSuppliers({ search, limit, branchId });
        if (suppliers.length) {
          await this.cache.updateSuppliersCacheBulk(suppliers);
        }
        if (suppliers.length || search) {
          return suppliers;
        }
      } catch {
        // fall back to local cache search
      }
    }

    const cached = await this.cache.dedupeSuppliersCache();
    return filterSuppliersByTerm(cached, search);
  }

  async getSupplierLedgerDetail(supplierId) {
    if (!isOnline() || !supplierId || isTempEntityId(supplierId)) {
      const supplier = await this.cache.getSupplierCacheById(supplierId);
      const ledger = await this.cache.getSupplierLedgerBySupplierId(String(supplierId));
      return supplier ? { supplier, ledger: Array.isArray(ledger) ? ledger : [] } : null;
    }

    try {
      const detail = await fetchSupplierLedger(supplierId);
      if (detail?.supplier) {
        await this.cache.updateSuppliersCacheBulk([detail.supplier]);
      }
      return detail;
    } catch {
      const supplier = await this.cache.getSupplierCacheById(supplierId);
      const ledger = await this.cache.getSupplierLedgerBySupplierId(String(supplierId));
      return supplier ? { supplier, ledger: Array.isArray(ledger) ? ledger : [] } : null;
    }
  }

  async createSupplier(payload) {
    if (!isOnline()) {
      throw new Error('Supplier create is not available offline');
    }
    const supplier = await createSupplierRemote(payload);
    if (supplier) {
      await this.cache.updateSuppliersCacheBulk([supplier]);
    }
    return supplier;
  }

  async updateSupplier(supplierId, payload) {
    if (!isOnline()) {
      throw new Error('Supplier update is not available offline');
    }
    const supplier = await updateSupplierRemote(supplierId, payload);
    if (supplier) {
      await this.cache.updateSuppliersCacheBulk([supplier]);
    }
    return supplier;
  }

  async deleteSupplier(supplierId) {
    if (!isOnline()) {
      throw new Error('Supplier delete is not available offline');
    }
    await deleteSupplierRemote(supplierId);
    await this.cache.deleteSuppliersCacheByIds([supplierId]);
  }
}
