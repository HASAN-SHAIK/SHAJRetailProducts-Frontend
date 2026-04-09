import Dexie from 'dexie';

const DB_NAME = 'shajretaildb';

const db = new Dexie(DB_NAME);

db.version(1).stores({
  products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted',
  batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted',
  suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted',
  offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
  offline_purchase_items: '++id, local_purchase_id, product_id',
  offline_purchase_returns: 'local_id, status, branch_id, created_at',
  offline_orders: 'id',
  orders: 'id, created_at',
  order_items: '++id, order_id',
  transactions: 'id, order_id, created_at',
  customers: 'id, name, mobile',
  sync_queue: '++id, status, order_id',
  session: 'key',
  config: 'key'
});

db.version(2)
  .stores({
    products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted, sync_status',
    batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted',
    suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted, sync_status',
    offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
    offline_purchase_items: '++id, local_purchase_id, product_id',
    offline_purchase_returns: 'local_id, status, branch_id, created_at',
    offline_orders: 'id',
    orders: 'id, created_at',
    order_items: '++id, order_id',
    transactions: 'id, order_id, created_at',
    customers: 'id, name, mobile',
    sync_queue: '++id, status, order_id, type, entityId, action, updated_at',
    session: 'key',
    config: 'key',
    products: 'id, name, updatedAt, syncStatus',
    suppliers: 'id, name, phone, syncStatus',
    purchases: 'id, supplierId, date, syncStatus, createdAt',
    purchase_items: 'id, purchaseId, productId',
    purchase_returns: 'id, purchaseId, date, syncStatus',
    sync_logs: '++id, type, entityId, status, createdAt'
  })
  .upgrade(async (tx) => {
    const statusMap = {
      PENDING_SYNC: 'pending',
      SYNCED: 'synced',
      FAILED: 'failed',
    };
    try {
      const offlinePurchases = await tx.table('offline_purchases').toArray();
      const offlineItems = await tx.table('offline_purchase_items').toArray();
      const offlineReturns = await tx.table('offline_purchase_returns').toArray();
      const purchasesTable = tx.table('purchases');
      const itemsTable = tx.table('purchase_items');
      const returnsTable = tx.table('purchase_returns');

      if (offlinePurchases.length) {
        const mapped = offlinePurchases.map((entry) => ({
          id: entry.local_id,
          supplierId: entry.supplier_id ?? null,
          date: entry.created_at ?? null,
          createdAt: entry.created_at ?? null,
          branchId: entry.branch_id ?? null,
          invoiceNumber: entry.invoice_number ?? null,
          paymentMode: entry.payment_mode ?? null,
          totalPrice: entry.total_price ?? null,
          serverId: entry.server_id ?? null,
          syncStatus: statusMap[entry.status] || 'pending',
          sync_status: statusMap[entry.status] || 'pending',
        }));
        await purchasesTable.bulkPut(mapped);
      }

      if (offlineItems.length) {
        const mappedItems = offlineItems.map((item) => ({
          id: item.id ?? `item_${item.local_purchase_id}_${Math.random().toString(36).slice(2, 8)}`,
          purchaseId: item.local_purchase_id,
          productId: item.product_id ?? null,
          name: item.name ?? null,
          barcode: item.barcode ?? null,
          category: item.category ?? null,
          company: item.company ?? null,
          mrp: item.mrp ?? null,
          quantity: item.quantity ?? 0,
          purchase_price: item.purchase_price ?? 0,
          selling_price: item.selling_price ?? null,
          gst_percent: item.gst_percent ?? null,
          expiry_date: item.expiry_date ?? null,
          __local_product: item.__local_product ?? false,
        }));
        await itemsTable.bulkPut(mappedItems);
      }

      if (offlineReturns.length) {
        const mappedReturns = offlineReturns.map((entry) => ({
          id: entry.local_id,
          purchaseId: entry.purchase_id ?? null,
          date: entry.created_at ?? null,
          createdAt: entry.created_at ?? null,
          branchId: entry.branch_id ?? null,
          supplierId: entry.supplier_id ?? null,
          reason: entry.reason ?? null,
          items: entry.items ?? [],
          serverId: entry.server_id ?? null,
          syncStatus: statusMap[entry.status] || 'pending',
          sync_status: statusMap[entry.status] || 'pending',
        }));
        await returnsTable.bulkPut(mappedReturns);
      }
    } catch {
      // ignore migration errors
    }
  });

db.version(3).stores({
  products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted, sync_status',
  batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted',
  suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted, sync_status',
  offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
  offline_purchase_items: '++id, local_purchase_id, product_id',
  offline_purchase_returns: 'local_id, status, branch_id, created_at',
  offline_orders: 'id',
  orders: 'id, created_at',
  order_items: '++id, order_id',
  transactions: 'id, order_id, created_at, txn_type, party_type, party_id, direction, payment_mode',
  customers: 'id, name, mobile',
  sync_queue: '++id, status, order_id, type, entityId, action, updated_at',
  session: 'key',
  config: 'key',
  products: 'id, name, updatedAt, syncStatus',
  suppliers: 'id, name, phone, syncStatus',
  purchases: 'id, supplierId, date, syncStatus, createdAt',
  purchase_items: 'id, purchaseId, productId',
  purchase_returns: 'id, purchaseId, date, syncStatus',
  sync_logs: '++id, type, entityId, status, createdAt'
});

