import { ApiProductRepository } from '../Repositories/ApiProductRepository';
import { LocalPosProductRepository } from '../Repositories/LocalPosProductRepository';
import { ApiCategoryRepository } from '../Repositories/ApiCategoryRepository';
import { LocalCategoryRepository } from '../Repositories/LocalCategoryRepository';
import { ApiCustomerRepository } from '../Repositories/ApiCustomerRepository';
import { LocalPosCustomerRepository } from '../Repositories/LocalPosCustomerRepository';
import { ApiSupplierRepository } from '../Repositories/ApiSupplierRepository';
import { ApiInventoryRepository } from '../Repositories/ApiInventoryRepository';
import { LocalPosInventoryRepository } from '../Repositories/LocalPosInventoryRepository';
import { ApiOrderRepository } from '../Repositories/ApiOrderRepository';
import { LocalPosOrderRepository } from '../Repositories/LocalPosOrderRepository';
import { ApiPurchaseRepository } from '../Repositories/ApiPurchaseRepository';
import { ApiReportRepository } from '../Repositories/ApiReportRepository';
import { ApiApplicationSettingsRepository } from '../Repositories/ApiApplicationSettingsRepository';
import { ApiMobileRepository } from '../Repositories/ApiMobileRepository';
import * as storage from '../Repositories/internal/storage';

const instances = {};
const localPosEnabled = () => String(process.env.REACT_APP_POS_LOCAL_API_ENABLED || 'false').toLowerCase() === 'true';

export const getDatabaseRepository = () => {
  if (!instances.database) instances.database = storage;
  return instances.database;
};

export const getProductRepository = () => {
  if (!instances.product) {
    instances.product = localPosEnabled() ? new LocalPosProductRepository() : new ApiProductRepository();
  }
  return instances.product;
};

export const getCategoryRepository = () => {
  if (!instances.category) {
    const useApiRepository = String(process.env.REACT_APP_CATEGORY_REPOSITORY || 'api').toLowerCase() !== 'local';
    instances.category = useApiRepository ? new ApiCategoryRepository() : new LocalCategoryRepository();
  }
  return instances.category;
};

export const getCustomerRepository = () => {
  if (!instances.customer) {
    instances.customer = localPosEnabled() ? new LocalPosCustomerRepository() : new ApiCustomerRepository();
  }
  return instances.customer;
};

export const getSupplierRepository = () => {
  if (!instances.supplier) {
    instances.supplier = new ApiSupplierRepository();
  }
  return instances.supplier;
};

export const getInventoryRepository = () => {
  if (!instances.inventory) {
    instances.inventory = localPosEnabled() ? new LocalPosInventoryRepository() : new ApiInventoryRepository();
  }
  return instances.inventory;
};

export const getTransactionRepository = () => {
  if (!instances.transaction) instances.transaction = storage;
  return instances.transaction;
};

export const getSessionRepository = () => {
  if (!instances.session) instances.session = storage;
  return instances.session;
};

export const getConfigRepository = () => {
  if (!instances.config) instances.config = storage;
  return instances.config;
};

export const getSyncRepository = () => {
  if (!instances.sync) instances.sync = storage;
  return instances.sync;
};

export const getOfflineRepository = () => {
  if (!instances.offline) instances.offline = storage;
  return instances.offline;
};

export const getPurchaseRepository = () => {
  if (!instances.purchase) {
    instances.purchase = new ApiPurchaseRepository();
  }
  return instances.purchase;
};

export const getStaffRepository = () => {
  if (!instances.staff) instances.staff = storage;
  return instances.staff;
};

export const getReturnsRepository = () => {
  if (!instances.returns) instances.returns = storage;
  return instances.returns;
};

export const getBackupRepository = () => {
  if (!instances.backup) instances.backup = storage;
  return instances.backup;
};

export const getOrderRepository = () => {
  if (!instances.order) {
    instances.order = localPosEnabled() ? new LocalPosOrderRepository() : new ApiOrderRepository();
  }
  return instances.order;
};

export const getBillingRepository = () => {
  if (!instances.billing) instances.billing = storage;
  return instances.billing;
};

export const getReportRepository = () => {
  if (!instances.report) {
    instances.report = new ApiReportRepository();
  }
  return instances.report;
};

export const getApplicationSettingsRepository = () => {
  if (!instances.applicationSettings) {
    instances.applicationSettings = new ApiApplicationSettingsRepository();
  }
  return instances.applicationSettings;
};

export const getMobileRepository = () => {
  if (!instances.mobile) {
    instances.mobile = new ApiMobileRepository();
  }
  return instances.mobile;
};

export const getOfflineOperationRepository = () => {
  if (!instances.offlineOperation) instances.offlineOperation = storage;
  return instances.offlineOperation;
};

const RepositoryFactory = {
  getDatabaseRepository,
  getProductRepository,
  getCategoryRepository,
  getCustomerRepository,
  getSupplierRepository,
  getInventoryRepository,
  getTransactionRepository,
  getSessionRepository,
  getConfigRepository,
  getSyncRepository,
  getOfflineRepository,
  getPurchaseRepository,
  getStaffRepository,
  getReturnsRepository,
  getBackupRepository,
  getOrderRepository,
  getBillingRepository,
  getReportRepository,
  getApplicationSettingsRepository,
  getMobileRepository,
  getOfflineOperationRepository,
};

export default RepositoryFactory;
