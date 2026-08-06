import { IndexedDbCustomerRepository } from './IndexedDbCustomerRepository';
import {
  createCustomerRemote,
  fetchCustomerDetail,
  fetchCustomers,
  isOnline,
  updateCustomerRemote,
} from './api/customerApiClient';
import { filterCustomersByTerm, isTempEntityId } from './api/customerNormalizer';

/** @implements {import('../Interfaces/ICustomerRepository').ICustomerRepository} */
export class ApiCustomerRepository {
  constructor() {
    this.cache = new IndexedDbCustomerRepository();
  }

  getAllCustomers() {
    return this.cache.getAllCustomers();
  }

  upsertCustomerLocal(customer) {
    return this.cache.upsertCustomerLocal(customer);
  }

  async getCustomerById(customerId) {
    const cached = await this.cache.getCustomerById(customerId);
    if (cached) return cached;
    if (!isOnline() || !customerId || isTempEntityId(customerId)) return cached;

    try {
      const detail = await fetchCustomerDetail(customerId);
      if (detail?.customer) {
        await this.cache.upsertCustomersBulk([detail.customer]);
        return (await this.cache.getCustomerById(customerId)) || detail.customer;
      }
    } catch {
      // fall through to cache
    }
    return cached;
  }

  saveCustomersBulk(customers) {
    return this.cache.saveCustomersBulk(customers);
  }

  upsertCustomersBulk(customers) {
    return this.cache.upsertCustomersBulk(customers);
  }

  getAllCustomerRecords() {
    return this.cache.getAllCustomerRecords();
  }

  async searchCustomers(options = {}) {
    const search = String(options.search || '').trim();
    const limit = options.limit || 500;

    if (isOnline()) {
      try {
        const customers = await fetchCustomers({ search, limit });
        if (customers.length) {
          await this.cache.upsertCustomersBulk(customers);
        }
        if (customers.length || search) {
          return customers;
        }
      } catch {
        // fall back to local cache search
      }
    }

    const cached = await this.cache.getAllCustomers();
    return filterCustomersByTerm(cached, search);
  }

  async getCustomerDetail(customerId) {
    const cached = await this.cache.getCustomerById(customerId);
    if (!isOnline() || !customerId || isTempEntityId(customerId)) {
      return cached ? { customer: cached, orders: [], payments: [] } : null;
    }

    try {
      const detail = await fetchCustomerDetail(customerId);
      if (detail?.customer) {
        await this.cache.upsertCustomersBulk([detail.customer]);
      }
      return detail;
    } catch {
      return cached ? { customer: cached, orders: [], payments: [] } : null;
    }
  }

  async createCustomer(payload) {
    if (!isOnline()) {
      throw new Error('Customer create is not available offline');
    }
    const customer = await createCustomerRemote(payload);
    if (customer) {
      await this.cache.upsertCustomersBulk([customer]);
    }
    return customer;
  }

  async updateCustomer(customerId, payload) {
    if (!isOnline()) {
      throw new Error('Customer update is not available offline');
    }
    const customer = await updateCustomerRemote(customerId, payload);
    if (customer) {
      await this.cache.upsertCustomersBulk([customer]);
    }
    return customer;
  }
}