db.version(4).stores({
  products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted, sync_status',
  batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted',
  suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted, sync_status',
  offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
  offline_purchase_items: '++id, local_purchase_id, product_id',
  offline_purchase_returns: 'local_id, status, branch_id, created_at',
  offline_orders: 'id',
  orders: 'id, created_at',
  order_items: '++id, order_id',
  transactions: 'id, order_id, created_at, txn_type, party_type, party_id, direction, payment_mode',
  customers: 'id, name, mobile',
  sync_queue: '++id, status, order_id, type, entityId, action, updated_at',
  session: 'key',
  config: 'key',
  products: 'id, name, updatedAt, syncStatus',
  suppliers: 'id, name, phone, syncStatus',
  purchases: 'id, supplierId, date, syncStatus, createdAt',
  purchase_items: 'id, purchaseId, productId',
  purchase_returns: 'id, purchaseId, date, syncStatus',
  sync_logs: '++id, type, entityId, status, createdAt',
  staff: 'staffId, name, phone, role, status, isSynced, updatedAt',
  salaries: 'salaryId, staffId, month, paymentStatus, isSynced, updatedAt',
  expenses: 'expenseId, type, category, date, staffId, isSynced, updatedAt'
});

db.version(5).stores({
  products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted, sync_status',
  batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted',
  suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted, sync_status',
  offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
  offline_purchase_items: '++id, local_purchase_id, product_id',
  offline_purchase_returns: 'local_id, status, branch_id, created_at',
  offline_orders: 'id',
  orders: 'id, created_at',
  order_items: '++id, order_id',
  transactions: 'id, order_id, created_at, txn_type, party_type, party_id, direction, payment_mode',
  customers: 'id, name, mobile',
  sync_queue: '++id, status, order_id, type, entityId, action, updated_at',
  session: 'key',
  config: 'key',
  products: 'id, name, updatedAt, syncStatus',
  suppliers: 'id, name, phone, syncStatus',
  purchases: 'id, supplierId, date, syncStatus, createdAt',
  purchase_items: 'id, purchaseId, productId',
  purchase_returns: 'id, purchaseId, date, syncStatus',
  sync_logs: '++id, type, entityId, status, createdAt',
  staff: 'staffId, name, phone, role, status, isSynced, updatedAt',
  salaries: 'salaryId, staffId, month, paymentStatus, isSynced, updatedAt',
  expenses: 'expenseId, type, category, date, staffId, isSynced, updatedAt',
  sales_returns: 'returnId, originalBillId, date, isSynced, updatedAt',
  corrections: 'correctionId, billId, type, createdAt, isSynced',
  gst_ledger: 'gstEntryId, billId, type, date, isSynced',
  eway_bills: 'ewayId, billId, status, isSynced, updatedAt'
});

db.version(6).stores({
  products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted, sync_status',
  batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted',
  suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted, sync_status',
  offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
  offline_purchase_items: '++id, local_purchase_id, product_id',
  offline_purchase_returns: 'local_id, status, branch_id, created_at',
  offline_orders: 'id',
  orders: 'id, created_at',
  order_items: '++id, order_id',
  transactions: 'id, order_id, created_at, txn_type, party_type, party_id, direction, payment_mode',
  customers: 'id, name, mobile',
  sync_queue: '++id, status, order_id, type, entityId, action, refId, updated_at',
  session: 'key',
  config: 'key',
  products: 'id, name, updatedAt, syncStatus',
  suppliers: 'id, name, phone, syncStatus',
  purchases: 'id, supplierId, date, syncStatus, createdAt',
  purchase_items: 'id, purchaseId, productId',
  purchase_returns: 'id, purchaseId, date, syncStatus',
  sync_logs: '++id, type, entityId, status, createdAt',
  staff: 'staffId, name, phone, role, status, isSynced, updatedAt',
  salaries: 'salaryId, staffId, month, paymentStatus, isSynced, updatedAt',
  expenses: 'expenseId, type, category, date, staffId, isSynced, updatedAt',
  sales_returns: 'returnId, originalBillId, date, isSynced, updatedAt',
  corrections: 'correctionId, billId, type, createdAt, isSynced',
  gst_ledger: 'gstEntryId, billId, type, date, isSynced',
  eway_bills: 'ewayId, billId, status, isSynced, updatedAt',
  offline_imports: 'id, createdAt, status',
  offline_import_items: 'id, importId, productId',
  offline_stock_batches: 'id, productId, batchNo, expiryDate',
  product_id_map: 'tempId, realId, createdAt'
});

