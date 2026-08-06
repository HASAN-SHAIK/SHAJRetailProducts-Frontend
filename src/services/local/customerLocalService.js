import { getCustomerRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  getAllCustomers,
  upsertCustomerLocal,
  getCustomerById,
  saveCustomersBulk,
  upsertCustomersBulk,
  getAllCustomerRecords,
  searchCustomers,
  getCustomerDetail,
  createCustomer,
  updateCustomer,
} = createRepositoryFacade(() => getCustomerRepository(), [
  'getAllCustomers',
  'upsertCustomerLocal',
  'getCustomerById',
  'saveCustomersBulk',
  'upsertCustomersBulk',
  'getAllCustomerRecords',
  'searchCustomers',
  'getCustomerDetail',
  'createCustomer',
  'updateCustomer',
]);
