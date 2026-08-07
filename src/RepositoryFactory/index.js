import { IndexedDbDatabaseRepository } from '../Repositories/IndexedDbDatabaseRepository';
import { ApiProductRepository } from '../Repositories/ApiProductRepository';
import { IndexedDbProductRepository } from '../Repositories/IndexedDbProductRepository';
import { LocalPosProductRepository } from '../Repositories/LocalPosProductRepository';
import { ApiCategoryRepository } from '../Repositories/ApiCategoryRepository';
import { LocalCategoryRepository } from '../Repositories/LocalCategoryRepository';
import { ApiCustomerRepository } from '../Repositories/ApiCustomerRepository';
import { IndexedDbCustomerRepository } from '../Repositories/IndexedDbCustomerRepository';
import { LocalPosCustomerRepository } from '../Repositories/LocalPosCustomerRepository';
import { ApiSupplierRepository } from '../Repositories/ApiSupplierRepository';
import { IndexedDbSupplierRepository } from '../Repositories/IndexedDbSupplierRepository';
import { ApiInventoryRepository } from '../Repositories/ApiInventoryRepository';
import { IndexedDbInventoryRepository } from '../Repositories/IndexedDbInventoryRepository';
import { IndexedDbTransactionRepository } from '../Repositories/IndexedDbTransactionRepository';
import { IndexedDbSessionRepository } from '../Repositories/IndexedDbSessionRepository';
import { IndexedDbConfigRepository } from '../Repositories/IndexedDbConfigRepository';
import { IndexedDbSyncRepository } from '../Repositories/IndexedDbSyncRepository';
import { IndexedDbOfflineRepository } from '../Repositories/IndexedDbOfflineRepository';
import { ApiOrderRepository } from '../Repositories/ApiOrderRepository';
import { IndexedDbOrderRepository } from '../Repositories/IndexedDbOrderRepository';
import { LocalPosOrderRepository } from '../Repositories/LocalPosOrderRepository';
import { ApiPurchaseRepository } from '../Repositories/ApiPurchaseRepository';
import { IndexedDbPurchaseRepository } from '../Repositories/IndexedDbPurchaseRepository';
import { IndexedDbStaffRepository } from '../Repositories/IndexedDbStaffRepository';
import { IndexedDbReturnsRepository } from '../Repositories/IndexedDbReturnsRepository';
import { IndexedDbBackupRepository } from '../Repositories/IndexedDbBackupRepository';
import { IndexedDbBillingRepository } from '../Repositories/IndexedDbBillingRepository';
import { ApiReportRepository } from '../Repositories/ApiReportRepository';
import { IndexedDbReportRepository } from '../Repositories/IndexedDbReportRepository';
import { ApiApplicationSettingsRepository } from '../Repositories/ApiApplicationSettingsRepository';
import { IndexedDbApplicationSettingsRepository } from '../Repositories/IndexedDbApplicationSettingsRepository';
import { ApiMobileRepository } from '../Repositories/ApiMobileRepository';
import { IndexedDbMobileRepository } from '../Repositories/IndexedDbMobileRepository';
import { IndexedDbOfflineOperationRepository } from '../Repositories/IndexedDbOfflineOperationRepository';

const instances = {};
const localPosEnabled = () => String(process.env.REACT_APP_POS_LOCAL_API_ENABLED || 'false').toLowerCase() === 'true';

export const getDatabaseRepository = () => {
  if (!instances.database) instances.database = new IndexedDbDatabaseRepository();
  return instances.database;
};

export const getProductRepository = () => {
  if (!instances.product) {
    const useApiRepository = String(process.env.REACT_APP_PRODUCT_REPOSITORY || 'api').toLowerCase() !== 'indexeddb';
    if (localPosEnabled() && useApiRepository) instances.product = new LocalPosProductRepository();
    else instances.product = useApiRepository ? new ApiProductRepository() : new IndexedDbProductRepository();
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
    const useApiRepository = String(process.env.REACT_APP_CUSTOMER_REPOSITORY || 'api').toLowerCase() !== 'indexeddb';
    if (localPosEnabled() && useApiRepository) instances.customer = new LocalPosCustomerRepository();
    else instances.customer = useApiRepository ? new ApiCustomerRepository() : new IndexedDbCustomerRepository();
  }
  return instances.customer;
};