const normalizeProduct = (product) => {
  if (!product) return null;
  const rawBarcode =
    product.barcode ??
    product.barcode_number ??
    product.barcodeNumber ??
    product.product_barcode ??
    product.productBarcode ??
    product.code ??
    product.product_code ??
    product.productCode ??
    null;
  const idValue = product.id ?? product.product_id ?? product.productId ?? null;
  const resolvedBarcode = rawBarcode || (idValue ? `id:${idValue}` : null);
  const resolvedId = idValue ?? resolvedBarcode;
  if (!resolvedId) return null;
  return {
    id: resolvedId,
    name: product.name ?? product.product_name,
    name_lower: String(product.name ?? product.product_name ?? '').toLowerCase(),
    company: product.company ?? product.company_name,
    category: product.category ?? product.category_name,
    barcode: resolvedBarcode,
    selling_price: product.selling_price ?? null,
    purchase_price: product.purchase_price ?? null,
    mrp: product.mrp ?? product.mrp_price ?? null,
    hsn_code: product.hsn_code ?? null,
    gst_percentage: product.gst_percentage ?? null,
    is_batch_enabled: product.is_batch_enabled ?? null,
    expiry_date: product.expiry_date ?? product.expiryDate ?? null,
    stock_quantity:
      product.stock_quantity ??
      product.stockQuantity ??
      product.stock ??
      product.quantity ??
      null,
    branch_id: product.branch_id ?? product.branchId ?? null,
    is_weight_based: product.is_weight_based ?? null,
    time_for_delivery: product.time_for_delivery ?? null,
    created_at: product.created_at ?? null,
    updated_at: product.updated_at ?? product.updatedAt ?? product.created_at ?? null,
    is_deleted: product.is_deleted ?? false,
    sync_status: product.sync_status ?? product.syncStatus ?? null,
  };
};

const normalizeBatch = (batch) => {
  if (!batch) return null;
  const id = batch.id ?? batch.batch_id ?? null;
  if (!id) return null;
  return {
    id,
    product_id: batch.product_id ?? batch.productId ?? null,
    branch_id: batch.branch_id ?? batch.branchId ?? null,
    batch_number: batch.batch_number ?? batch.batchNumber ?? null,
    expiry_date: batch.expiry_date ?? batch.expiryDate ?? null,
    purchase_price: batch.purchase_price ?? batch.purchasePrice ?? null,
    selling_price: batch.selling_price ?? batch.sellingPrice ?? null,
    quantity: batch.quantity ?? 0,
    quantity_remaining: batch.quantity_remaining ?? batch.quantityRemaining ?? batch.quantity ?? 0,
    created_at: batch.created_at ?? batch.createdAt ?? null,
    updated_at: batch.updated_at ?? batch.updatedAt ?? batch.created_at ?? null,
    is_deleted: batch.is_deleted ?? false,
  };
};

const normalizeCustomer = (customer) => {
  if (!customer) return null;
  const id = customer.id ?? customer.customer_id ?? null;
  const mobile = customer.mobile ?? customer.phone ?? null;
  if (!id && !mobile) return null;
  const resolvedAddress =
    customer.address ??
    [customer.address_line1 ?? customer.addressLine1, customer.address_line2 ?? customer.addressLine2]
      .filter(Boolean)
      .join(', ') ??
    null;
  const resolvedLocation = customer.location ?? customer.customer_location ?? customer.city ?? null;
  return {
    id: id ?? null,
    name: customer.name ?? customer.customer_name ?? '',
    mobile,
    phone: customer.phone ?? customer.mobile ?? null,
    type: customer.type ?? customer.customer_type ?? 'retail',
    email: customer.email ?? null,
    shop_name: customer.shop_name ?? customer.shopName ?? null,
    gst_number: customer.gst_number ?? customer.gstNumber ?? null,
    credit_limit: customer.credit_limit ?? customer.creditLimit ?? 0,
    current_balance: customer.current_balance ?? customer.currentBalance ?? 0,
    address: resolvedAddress ?? customer.customer_address ?? null,
    location: resolvedLocation,
    updated_at: customer.updated_at ?? customer.updatedAt ?? null,
    is_active: customer.is_active ?? customer.isActive ?? true,
  };
};

const normalizeSupplier = (supplier) => {
  if (!supplier) return null;
  const id = supplier.id ?? supplier.supplier_id ?? null;
  if (!id) return null;
  return {
    id,
    name: supplier.name ?? supplier.supplier_name ?? '',
    name_lower: String(supplier.name ?? supplier.supplier_name ?? '').toLowerCase(),
    mobile: supplier.mobile ?? supplier.phone ?? null,
    email: supplier.email ?? null,
    address: supplier.address ?? null,
    gst_number: supplier.gst_number ?? null,
    credit_limit: supplier.credit_limit ?? 0,
    current_balance: supplier.current_balance ?? 0,
    branch_id: supplier.branch_id ?? supplier.branchId ?? null,
    is_active: supplier.is_active ?? true,
    updated_at: supplier.updated_at ?? supplier.updatedAt ?? null,
    created_at: supplier.created_at ?? supplier.createdAt ?? null,
    is_deleted: supplier.is_deleted ?? false,
    sync_status: supplier.sync_status ?? supplier.syncStatus ?? null,
  };
};

