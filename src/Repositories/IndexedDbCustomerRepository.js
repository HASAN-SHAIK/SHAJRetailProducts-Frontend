import * as storage from './internal/storage';
import { filterCustomersByTerm } from './api/customerNormalizer';

/** @implements {import('../Interfaces/ICustomerRepository').ICustomerRepository} */
export class IndexedDbCustomerRepository {
  getAllCustomers() {
    return storage.getAllCustomers();
  }

  upsertCustomerLocal(customer) {
    return storage.upsertCustomerLocal(customer);
  }

  getCustomerById(customerId) {
    return storage.getCustomerById(customerId);
  }

  saveCustomersBulk(customers) {
    return storage.saveCustomersBulk(customers);
  }

  upsertCustomersBulk(customers) {
    return storage.upsertCustomersBulk(customers);
  }

  getAllCustomerRecords() {
    return storage.db.customers.toArray();
  }

  async searchCustomers(options = {}) {
    const customers = await this.getAllCustomers();
    return filterCustomersByTerm(customers, options.search);
  }

  async getCustomerDetail(customerId) {
    const customer = await this.getCustomerById(customerId);
    return customer ? { customer, orders: [], payments: [] } : null;
  }

  async createCustomer() {
    throw new Error('Customer create is not available in IndexedDB repository');
  }

  async updateCustomer() {
    throw new Error('Customer update is not available in IndexedDB repository');
  }
}
