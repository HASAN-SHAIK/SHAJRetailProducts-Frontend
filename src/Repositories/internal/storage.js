/**
 * Storage adapter after browser database retirement.
 *
 * Browser persistence is no longer an authority or cache layer. Data should
 * come from the API or POSService/SQLite repositories. These exports preserve
 * legacy repository import contracts while making local browser writes inert.
 */

const unavailable = (action = 'Browser storage') => {
  throw new Error(`${action} is not available; use API/POSService SQLite repositories`);
};

const emptyArray = async () => [];
const nullValue = async () => null;
const zero = async () => 0;
const identityList = async (items) => (Array.isArray(items) ? items : []);
const passthrough = async (value) => value;
const noop = async () => undefined;
const returnKey = async (value) => value?.id ?? value?.local_id ?? undefined;

const makeTable = (name = 'table') => ({
  name,
  toArray: emptyArray,
  get: nullValue,
  put: returnKey,
  add: returnKey,
  bulkPut: identityList,
  bulkDelete: noop,
  delete: noop,
  clear: noop,
  where() {
    return this;
  },
  equals() {
    return this;
  },
  anyOf() {
    return this;
  },
  below() {
    return this;
  },
  above() {
    return this;
  },
  between() {
    return this;
  },
  reverse() {
    return this;
  },
  sortBy: emptyArray,
  first: nullValue,
  count: zero,
});

const baseDb = {
  name: 'sqlite_authoritative_browser_storage_disabled',
  tables: [],
  table() {
    return makeTable();
  },
  transaction: async (...args) => {
    const callback = args.find((arg) => typeof arg === 'function');
    if (!callback) return undefined;
    return await callback();
  },
};

export const db = new Proxy(baseDb, {
  get(target, prop, receiver) {
    if (prop in target) return Reflect.get(target, prop, receiver);
    if (typeof prop === 'string') {
      const table = makeTable(prop);
      target[prop] = table;
      target.tables = [...target.tables, table];
      return table;
    }
    return undefined;
  },
});

export const initDB = async () => db;
export const validateAndPrepare = passthrough;
export const saveProductsBulk = identityList;
export const getAllProducts = emptyArray;
export const getAllProductsCache = emptyArray;
export const updateProductsBulk = identityList;
export const updateProductsCacheBulk = identityList;
export const updateProductsCacheStock = noop;
export const getProductByBarcode = nullValue;
export const getProductCacheByBarcode = nullValue;
export const getProductCacheById = nullValue;
export const updateProduct = passthrough;
export const upsertLocalProduct = () => unavailable('Local product storage');
export const getLocalProducts = emptyArray;
export const getLocalProductById = nullValue;
export const deleteLocalProduct = noop;
export const deleteProductsCacheByIds = noop;

export const saveBatchesBulk = identityList;
export const updateBatchesBulk = identityList;
export const getAllBatches = emptyArray;
export const getAllBatchesCache = emptyArray;
export const getBatchCacheById = nullValue;
export const getLatestBatchForProduct = nullValue;
export const getBatchesForProduct = emptyArray;
export const deleteBatchesCacheByIds = noop;
export const addLocalBatchCache = passthrough;

export const getAllCustomers = emptyArray;
export const upsertCustomerLocal = () => unavailable('Local customer storage');
export const getCustomerById = nullValue;
export const saveCustomersBulk = identityList;
export const upsertCustomersBulk = identityList;
export const getAllCustomerRecords = emptyArray;
export const replaceCustomerIdReferences = noop;

export const updateSuppliersCacheBulk = identityList;
export const getAllSuppliersCache = emptyArray;
export const getSupplierCacheById = nullValue;
export const deleteSuppliersCacheByIds = noop;
export const upsertLocalSupplier = () => unavailable('Local supplier storage');
export const getLocalSuppliers = emptyArray;
export const getLocalSupplierById = nullValue;
export const deleteLocalSupplier = noop;
export const replaceSupplierIdReferences = noop;
export const dedupeSuppliersCache = noop;

export const saveTransactionsBulk = identityList;
export const upsertTransaction = passthrough;
export const getTransactions = emptyArray;
export const getTransactionById = nullValue;
export const getTransactionsByOrderId = emptyArray;
export const upsertAccountingTransaction = passthrough;
export const getAccountingTransactions = emptyArray;
export const upsertSupplierLedgerEntry = passthrough;
export const upsertSupplierLedgerBulk = identityList;
export const getSupplierLedgerBySupplierId = emptyArray;

export const saveSessionValue = noop;
export const getSessionValue = nullValue;
export const clearSessionValue = noop;
export const clearSessionStore = noop;

export const getOfflineOrders = emptyArray;
export const saveOfflineOrdersBulk = identityList;
export const upsertOfflineOrder = () => unavailable('Offline order browser queue');
export const deleteOfflineOrdersByIds = noop;
export const getOfflineOrderQueue = emptyArray;

export const saveConfigValue = noop;
export const getConfigValue = nullValue;