const normalizeTransaction = (transaction) => {
  if (!transaction) return null;
  const id =
    transaction.id ||
    transaction.transaction_id ||
    transaction.client_payment_id ||
    transaction.clientPaymentId;
  if (!id) return null;
  return {
    id,
    order_id: transaction.order_id ?? transaction.orderId ?? null,
    client_order_id: transaction.client_order_id ?? transaction.clientOrderId ?? null,
    total_price: transaction.total_price ?? transaction.amount_paid ?? transaction.amount ?? null,
    amount: transaction.amount ?? transaction.total_price ?? transaction.amount_paid ?? transaction.amount ?? null,
    profit: transaction.profit ?? null,
    payment_mode: transaction.payment_mode ?? transaction.paymentMethod ?? transaction.payment_method ?? null,
    txn_type: transaction.txn_type ?? transaction.txnType ?? null,
    direction: transaction.direction ?? null,
    party_type: transaction.party_type ?? transaction.partyType ?? null,
    party_id: transaction.party_id ?? transaction.partyId ?? null,
    notes: transaction.notes ?? null,
    sync_status: transaction.sync_status ?? transaction.syncStatus ?? null,
    created_at: transaction.created_at ?? transaction.createdAt ?? new Date().toISOString(),
    status: transaction.status ?? null,
  };
};

const normalizeSessionKey = (key) => String(key || '').trim();

export const initDB = async () => {
  await db.open();
  return db;
};

export const saveProductsBulk = async (products) => {
  const list = Array.isArray(products) ? products : [];
  const normalized = list.map((product) => normalizeProduct(product)).filter(Boolean);
  if (!normalized.length) return 0;
  await db.products_cache.bulkPut(normalized);
  return normalized.length;
};

export const getAllCustomers = async () => {
  return await db.customers.toArray();
};

export const upsertCustomerLocal = async (customer) => {
  if (!customer) return null;
  const normalized = normalizeCustomer(customer);
  if (!normalized?.id) return null;
  await db.customers.put(normalized);
  return normalized;
};

export const getCustomerById = async (customerId) => {
  if (customerId === null || customerId === undefined) return null;
  const numeric = Number(customerId);
  const key = Number.isFinite(numeric) ? numeric : customerId;
  return await db.customers.get(key);
};

export const saveCustomersBulk = async (customers) => {
  const list = Array.isArray(customers) ? customers : [];
  const normalized = list.map((customer) => normalizeCustomer(customer)).filter(Boolean);
  if (!normalized.length) return 0;
  await db.customers.clear();
  await db.customers.bulkPut(normalized);
  return normalized.length;
};

export const upsertCustomersBulk = async (customers) => {
  const list = Array.isArray(customers) ? customers : [];
  const normalized = list.map((customer) => normalizeCustomer(customer)).filter(Boolean);
  if (!normalized.length) return 0;
  await db.customers.bulkPut(normalized);
  return normalized.length;
};

export const saveBatchesBulk = async (batches) => {
  const list = Array.isArray(batches) ? batches : [];
  const normalized = list.map((batch) => normalizeBatch(batch)).filter(Boolean);
  if (!normalized.length) return 0;
  await db.batches_cache.clear();
  await db.batches_cache.bulkPut(normalized);
  return normalized.length;
};

export const updateBatchesBulk = async (batches) => {
  const list = Array.isArray(batches) ? batches : [];
  const normalized = list.map((batch) => normalizeBatch(batch)).filter(Boolean);
  if (!normalized.length) return 0;
  await db.batches_cache.bulkPut(normalized);
  return normalized.length;
};

export const getAllBatches = async () => {
  return await db.batches_cache.toArray();
};

export const getAllBatchesCache = async () => {
  return await db.batches_cache.toArray();
};

export const getBatchCacheById = async (batchId) => {
  if (!batchId) return null;
  return await db.batches_cache.get(batchId);
};

export const getLatestBatchForProduct = async (productId, branchId = null) => {
  if (!productId) return null;
  const list = await db.batches_cache
    .where('product_id')
    .equals(productId)
    .toArray();
  const filtered = list.filter((batch) => {
    if (branchId && batch.branch_id && batch.branch_id !== branchId) return false;
    if (batch.is_deleted) return false;
    return true;
  });
  if (!filtered.length) return null;
  filtered.sort((a, b) => {
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return bTime - aTime;
  });
  return filtered[0] || null;
};

export const getProductByBarcode = async (barcode) => {
  const code = String(barcode || '').trim();
  if (!code) return null;
  return await db.products_cache.where('barcode').equals(code).first();
};

export const updateProduct = async (product) => {
  const normalized = normalizeProduct(product);
  if (!normalized) throw new Error('Missing product identifier');
  await db.products_cache.put(normalized);
};

export const getAllProducts = async () => {
  return await db.products_cache.toArray();
};

export const updateProductsBulk = async (products) => {
  const list = Array.isArray(products) ? products : [];
  const normalized = list.map((product) => normalizeProduct(product)).filter(Boolean);
  if (!normalized.length) return 0;
  await db.products_cache.bulkPut(normalized);
  return normalized.length;
};

export const getAllProductsCache = async () => {
  return await db.products_cache.toArray();
};

export const getProductCacheByBarcode = async (barcode) => {
  const code = String(barcode || '').trim();
  if (!code) return null;
  return await db.products_cache.where('barcode').equals(code).first();
};

export const getProductCacheById = async (productId) => {
  if (!productId) return null;
  return await db.products_cache.get(productId);
};

export const updateProductsCacheBulk = async (products) => {
  return await updateProductsBulk(products);
};

