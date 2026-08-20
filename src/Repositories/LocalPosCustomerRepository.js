import { ApiCustomerRepository } from './ApiCustomerRepository';
import { isLocalPosEnabled, localPosRequest } from './local/posLocalApiClient';
import { toLocalCustomerPayload } from './local/customerPayload';

const normalizeCustomer = (customer) => customer ? {
  ...customer,
  customer_id: customer.customer_id || customer.id,
  mobile: customer.mobile || customer.phone,
  credit_limit: customer.credit_limit ?? Number(customer.credit_limit_minor || 0) / 100,
  current_balance: customer.current_balance ?? Number(customer.outstanding_minor || 0) / 100,
} : customer;

/** Local-first customer projection backed by the local POSService/SQLite API. */
export class LocalPosCustomerRepository extends ApiCustomerRepository {
  async searchCustomers(options = {}) {
    if (!isLocalPosEnabled()) return super.searchCustomers(options);
    const params = new URLSearchParams();
    if (options.search) params.set('q', String(options.search));
    if (options.limit) params.set('limit', String(options.limit));
    const payload = await localPosRequest(`/customers${params.toString() ? `?${params}` : ''}`);
    const customers = (Array.isArray(payload?.items) ? payload.items : []).map(normalizeCustomer);
    if (customers.length) await this.cache.upsertCustomersBulk(customers).catch(() => {});
    return customers;
  }

  async getCustomerById(customerId) {
    const cached = await this.cache.getCustomerById(customerId);
    if (cached) return cached;
    if (!isLocalPosEnabled()) return super.getCustomerById(customerId);
    const customer = normalizeCustomer(await localPosRequest(`/customers/${encodeURIComponent(String(customerId || '').trim())}`));
    if (customer) await this.cache.upsertCustomersBulk([customer]).catch(() => {});
    return customer;
  }

  async getCustomerDetail(customerId) {
    if (!isLocalPosEnabled()) return super.getCustomerDetail(customerId);
    const customer = await this.getCustomerById(customerId);
    return customer ? { customer, orders: [], payments: [] } : null;
  }

  async createCustomer(payload) {
    if (!isLocalPosEnabled()) return super.createCustomer(payload);
    const customer = normalizeCustomer(await localPosRequest('/customers', { method: 'POST', body: toLocalCustomerPayload(payload) }));
    if (customer) await this.cache.upsertCustomersBulk([customer]).catch(() => {});
    return customer;
  }

  async updateCustomer(customerId, payload) {
    if (!isLocalPosEnabled()) return super.updateCustomer(customerId, payload);
    const customer = normalizeCustomer(await localPosRequest(`/customers/${encodeURIComponent(String(customerId))}`, {
      method: 'PUT', body: toLocalCustomerPayload(payload),
    }));
    if (customer) await this.cache.upsertCustomersBulk([customer]).catch(() => {});
    return customer;
  }
}