export const upsertLocalPurchase = () => unavailable('Local purchase storage');
export const upsertLocalPurchasesBulk = identityList;
export const getLocalPurchases = emptyArray;
export const getLocalPurchaseById = nullValue;
export const addLocalPurchaseItems = identityList;
export const getLocalPurchaseItems = emptyArray;
export const upsertLocalPurchaseReturn = () => unavailable('Local purchase return storage');
export const getLocalPurchaseReturns = emptyArray;
export const getLocalPurchaseReturnById = nullValue;
export const upsertOfflinePurchase = () => unavailable('Offline purchase browser queue');
export const addOfflinePurchaseItems = identityList;
export const getOfflinePurchases = emptyArray;
export const getOfflinePurchaseItems = emptyArray;
export const upsertOfflinePurchaseReturn = () => unavailable('Offline purchase return browser queue');
export const getOfflinePurchaseReturns = emptyArray;

export const addInventorySyncQueueEntry = () => unavailable('Browser inventory sync queue');
export const updateInventorySyncQueueEntry = noop;
export const getInventorySyncQueueEntries = emptyArray;
export const findInventorySyncQueueEntry = nullValue;
export const addSyncLog = noop;
export const addSyncQueueItem = () => unavailable('Browser sync queue');
export const updateSyncQueueItem = noop;
export const getSyncQueueItems = emptyArray;
export const addSyncQueueEntry = () => unavailable('Browser sync queue');
export const updateSyncQueueEntry = noop;
export const getPendingSyncEntries = emptyArray;
export const findPendingSyncEntry = nullValue;

export const addOfflineImport = () => unavailable('Browser import queue');
export const getOfflineImports = emptyArray;
export const getOfflineImportItems = emptyArray;
export const updateOfflineImport = noop;
export const updateOfflineImportStatus = noop;
export const addProductIdMapping = noop;
export const getProductIdMappings = emptyArray;
export const replaceProductIdReferences = noop;

export const upsertLocalStaff = () => unavailable('Local staff storage');
export const getLocalStaff = emptyArray;
export const getLocalStaffById = nullValue;
export const deleteLocalStaff = noop;
export const upsertLocalSalary = () => unavailable('Local salary storage');
export const getLocalSalaries = emptyArray;
export const getLocalSalaryById = nullValue;
export const deleteLocalSalary = noop;
export const upsertLocalExpense = () => unavailable('Local expense storage');
export const getLocalExpenses = emptyArray;
export const getLocalExpenseById = nullValue;
export const deleteLocalExpense = noop;

export const upsertLocalSalesReturn = () => unavailable('Local sales return storage');
export const getLocalSalesReturns = emptyArray;
export const getLocalSalesReturnById = nullValue;
export const deleteLocalSalesReturn = noop;
export const upsertLocalCorrection = () => unavailable('Local correction storage');
export const getLocalCorrections = emptyArray;
export const getLocalCorrectionById = nullValue;
export const deleteLocalCorrection = noop;
export const upsertLocalGstEntry = () => unavailable('Local GST storage');
export const getLocalGstEntries = emptyArray;
export const upsertLocalEwayBill = () => unavailable('Local e-way bill storage');
export const getLocalEwayBills = emptyArray;
export const deleteLocalEwayBill = noop;

export const exportLocalDbSnapshot = async () => ({ version: 1, tables: {} });
export const restoreLocalDbSnapshot = noop;

export const upsertProducts = identityList;
export const searchProducts = emptyArray;
export const saveOrder = passthrough;
export const getOrderById = nullValue;
export const getOrdersByStatus = emptyArray;
export const updateOrdersBulk = identityList;
export const replaceOrderItems = identityList;
export const getOrderItems = emptyArray;

export const upsertOrders = identityList;
export const replaceAllOrders = identityList;
export const getCachedOrderById = nullValue;
export const getCachedOrderItems = emptyArray;
export const replaceCachedOrderItems = identityList;
export const getCachedOrdersByType = emptyArray;
export const replaceCachedOrdersByType = identityList;
export const clearCachedOrdersByType = noop;
export const getCachedOrderTransactions = emptyArray;
export const upsertOrderDetailsCache = passthrough;
export const getCachedOrderDetails = nullValue;
export const getCachedOrdersPage = async () => ({ list: [], pagination: {} });
export const getAllCachedOrders = emptyArray;
export const getCachedOrdersByCustomer = emptyArray;
export const clearOrdersCache = noop;
export const deleteOrdersByIds = noop;
export const getAllOrderRecords = emptyArray;
export const getOrderRecordById = nullValue;
export const getOrderItemsByOrderId = emptyArray;
export const getSalesOrderRecords = emptyArray;
export const getPurchaseOrderRecords = emptyArray;
export const bulkPutSalesOrders = identityList;
export const bulkPutPurchaseOrders = identityList;
export const clearSalesOrders = noop;
export const clearPurchaseOrders = noop;
export const getSalesAndPurchaseOrderCounts = async () => [[], []];

export default db;