export const updateSuppliersCacheBulk = async (suppliers) => {
  const list = Array.isArray(suppliers) ? suppliers : [];
  const normalized = list.map((supplier) => normalizeSupplier(supplier)).filter(Boolean);
  if (!normalized.length) return 0;
  await db.suppliers_cache.bulkPut(normalized);
  return normalized.length;
};

export const getAllSuppliersCache = async () => {
  return await db.suppliers_cache.toArray();
};

export const getSupplierCacheById = async (supplierId) => {
  if (!supplierId) return null;
  return await db.suppliers_cache.get(supplierId);
};

export const deleteProductsCacheByIds = async (ids = []) => {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return 0;
  await db.products_cache.bulkDelete(list);
  return list.length;
};

export const deleteBatchesCacheByIds = async (ids = []) => {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return 0;
  await db.batches_cache.bulkDelete(list);
  return list.length;
};

export const deleteSuppliersCacheByIds = async (ids = []) => {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return 0;
  await db.suppliers_cache.bulkDelete(list);
  return list.length;
};

export const saveTransactionsBulk = async (transactions) => {
  const list = Array.isArray(transactions) ? transactions : [];
  const normalized = list.map((item) => normalizeTransaction(item)).filter(Boolean);
  if (!normalized.length) return 0;
  await db.transactions.bulkPut(normalized);
  return normalized.length;
};

export const upsertTransaction = async (transaction) => {
  const normalized = normalizeTransaction(transaction);
  if (!normalized) throw new Error('Missing id in transaction payload');
  await db.transactions.put(normalized);
};

export const getTransactions = async () => {
  return await db.transactions.toArray();
};

export const getTransactionById = async (transactionId) => {
  if (!transactionId) return null;
  return await db.transactions.get(transactionId);
};

export const upsertAccountingTransaction = async (transaction) => {
  if (!transaction || !transaction.id) return;
  await db.transactions.put(transaction);
};

export const getAccountingTransactions = async (filters = {}) => {
  const list = await db.transactions.toArray();
  const {
    partyType,
    partyId,
    paymentModes,
    startDate,
    endDate,
  } = filters;
  return list.filter((item) => {
    if (partyType && String(item.party_type || item.partyType || '') !== String(partyType)) return false;
    if (partyId && String(item.party_id || item.partyId || '') !== String(partyId)) return false;
    if (paymentModes && paymentModes.length) {
      const mode = String(item.payment_mode || '').toLowerCase();
      if (!paymentModes.map((m) => String(m).toLowerCase()).includes(mode)) return false;
    }
    if (startDate) {
      const created = new Date(item.created_at || item.createdAt || 0);
      if (created < new Date(startDate)) return false;
    }
    if (endDate) {
      const created = new Date(item.created_at || item.createdAt || 0);
      if (created > new Date(endDate)) return false;
    }
    return true;
  });
};

export const saveSessionValue = async (key, value) => {
  const normalized = normalizeSessionKey(key);
  if (!normalized) return;
  await db.session.put({ key: normalized, value, updatedAt: new Date().toISOString() });
};

export const getSessionValue = async (key) => {
  const normalized = normalizeSessionKey(key);
  if (!normalized) return null;
  const result = await db.session.get(normalized);
  return result ? result.value : null;
};

export const clearSessionValue = async (key) => {
  const normalized = normalizeSessionKey(key);
  if (!normalized) return;
  await db.session.delete(normalized);
};

export const clearSessionStore = async () => {
  await db.session.clear();
};

export const getOfflineOrders = async () => {
  return await db.offline_orders.toArray();
};

export const saveOfflineOrdersBulk = async (orders) => {
  const list = Array.isArray(orders) ? orders : [];
  await db.offline_orders.clear();
  if (list.length) {
    await db.offline_orders.bulkPut(list);
  }
  return list.length;
};

export const upsertOfflineOrder = async (entry) => {
  if (!entry || !entry.id) return;
  await db.offline_orders.put(entry);
};

export const deleteOfflineOrdersByIds = async (ids) => {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return;
  await db.offline_orders.bulkDelete(list);
};

export const saveConfigValue = async (key, value) => {
  const normalized = normalizeSessionKey(key);
  if (!normalized) return;
  await db.config.put({ key: normalized, value, updatedAt: new Date().toISOString() });
};

export const getConfigValue = async (key) => {
  const normalized = normalizeSessionKey(key);
  if (!normalized) return null;
  const result = await db.config.get(normalized);
  return result ? result.value : null;
};

const normalizeSyncStatus = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'pending' || normalized === 'synced' || normalized === 'failed') {
    return normalized;
  }
  return 'pending';
};

export const upsertLocalProduct = async (product) => {
  if (!product || !product.id) return;
  await db.products.put(product);
};

export const getLocalProducts = async (status = null) => {
  const all = await db.products.toArray();
  if (!status) return all;
  const normalized = normalizeSyncStatus(status);
  return all.filter((item) => normalizeSyncStatus(item.syncStatus || item.sync_status) === normalized);
};

export const upsertLocalSupplier = async (supplier) => {
  if (!supplier || !supplier.id) return;
  await db.suppliers.put(supplier);
};

export const getLocalSuppliers = async (status = null) => {
  const all = await db.suppliers.toArray();
  if (!status) return all;
  const normalized = normalizeSyncStatus(status);
  return all.filter((item) => normalizeSyncStatus(item.syncStatus || item.sync_status) === normalized);
};