export const getSupplierRepository = () => {
  if (!instances.supplier) {
    const useApiRepository = String(process.env.REACT_APP_SUPPLIER_REPOSITORY || 'api').toLowerCase() !== 'indexeddb';
    instances.supplier = useApiRepository ? new ApiSupplierRepository() : new IndexedDbSupplierRepository();
  }
  return instances.supplier;
};

export const getInventoryRepository = () => {
  if (!instances.inventory) {
    const useApiRepository = String(process.env.REACT_APP_INVENTORY_REPOSITORY || 'api').toLowerCase() !== 'indexeddb';
    instances.inventory = useApiRepository ? new ApiInventoryRepository() : new IndexedDbInventoryRepository();
  }
  return instances.inventory;
};

export const getTransactionRepository = () => {
  if (!instances.transaction) instances.transaction = new IndexedDbTransactionRepository();
  return instances.transaction;
};

export const getSessionRepository = () => {
  if (!instances.session) instances.session = new IndexedDbSessionRepository();
  return instances.session;
};

export const getConfigRepository = () => {
  if (!instances.config) instances.config = new IndexedDbConfigRepository();
  return instances.config;
};

export const getSyncRepository = () => {
  if (!instances.sync) instances.sync = new IndexedDbSyncRepository();
  return instances.sync;
};

export const getOfflineRepository = () => {
  if (!instances.offline) instances.offline = new IndexedDbOfflineRepository();
  return instances.offline;
};

export const getPurchaseRepository = () => {
  if (!instances.purchase) {
    const useApiRepository = String(process.env.REACT_APP_PURCHASE_REPOSITORY || 'api').toLowerCase() !== 'indexeddb';
    instances.purchase = useApiRepository ? new ApiPurchaseRepository() : new IndexedDbPurchaseRepository();
  }
  return instances.purchase;
};

export const getStaffRepository = () => {
  if (!instances.staff) instances.staff = new IndexedDbStaffRepository();
  return instances.staff;
};

export const getReturnsRepository = () => {
  if (!instances.returns) instances.returns = new IndexedDbReturnsRepository();
  return instances.returns;
};

export const getBackupRepository = () => {
  if (!instances.backup) instances.backup = new IndexedDbBackupRepository();
  return instances.backup;
};

export const getOrderRepository = () => {
  if (!instances.order) {
    const useApiRepository = String(process.env.REACT_APP_SALES_REPOSITORY || 'api').toLowerCase() !== 'indexeddb';
    if (localPosEnabled() && useApiRepository) instances.order = new LocalPosOrderRepository();
    else instances.order = useApiRepository ? new ApiOrderRepository() : new IndexedDbOrderRepository();
  }
  return instances.order;
};

export const getBillingRepository = () => {
  if (!instances.billing) instances.billing = new IndexedDbBillingRepository();
  return instances.billing;
};

export const getReportRepository = () => {
  if (!instances.report) {
    const useApiRepository = String(process.env.REACT_APP_REPORT_REPOSITORY || 'api').toLowerCase() !== 'indexeddb';
    instances.report = useApiRepository ? new ApiReportRepository() : new IndexedDbReportRepository();
  }
  return instances.report;
};

export const getApplicationSettingsRepository = () => {
  if (!instances.applicationSettings) {
    const useApiRepository =
      String(process.env.REACT_APP_APPLICATION_SETTINGS_REPOSITORY || 'api').toLowerCase() !== 'indexeddb';
    instances.applicationSettings = useApiRepository
      ? new ApiApplicationSettingsRepository()
      : new IndexedDbApplicationSettingsRepository();
  }
  return instances.applicationSettings;
};

export const getMobileRepository = () => {
  if (!instances.mobile) {
    const useApiRepository = String(process.env.REACT_APP_MOBILE_REPOSITORY || 'api').toLowerCase() !== 'indexeddb';
    instances.mobile = useApiRepository ? new ApiMobileRepository() : new IndexedDbMobileRepository();
  }
  return instances.mobile;
};

export const getOfflineOperationRepository = () => {
  if (!instances.offlineOperation) instances.offlineOperation = new IndexedDbOfflineOperationRepository();
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
