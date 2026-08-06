import * as storage from './internal/storage';
import { filterSuppliersByTerm } from './api/supplierNormalizer';

/** @implements {import('../Interfaces/ISupplierRepository').ISupplierRepository} */
export class IndexedDbSupplierRepository {
  updateSuppliersCacheBulk(suppliers) {
    return storage.updateSuppliersCacheBulk(suppliers);
  }

  getAllSuppliersCache() {
    return storage.getAllSuppliersCache();
  }

  getSupplierCacheById(supplierId) {
    return storage.getSupplierCacheById(supplierId);
  }

  deleteSuppliersCacheByIds(ids = []) {
    return storage.deleteSuppliersCacheByIds(ids);
  }

  upsertSupplierLedgerEntry(entry) {
    return storage.upsertSupplierLedgerEntry(entry);
  }

  upsertSupplierLedgerBulk(entries = []) {
    return storage.upsertSupplierLedgerBulk(entries);
  }

  getSupplierLedgerBySupplierId(supplierId) {
    return storage.getSupplierLedgerBySupplierId(supplierId);
  }

  dedupeSuppliersCache() {
    return storage.dedupeSuppliersCache();
  }

  upsertLocalSupplier(supplier) {
    return storage.upsertLocalSupplier(supplier);
  }

  getLocalSuppliers(status = null) {
    return storage.getLocalSuppliers(status);
  }

  getLocalSupplierById(supplierId) {
    return storage.db.suppliers.get(supplierId);
  }

  deleteLocalSupplier(supplierId) {
    return storage.db.suppliers.delete(supplierId);
  }

  async searchSuppliers(options = {}) {
    const suppliers = await this.dedupeSuppliersCache();
    return filterSuppliersByTerm(suppliers, options.search);
  }

  getSupplierById(supplierId) {
    return this.getSupplierCacheById(supplierId);
  }

  async getSupplierLedgerDetail(supplierId) {
    const supplier = await this.getSupplierCacheById(supplierId);
    const ledger = await this.getSupplierLedgerBySupplierId(String(supplierId));
    return supplier ? { supplier, ledger: Array.isArray(ledger) ? ledger : [] } : null;
  }

  async createSupplier() {
    throw new Error('Supplier create is not available in IndexedDB repository');
  }

  async updateSupplier() {
    throw new Error('Supplier update is not available in IndexedDB repository');
  }

  async deleteSupplier() {
    throw new Error('Supplier delete is not available in IndexedDB repository');
  }
}