export const upsertLocalPurchase = async (purchase) => {
  if (!purchase || !purchase.id) return;
  await db.purchases.put(purchase);
};

export const upsertLocalPurchasesBulk = async (purchases = []) => {
  const list = Array.isArray(purchases) ? purchases.filter((item) => item && item.id) : [];
  if (!list.length) return 0;
  await db.purchases.bulkPut(list);
  return list.length;
};

export const getLocalPurchases = async (status = null) => {
  const all = await db.purchases.toArray();
  if (!status) return all;
  const normalized = normalizeSyncStatus(status);
  return all.filter((item) => normalizeSyncStatus(item.syncStatus || item.sync_status) === normalized);
};

export const getLocalPurchaseById = async (purchaseId) => {
  if (!purchaseId) return null;
  return await db.purchases.get(purchaseId);
};

export const addLocalPurchaseItems = async (items = []) => {
  const list = Array.isArray(items) ? items.filter((item) => item && item.id) : [];
  if (!list.length) return 0;
  await db.purchase_items.bulkPut(list);
  return list.length;
};

export const getLocalPurchaseItems = async (purchaseId) => {
  if (!purchaseId) return [];
  return await db.purchase_items.where('purchaseId').equals(purchaseId).toArray();
};

export const upsertLocalPurchaseReturn = async (entry) => {
  if (!entry || !entry.id) return;
  await db.purchase_returns.put(entry);
};

export const getLocalPurchaseReturns = async (status = null) => {
  const all = await db.purchase_returns.toArray();
  if (!status) return all;
  const normalized = normalizeSyncStatus(status);
  return all.filter((item) => normalizeSyncStatus(item.syncStatus || item.sync_status) === normalized);
};

export const getLocalPurchaseReturnById = async (returnId) => {
  if (!returnId) return null;
  return await db.purchase_returns.get(returnId);
};

export const addInventorySyncQueueEntry = async (entry) => {
  if (!entry) return null;
  const payload = {
    ...entry,
    status: normalizeSyncStatus(entry.status || 'pending'),
    createdAt: entry.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const id = await db.sync_queue.add(payload);
  return { ...payload, id };
};

export const updateInventorySyncQueueEntry = async (entry) => {
  if (!entry || !entry.id) return null;
  const payload = { ...entry, updated_at: new Date().toISOString() };
  await db.sync_queue.put(payload);
  return payload;
};

export const getInventorySyncQueueEntries = async (statuses = ['pending', 'failed']) => {
  const list = await db.sync_queue.toArray();
  const normalizedStatuses = statuses.map(normalizeSyncStatus);
  return list.filter((entry) => entry?.type && normalizedStatuses.includes(normalizeSyncStatus(entry.status)));
};

export const findInventorySyncQueueEntry = async (type, entityId, action) => {
  if (!type || !entityId || !action) return null;
  const entries = await getInventorySyncQueueEntries(['pending', 'failed']);
  return (
    entries.find(
      (entry) =>
        entry.type === type &&
        String(entry.entityId) === String(entityId) &&
        entry.action === action
    ) || null
  );
};

export const addSyncLog = async ({ type, entityId, status, message }) => {
  if (!type) return;
  await db.sync_logs.add({
    type,
    entityId: entityId ?? null,
    status: normalizeSyncStatus(status),
    message: message || null,
    createdAt: new Date().toISOString(),
  });
};

export const replaceProductIdReferences = async (oldId, newId) => {
  if (!oldId || !newId || oldId === newId) return;
  const existing = await db.products_cache.get(oldId);
  if (existing) {
    await db.products_cache.delete(oldId);
    const nextBarcode = existing.barcode && String(existing.barcode).startsWith('id:') ? `id:${newId}` : existing.barcode;
    await db.products_cache.put({ ...existing, id: newId, barcode: nextBarcode });
  }
  const batches = await db.batches_cache.where('product_id').equals(oldId).toArray();
  if (batches.length) {
    await db.batches_cache.bulkPut(batches.map((batch) => ({ ...batch, product_id: newId })));
  }
  const offlineBatches = await db.offline_stock_batches.where('productId').equals(oldId).toArray();
  if (offlineBatches.length) {
    await db.offline_stock_batches.bulkPut(
      offlineBatches.map((batch) => ({ ...batch, productId: newId }))
    );
  }
  const items = await db.purchase_items.where('productId').equals(oldId).toArray();
  if (items.length) {
    await db.purchase_items.bulkPut(items.map((item) => ({ ...item, productId: newId })));
  }
  const importItems = await db.offline_import_items.where('productId').equals(oldId).toArray();
  if (importItems.length) {
    await db.offline_import_items.bulkPut(
      importItems.map((item) => ({ ...item, productId: newId }))
    );
  }
};

export const replaceSupplierIdReferences = async (oldId, newId) => {
  if (!oldId || !newId || oldId === newId) return;
  const existing = await db.suppliers_cache.get(oldId);
  if (existing) {
    await db.suppliers_cache.delete(oldId);
    await db.suppliers_cache.put({ ...existing, id: newId });
  }
  const purchases = await db.purchases.where('supplierId').equals(oldId).toArray();
  if (purchases.length) {
    await db.purchases.bulkPut(purchases.map((purchase) => ({ ...purchase, supplierId: newId })));
  }
};

export const upsertOfflinePurchase = async (purchase) => {
  if (!purchase || !purchase.local_id) return;
  await db.offline_purchases.put(purchase);
};

export const addOfflinePurchaseItems = async (items = []) => {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return 0;
  await db.offline_purchase_items.bulkPut(list);
  return list.length;
};

export const getOfflinePurchases = async (status = null) => {
  const all = await db.offline_purchases.toArray();
  if (!status) return all;
  return all.filter((entry) => entry.status === status);
};

export const getOfflinePurchaseItems = async (localPurchaseId) => {
  if (!localPurchaseId) return [];
  return await db.offline_purchase_items.where('local_purchase_id').equals(localPurchaseId).toArray();
};

export const updateProductsCacheStock = async (productId, delta, branchId = null) => {
  if (!productId || !Number.isFinite(Number(delta))) return;
  const numericDelta = Number(delta);
  const existing = await db.products_cache.get(productId);
  const current = existing?.stock_quantity ?? 0;
  const next = Math.max(0, Number(current) + numericDelta);
  const updated = existing
    ? { ...existing, stock_quantity: next, branch_id: existing.branch_id ?? branchId ?? null }
    : { id: productId, stock_quantity: next, branch_id: branchId ?? null };
  await db.products_cache.put(updated);
};

export const addLocalBatchCache = async (batch) => {
  if (!batch || !batch.id) return;
  const normalized = normalizeBatch(batch);
  if (!normalized) return;
  await db.batches_cache.put(normalized);
};

export const upsertOfflinePurchaseReturn = async (returnEntry) => {
  if (!returnEntry || !returnEntry.local_id) return;
  await db.offline_purchase_returns.put(returnEntry);
};

export const addOfflineImport = async ({ importEntry, items = [], batches = [] } = {}) => {
  if (!importEntry?.id) return null;
  await db.transaction('rw', db.offline_imports, db.offline_import_items, db.offline_stock_batches, async () => {
    await db.offline_imports.put(importEntry);
    if (items.length) {
      await db.offline_import_items.bulkPut(items);
    }
    if (batches.length) {
      await db.offline_stock_batches.bulkPut(batches);
    }
  });
  return importEntry;
};

export const getOfflineImports = async () => {
  return await db.offline_imports.toArray();
};

export const getOfflineImportItems = async (importId) => {
  if (!importId) return [];
  return await db.offline_import_items.where('importId').equals(importId).toArray();
};

export const updateOfflineImport = async (entry) => {
  if (!entry?.id) return null;
  await db.offline_imports.put(entry);
  return entry;
};

export const updateOfflineImportStatus = async (importId, status) => {
  if (!importId) return null;
  const existing = await db.offline_imports.get(importId);
  if (!existing) return null;
  const updated = { ...existing, status, updatedAt: new Date().toISOString() };
  await db.offline_imports.put(updated);
  return updated;
};

export const addSyncQueueItem = async (entry) => {
  if (!entry) return null;
  const payload = {
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...entry,
  };
  const id = await db.sync_queue.add(payload);
  return { ...payload, id };
};

export const updateSyncQueueItem = async (entry) => {
  if (!entry?.id) return null;
  const payload = { ...entry, updated_at: new Date().toISOString() };
  await db.sync_queue.put(payload);
  return payload;
};

export const getSyncQueueItems = async (filters = {}) => {
  const list = await db.sync_queue.toArray();
  const { type, status } = filters;
  return list.filter((entry) => {
    if (type && entry.type !== type) return false;
    if (status && entry.status !== status) return false;
    return true;
  });
};

export const addProductIdMapping = async ({ tempId, realId }) => {
  if (!tempId || !realId) return null;
  const payload = {
    tempId,
    realId,
    createdAt: new Date().toISOString(),
  };
  await db.product_id_map.put(payload);
  return payload;
};

export const getProductIdMappings = async () => {
  return await db.product_id_map.toArray();
};

export const replaceCustomerIdReferences = async (oldId, newId) => {
  if (!oldId || !newId || oldId === newId) return;
  const existing = await db.customers.get(oldId);
  if (existing) {
    await db.customers.delete(oldId);
    await db.customers.put({ ...existing, id: newId });
  }
  try {
    const offlineOrders = await db.offline_orders.toArray();
    if (offlineOrders.length) {
      const updated = offlineOrders.map((entry) => {
        const payload = entry?.payload || {};
        const customerId = payload.customer_id ?? payload.customerId ?? null;
        if (String(customerId) !== String(oldId)) return entry;
        return {
          ...entry,
          payload: {
            ...payload,
            customer_id: newId,
          },
        };
      });
      await db.offline_orders.bulkPut(updated);
    }
  } catch {
    // ignore offline order remap errors
  }
};

export const getOfflinePurchaseReturns = async (status = null) => {
  const all = await db.offline_purchase_returns.toArray();
  if (!status) return all;
  return all.filter((entry) => entry.status === status);
};

export const upsertLocalStaff = async (staff) => {
  if (!staff?.staffId) return null;
  await db.staff.put(staff);
  return staff;
};

export const getLocalStaff = async ({ status, search } = {}) => {
  const list = await db.staff.toArray();
  const normalizedSearch = String(search || '').trim().toLowerCase();
  return list.filter((staff) => {
    if (status && String(staff.status || '').toLowerCase() !== String(status).toLowerCase()) {
      return false;
    }
    if (normalizedSearch) {
      const name = String(staff.name || '').toLowerCase();
      const phone = String(staff.phone || '').toLowerCase();
      return name.includes(normalizedSearch) || phone.includes(normalizedSearch);
    }
    return true;
  });
};

export const getLocalStaffById = async (staffId) => {
  if (!staffId) return null;
  return await db.staff.get(staffId);
};

export const deleteLocalStaff = async (staffId) => {
  if (!staffId) return;
  await db.staff.delete(staffId);
};

export const upsertLocalSalary = async (salary) => {
  if (!salary?.salaryId) return null;
  await db.salaries.put(salary);
  return salary;
};

export const getLocalSalaries = async ({ staffId, month } = {}) => {
  const list = await db.salaries.toArray();
  return list.filter((salary) => {
    if (staffId && String(salary.staffId) !== String(staffId)) return false;
    if (month && String(salary.month) !== String(month)) return false;
    return true;
  });
};

export const getLocalSalaryById = async (salaryId) => {
  if (!salaryId) return null;
  return await db.salaries.get(salaryId);
};

export const deleteLocalSalary = async (salaryId) => {
  if (!salaryId) return;
  await db.salaries.delete(salaryId);
};

export const upsertLocalExpense = async (expense) => {
  if (!expense?.expenseId) return null;
  await db.expenses.put(expense);
  return expense;
};

export const getLocalExpenses = async ({ type, staffId, from, to, category } = {}) => {
  const list = await db.expenses.toArray();
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  return list.filter((expense) => {
    if (type && String(expense.type) !== String(type)) return false;
    if (staffId && String(expense.staffId) !== String(staffId)) return false;
    if (category && String(expense.category || '').toLowerCase() !== String(category).toLowerCase()) {
      return false;
    }
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      const expDate = new Date(expense.date);
      if (Number.isNaN(expDate.getTime()) || expDate < fromDate) return false;
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      const expDate = new Date(expense.date);
      if (Number.isNaN(expDate.getTime()) || expDate > toDate) return false;
    }
    return true;
  });
};

export const getLocalExpenseById = async (expenseId) => {
  if (!expenseId) return null;
  return await db.expenses.get(expenseId);
};

export const deleteLocalExpense = async (expenseId) => {
  if (!expenseId) return;
  await db.expenses.delete(expenseId);
};

export const upsertLocalSalesReturn = async (entry) => {
  if (!entry?.returnId) return null;
  await db.sales_returns.put(entry);
  return entry;
};

export const getLocalSalesReturns = async ({ billId } = {}) => {
  const list = await db.sales_returns.toArray();
  if (!billId) return list;
  return list.filter((entry) => String(entry.originalBillId) === String(billId));
};

export const getLocalSalesReturnById = async (returnId) => {
  if (!returnId) return null;
  return await db.sales_returns.get(returnId);
};

export const deleteLocalSalesReturn = async (returnId) => {
  if (!returnId) return;
  await db.sales_returns.delete(returnId);
};

export const upsertLocalCorrection = async (entry) => {
  if (!entry?.correctionId) return null;
  await db.corrections.put(entry);
  return entry;
};

export const getLocalCorrections = async ({ billId } = {}) => {
  const list = await db.corrections.toArray();
  if (!billId) return list;
  return list.filter((entry) => String(entry.billId) === String(billId));
};

export const getLocalCorrectionById = async (correctionId) => {
  if (!correctionId) return null;
  return await db.corrections.get(correctionId);
};

export const deleteLocalCorrection = async (correctionId) => {
  if (!correctionId) return;
  await db.corrections.delete(correctionId);
};

export const upsertLocalGstEntry = async (entry) => {
  if (!entry?.gstEntryId) return null;
  await db.gst_ledger.put(entry);
  return entry;
};

export const getLocalGstEntries = async ({ billId, type, from, to } = {}) => {
  const list = await db.gst_ledger.toArray();
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  return list.filter((entry) => {
    if (billId && String(entry.billId) !== String(billId)) return false;
    if (type && String(entry.type) !== String(type)) return false;
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      const date = new Date(entry.date);
      if (Number.isNaN(date.getTime()) || date < fromDate) return false;
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      const date = new Date(entry.date);
      if (Number.isNaN(date.getTime()) || date > toDate) return false;
    }
    return true;
  });
};

export const upsertLocalEwayBill = async (entry) => {
  if (!entry?.ewayId) return null;
  await db.eway_bills.put(entry);
  return entry;
};

export const getLocalEwayBills = async ({ billId, status } = {}) => {
  const list = await db.eway_bills.toArray();
  return list.filter((entry) => {
    if (billId && String(entry.billId) !== String(billId)) return false;
    if (status && String(entry.status) !== String(status)) return false;
    return true;
  });
};

export const deleteLocalEwayBill = async (ewayId) => {
  if (!ewayId) return;
  await db.eway_bills.delete(ewayId);
};

export { db };
export default db;
