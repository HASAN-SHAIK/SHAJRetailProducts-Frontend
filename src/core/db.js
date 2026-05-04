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

db.version(7).stores({
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
  supplier_ledger: 'id, supplier_id, created_at, type',
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
}).upgrade(async (tx) => {
  try {
    const rows = await tx.table('supplier_ledger').toArray();
    if (!rows.length) return;
    const normalized = rows.map((entry) => ({
      ...entry,
      supplier_id: String(entry.supplier_id || ''),
    }));
    await tx.table('supplier_ledger').bulkPut(normalized);
  } catch {
    // ignore migration errors
  }
});

db.version(8).stores({
  products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted, sync_status',
  batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted, quantity_remaining, sync_version',
  suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted, sync_status',
  offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
  offline_purchase_items: '++id, local_purchase_id, product_id',
  offline_purchase_returns: 'local_id, status, branch_id, created_at',
  offline_orders: 'id',
  orders: 'id, created_at',
  order_items: '++id, order_id',
  transactions: 'id, order_id, created_at, txn_type, party_type, party_id, direction, payment_mode',
  supplier_ledger: 'id, supplier_id, created_at, type',
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

db.version(9).stores({
  products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted, sync_status',
  batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted, quantity_remaining, sync_version',
  suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted, sync_status',
  offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
  offline_purchase_items: '++id, local_purchase_id, product_id',
  offline_purchase_returns: 'local_id, status, branch_id, created_at',
  offline_orders: 'id',
  orders: 'id, created_at',
  orders_sale: 'id, created_at, updated_at',
  orders_purchase: 'id, created_at, updated_at',
  order_items: '++id, order_id',
  transactions: 'id, order_id, created_at, txn_type, party_type, party_id, direction, payment_mode',
  supplier_ledger: 'id, supplier_id, created_at, type',
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

db.version(10).stores({
  products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted, sync_status',
  batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted, quantity_remaining, sync_version',
  suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted, sync_status',
  offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
  offline_purchase_items: '++id, local_purchase_id, product_id',
  offline_purchase_returns: 'local_id, status, branch_id, created_at',
  offline_orders: 'id',
  orders: 'id, transaction_type, payment_mode, created_at, sync_status',
  orders_sale: 'id, transaction_type, payment_mode, created_at, updated_at, sync_status',
  orders_purchase: 'id, transaction_type, payment_mode, created_at, updated_at, sync_status',
  order_items: '++id, order_id',
  transactions: 'id, order_id, created_at, txn_type, party_type, party_id, direction, payment_mode',
  supplier_ledger: 'id, supplier_id, created_at, type',
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
}).upgrade(async (tx) => {
  try {
    const rows = await tx.table('orders').toArray();
    if (!rows.length) return;
    const normalized = rows.map((entry) => {
      const transaction_type = normalizeTransactionType(entry);
      const payment_mode = normalizePaymentMode(entry.payment_mode ?? entry.payment_method ?? null);
      const sync_status = entry.sync_status ?? entry.syncStatus ?? (entry.is_offline ? 'pending' : 'synced');
      return {
        ...entry,
        transaction_type,
        payment_mode,
        sync_status,
      };
    });
    await tx.table('orders').bulkPut(normalized);
    await tx.table('orders_sale').clear();
    await tx.table('orders_purchase').clear();
    const sales = normalized.filter((entry) => String(entry.transaction_type) === 'sale');
    const purchases = normalized.filter((entry) => String(entry.transaction_type) === 'purchase');
    if (sales.length) await tx.table('orders_sale').bulkPut(sales);
    if (purchases.length) await tx.table('orders_purchase').bulkPut(purchases);
  } catch {
    // ignore migration errors
  }
});

db.version(11).stores({
  products_cache: 'id, name, name_lower, barcode, branch_id, updated_at, is_deleted, sync_status',
  batches_cache: 'id, product_id, batch_number, expiry_date, branch_id, updated_at, is_deleted, quantity_remaining, sync_version',
  suppliers_cache: 'id, name, name_lower, mobile, branch_id, updated_at, is_deleted, sync_status',
  offline_purchases: 'local_id, supplier_id, status, branch_id, created_at',
  offline_purchase_items: '++id, local_purchase_id, product_id',
  offline_purchase_returns: 'local_id, status, branch_id, created_at',
  offline_orders: 'id',
  orders: 'id, transaction_type, payment_mode, created_at, sync_status',
  sales_orders: 'id, customer_id, total_amount, payment_mode, created_at, updated_at, sync_status',
  purchase_orders: 'id, supplier_id, total_amount, payment_mode, created_at, updated_at, sync_status',
  order_items: '++id, order_id',
  transactions: 'id, order_id, created_at, txn_type, party_type, party_id, direction, payment_mode',
  supplier_ledger: 'id, supplier_id, created_at, type',
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
}).upgrade(async (tx) => {
  try {
    const fallbackOrders = await tx.table('orders').toArray();
    const legacySales = await tx.table('orders_sale').toArray().catch(() => []);
    const legacyPurchases = await tx.table('orders_purchase').toArray().catch(() => []);

    const source = Array.isArray(fallbackOrders) ? fallbackOrders : [];
    const normalized = source.map((entry) => {
      const transaction_type = normalizeTransactionType(entry);
      const payment_mode = normalizePaymentMode(entry.payment_mode ?? entry.payment_method ?? null);
      const sync_status = entry.sync_status ?? entry.syncStatus ?? (entry.is_offline ? 'pending' : 'synced');
      return {
        ...entry,
        transaction_type,
        payment_mode,
        sync_status,
      };
    });

    const sales =
      legacySales.length > 0
        ? legacySales.map((entry) => ({
            ...entry,
            transaction_type: 'sale',
            sync_status: entry.sync_status ?? entry.syncStatus ?? (entry.is_offline ? 'pending' : 'synced'),
          }))
        : normalized.filter((entry) => String(entry.transaction_type) === 'sale');
    const purchases =
      legacyPurchases.length > 0
        ? legacyPurchases.map((entry) => ({
            ...entry,
            transaction_type: 'purchase',
            sync_status: entry.sync_status ?? entry.syncStatus ?? (entry.is_offline ? 'pending' : 'synced'),
          }))
        : normalized.filter((entry) => String(entry.transaction_type) === 'purchase');

    await tx.table('sales_orders').clear();
    await tx.table('purchase_orders').clear();
    if (sales.length) await tx.table('sales_orders').bulkPut(sales);
    if (purchases.length) await tx.table('purchase_orders').bulkPut(purchases);
  } catch {
    // ignore migration errors
  }
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
    mrp: batch.mrp ?? null,
    quantity: batch.quantity ?? 0,
    quantity_remaining: batch.quantity_remaining ?? batch.quantityRemaining ?? batch.quantity ?? 0,
    sync_version: batch.sync_version ?? batch.syncVersion ?? 1,
    created_at: batch.created_at ?? batch.createdAt ?? null,
    updated_at: batch.updated_at ?? batch.updatedAt ?? batch.created_at ?? null,
    is_deleted: batch.is_deleted ?? false,
  };
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const generateUuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  let time = Date.now();
  return template.replace(/[xy]/g, (char) => {
    const rand = (time + Math.random() * 16) % 16 | 0;
    time = Math.floor(time / 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

const isValidUuid = (value) => UUID_REGEX.test(String(value || '').trim());

const isPrefixedId = (value) => {
  const text = String(value || '');
  return (
    text.startsWith('local:') ||
    text.startsWith('temp:') ||
    text.startsWith('tmp:') ||
    text.startsWith('temp_') ||
    text.startsWith('local_')
  );
};

const roundTo2 = (value) => Math.round(Number(value) * 100) / 100;

const sanitizeValue = (value) => {
  if (typeof value === 'string') return value.trim();
  return value;
};

const stripEmptyFields = (payload) => {
  const cleaned = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    cleaned[key] = sanitizeValue(value);
  });
  return cleaned;
};

const stableStringify = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const hashString = (input) => {
  const text = String(input || '');
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const notifyValidationFailure = () => {};

const normalizePaymentMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'cash') return 'cash';
  if (mode === 'bank') return 'bank';
  if (mode === 'credit') return 'credit';
  if (mode === 'upi' || mode === 'card' || mode === 'wallet') return 'bank';
  return 'cash';
};

const normalizeTransactionType = (order = {}) => {
  const rawType = String(order?.transaction_type ?? order?.transactionType ?? '').trim().toLowerCase();
  if (rawType === 'purchase') return 'purchase';
  if (rawType === 'sale') return 'sale';
  const hasSupplier = Boolean(order?.supplier_id || order?.supplierId || order?.supplier_name || order?.supplierName);
  return hasSupplier ? 'purchase' : 'sale';
};

const ENTITY_SCHEMAS = {
  product_cache: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['id'],
    numberFields: [
      'selling_price',
      'purchase_price',
      'mrp',
      'gst_percentage',
      'stock_quantity',
      'quantity',
    ],
    nonNegativeFields: [
      'selling_price',
      'purchase_price',
      'mrp',
      'gst_percentage',
      'stock_quantity',
      'quantity',
    ],
    allowed: [
      'id',
      'name',
      'name_lower',
      'company',
      'category',
      'barcode',
      'selling_price',
      'purchase_price',
      'mrp',
      'hsn_code',
      'gst_percentage',
      'is_batch_enabled',
      'expiry_date',
      'stock_quantity',
      'branch_id',
      'is_weight_based',
      'time_for_delivery',
      'created_at',
      'updated_at',
      'is_deleted',
      'sync_status',
      'sync_version',
    ],
  },
  supplier_cache: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['id'],
    numberFields: ['credit_limit', 'current_balance'],
    nonNegativeFields: ['credit_limit', 'current_balance'],
    allowed: [
      'id',
      'name',
      'name_lower',
      'mobile',
      'email',
      'address',
      'gst_number',
      'credit_limit',
      'current_balance',
      'branch_id',
      'is_active',
      'updated_at',
      'created_at',
      'is_deleted',
      'sync_status',
      'sync_version',
    ],
  },
  customer: {
    idKey: 'id',
    enforceUuid: false,
    required: [],
    numberFields: ['credit_limit', 'current_balance'],
    nonNegativeFields: ['credit_limit', 'current_balance'],
    allowed: [
      'id',
      'name',
      'mobile',
      'phone',
      'type',
      'email',
      'shop_name',
      'gst_number',
      'credit_limit',
      'current_balance',
      'address',
      'location',
      'updated_at',
      'is_active',
    ],
  },
  batch: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['product_id', 'quantity_remaining'],
    numberFields: ['quantity', 'quantity_remaining', 'purchase_price', 'selling_price', 'mrp'],
    nonNegativeFields: ['quantity', 'quantity_remaining', 'purchase_price', 'selling_price', 'mrp'],
    allowed: [
      'id',
      'product_id',
      'branch_id',
      'batch_number',
      'expiry_date',
      'purchase_price',
      'selling_price',
      'mrp',
      'quantity',
      'quantity_remaining',
      'sync_version',
      'created_at',
      'updated_at',
      'is_deleted',
      'sync_status',
    ],
  },
  order: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['id', 'created_at'],
    numberFields: ['total_amount', 'total_paid', 'returned_amount', 'balance', 'product_count'],
    nonNegativeFields: ['total_amount', 'total_paid', 'returned_amount', 'balance', 'product_count'],
    allowed: [
      'id',
      'local_id',
      'client_order_id',
      'sync_status',
      'is_offline',
      'branch_id',
      'products_summary',
      'product_summary',
      'product_names',
      'product_count',
      'customer_name',
      'customer_phone',
      'customer_mobile',
      'customer_id',
      'customerId',
      'supplier_id',
      'supplierId',
      'supplier_name',
      'total_amount',
      'total_price',
      'total_paid',
      'returned_amount',
      'balance',
      'payment_status',
      'billing_type',
      'billingType',
      'payment_mode',
      'payment_method',
      'transaction_type',
      'transactionType',
      'payment_action',
      'order_status',
      'is_gst_enabled',
      'gst_enabled',
      'created_at',
      'updated_at',
      'items',
      'order_items',
      'products',
      'sync_version',
    ],
  },
  order_item: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['order_id', 'batch_id', 'product_id', 'quantity'],
    numberFields: [
      'quantity',
      'price',
      'selling_price',
      'mrp',
      'discount',
      'tax',
      'gst_percent',
      'gst_percentage',
    ],
    nonNegativeFields: [
      'quantity',
      'price',
      'selling_price',
      'mrp',
      'discount',
      'tax',
      'gst_percent',
      'gst_percentage',
    ],
    allowed: [
      'id',
      'order_id',
      'orderId',
      'batch_id',
      'batchId',
      'product_id',
      'productId',
      'name',
      'barcode',
      'quantity',
      'price',
      'selling_price',
      'mrp',
      'discount',
      'tax',
      'gst_percent',
      'gst_percentage',
      'created_at',
      'updated_at',
      'sync_status',
      'sync_version',
    ],
  },
  transaction: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['id'],
    numberFields: ['total_price', 'amount', 'profit'],
    nonNegativeFields: ['total_price', 'amount', 'profit'],
    allowed: [
      'id',
      'order_id',
      'reference_type',
      'reference_id',
      'client_order_id',
      'total_price',
      'amount',
      'profit',
      'payment_mode',
      'txn_type',
      'direction',
      'party_type',
      'party_id',
      'notes',
      'sync_status',
      'created_at',
      'status',
      'updated_at',
      'sync_version',
    ],
  },
  supplier_ledger: {
    idKey: 'id',
    enforceUuid: false,
    required: ['id', 'supplier_id'],
    numberFields: ['amount', 'running_balance'],
    nonNegativeFields: ['amount', 'running_balance'],
    allowed: [
      'id',
      'supplier_id',
      'type',
      'amount',
      'payment_mode',
      'running_balance',
      'notes',
      'created_at',
      'updated_at',
    ],
  },
  sync_queue: {
    idKey: 'id',
    enforceUuid: false,
    required: ['type'],
    numberFields: ['retry_count', 'retryCount'],
    nonNegativeFields: ['retry_count', 'retryCount'],
    allowed: [
      'id',
      'status',
      'order_id',
      'type',
      'entityId',
      'action',
      'refId',
      'payload',
      'payload_hash',
      'retry_count',
      'retryCount',
      'createdAt',
      'updated_at',
    ],
  },
  sync_log: {
    idKey: 'id',
    enforceUuid: false,
    allowGeneratedId: false,
    required: ['type'],
    allowed: ['id', 'type', 'entityId', 'status', 'message', 'createdAt'],
  },
  product: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['id'],
  },
  supplier: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['id'],
  },
  purchase: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['id'],
  },
  purchase_item: {
    idKey: 'id',
    enforceUuid: false,
    required: ['id', 'purchaseId', 'productId'],
    numberFields: ['quantity', 'purchase_price', 'selling_price', 'mrp', 'gst_percent'],
    nonNegativeFields: ['quantity', 'purchase_price', 'selling_price', 'mrp', 'gst_percent'],
  },
  purchase_return: {
    idKey: 'id',
    enforceUuid: false,
    syncFields: true,
    required: ['id'],
  },
  staff: {
    idKey: 'staffId',
    enforceUuid: false,
    required: ['staffId'],
  },
  salary: {
    idKey: 'salaryId',
    enforceUuid: false,
    required: ['salaryId', 'staffId'],
  },
  expense: {
    idKey: 'expenseId',
    enforceUuid: false,
    required: ['expenseId', 'date'],
  },
  sales_return: {
    idKey: 'returnId',
    enforceUuid: false,
    required: ['returnId'],
  },
  correction: {
    idKey: 'correctionId',
    enforceUuid: false,
    required: ['correctionId'],
  },
  gst_entry: {
    idKey: 'gstEntryId',
    enforceUuid: false,
    required: ['gstEntryId'],
  },
  eway_bill: {
    idKey: 'ewayId',
    enforceUuid: false,
    required: ['ewayId'],
  },
  offline_purchase: {
    idKey: 'local_id',
    enforceUuid: false,
    required: ['local_id'],
  },
  offline_purchase_item: {
    idKey: 'id',
    enforceUuid: false,
    required: ['local_purchase_id'],
  },
  offline_purchase_return: {
    idKey: 'local_id',
    enforceUuid: false,
    required: ['local_id'],
  },
  offline_order: {
    idKey: 'id',
    enforceUuid: false,
    allowAnyId: true,
    required: ['id'],
  },
  offline_import: {
    idKey: 'id',
    enforceUuid: false,
    required: ['id'],
  },
  offline_import_item: {
    idKey: 'id',
    enforceUuid: false,
    required: ['id', 'importId'],
  },
  offline_stock_batch: {
    idKey: 'id',
    enforceUuid: false,
    required: ['id', 'productId'],
    numberFields: ['quantity', 'quantity_remaining'],
    nonNegativeFields: ['quantity', 'quantity_remaining'],
  },
  product_id_map: {
    idKey: 'tempId',
    enforceUuid: false,
    allowGeneratedId: false,
    required: ['tempId', 'realId'],
  },
  session: {
    idKey: 'key',
    enforceUuid: false,
    allowGeneratedId: false,
    allowAnyId: true,
    required: ['key'],
  },
  config: {
    idKey: 'key',
    enforceUuid: false,
    allowGeneratedId: false,
    allowAnyId: true,
    required: ['key'],
  },
};

const normalizeNumericField = (value, field) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid number for ${field}`);
  }
  return roundTo2(numeric);
};

export const validateAndPrepare = async (entityType, data) => {
  try {
    if (!entityType) throw new Error('Missing entity type');
    if (!data || typeof data !== 'object') {
      throw new Error(`Invalid data for ${entityType}`);
    }

    const schema = ENTITY_SCHEMAS[entityType] || null;
    const now = new Date().toISOString();
    let payload = stripEmptyFields(data);

    const idKey = schema?.idKey || 'id';
    const allowGeneratedId = schema?.allowGeneratedId !== false;
    if (!payload[idKey] && allowGeneratedId) {
      payload[idKey] = generateUuid();
    }

    if (schema?.allowAnyId) {
      const idValue = payload[idKey];
      if (idValue === undefined || idValue === null || String(idValue).trim() === '') {
        throw new Error(`Missing id for ${entityType}`);
      }
    } else if (schema?.enforceUuid) {
      const idValue = payload[idKey];
      if (typeof idValue === 'string' && !isValidUuid(idValue)) {
        throw new Error(`Invalid UUID for ${entityType}`);
      }
    } else if (typeof payload[idKey] === 'string') {
      const trimmed = payload[idKey].trim();
      payload[idKey] = trimmed;
      if (!trimmed) {
        throw new Error(`Missing id for ${entityType}`);
      }
      if (!isValidUuid(trimmed) && !isPrefixedId(trimmed) && !Number.isFinite(Number(trimmed))) {
        throw new Error(`Invalid id for ${entityType}`);
      }
    }

    if (!payload.updated_at && !payload.updatedAt) {
      payload.updated_at = now;
    }

    if (schema?.syncFields) {
      const incomingStatus = payload.sync_status ?? payload.syncStatus;
      if (incomingStatus === undefined || incomingStatus === null || incomingStatus === '') {
        payload.sync_status = 'pending';
      } else {
        payload.sync_status = incomingStatus;
      }
      const incomingVersion = payload.sync_version ?? payload.syncVersion;
      if (incomingVersion === undefined || incomingVersion === null || incomingVersion === '') {
        payload.sync_version = 1;
      } else {
        payload.sync_version = incomingVersion;
      }
    }

    if (entityType === 'batch') {
      if (payload.product_id === undefined || payload.product_id === null) {
        payload.product_id = payload.productId;
      }
    }

    if (entityType === 'order') {
      if (!payload.created_at && payload.createdAt) {
        payload.created_at = payload.createdAt;
      }
      payload.transaction_type = normalizeTransactionType(payload);
      payload.payment_mode = normalizePaymentMode(payload.payment_mode ?? payload.payment_method ?? null);
    }

    if (entityType === 'order_item') {
      if (payload.order_id === undefined || payload.order_id === null) {
        payload.order_id = payload.orderId;
      }
      if (payload.batch_id === undefined || payload.batch_id === null) {
        payload.batch_id = payload.batchId;
      }
      if (payload.product_id === undefined || payload.product_id === null) {
        payload.product_id = payload.productId;
      }
    }

    if (entityType === 'offline_purchase') {
      if (payload.local_id === undefined || payload.local_id === null) {
        payload.local_id = payload.localId;
      }
    }

    if (entityType === 'offline_purchase_item') {
      if (payload.local_purchase_id === undefined || payload.local_purchase_id === null) {
        payload.local_purchase_id = payload.localPurchaseId;
      }
    }

    if (entityType === 'offline_purchase_return') {
      if (payload.local_id === undefined || payload.local_id === null) {
        payload.local_id = payload.localId;
      }
    }

    if (entityType === 'transaction') {
      if (payload.order_id === undefined || payload.order_id === null) {
        payload.order_id = payload.orderId;
      }
    }

    if (entityType === 'supplier_ledger') {
      if (payload.supplier_id === undefined || payload.supplier_id === null) {
        payload.supplier_id = payload.supplierId;
      }
    }

    if (schema?.numberFields?.length) {
      schema.numberFields.forEach((field) => {
        if (payload[field] === undefined || payload[field] === null) return;
        payload[field] = normalizeNumericField(payload[field], field);
      });
    }

    if (schema?.nonNegativeFields?.length) {
      schema.nonNegativeFields.forEach((field) => {
        if (payload[field] === undefined || payload[field] === null) return;
        if (Number(payload[field]) < 0) {
          throw new Error(`Negative value not allowed for ${field}`);
        }
      });
    }

    if (schema?.required?.length) {
      schema.required.forEach((field) => {
        const value = payload[field];
        if (value === undefined || value === null || value === '') {
          throw new Error(`Missing required field ${field}`);
        }
      });
    }

    if (entityType === 'customer') {
      const hasId = payload.id !== undefined && payload.id !== null && payload.id !== '';
      const mobile = payload.mobile ?? payload.phone;
      if (!hasId && !mobile) {
        throw new Error('Customer requires id or mobile');
      }
    }

    if (entityType === 'batch') {
      const productId = payload.product_id;
      if (productId) {
        const product =
          (await db.products_cache.get(productId)) || (await db.products.get(productId));
        if (!product) {
          throw new Error('Product not found for batch');
        }
      }

      if (payload.quantity === undefined || payload.quantity === null) {
        payload.quantity = payload.quantity_remaining;
      }
      if (Number(payload.quantity_remaining) > Number(payload.quantity)) {
        payload.quantity_remaining = payload.quantity;
      }
      if (Number(payload.quantity_remaining) < 0) {
        throw new Error('Negative batch quantity_remaining');
      }

      if (payload.batch_number && payload.product_id) {
        const existing = await db.batches_cache
          .where('product_id')
          .equals(payload.product_id)
          .toArray();
        if (existing.length) {
          const same = existing.find(
            (batch) =>
              String(batch.batch_number || '') === String(payload.batch_number || '') &&
              String(batch.id) !== String(payload.id)
          );
          if (same) {
            let suffix = 1;
            let candidate = `${payload.batch_number}-${suffix}`;
            const taken = new Set(existing.map((batch) => String(batch.batch_number || '')));
            while (taken.has(String(candidate))) {
              suffix += 1;
              candidate = `${payload.batch_number}-${suffix}`;
            }
            payload.batch_number = candidate;
          }
        }
      }

      if (!payload.sync_version) {
        payload.sync_version = 1;
      }
    }

    if (entityType === 'order') {
      const items = payload.items ?? payload.order_items ?? payload.products;
      if (Array.isArray(items) && items.length === 0) {
        throw new Error('Order must include items');
      }
    }

    if (entityType === 'order_item') {
      if (Number(payload.quantity) <= 0) {
        throw new Error('Order item quantity must be greater than 0');
      }
      const batchId = payload.batch_id ?? payload.batchId;
      if (!batchId) {
        throw new Error('Order item batch_id is required');
      }
      const batch = await db.batches_cache.get(batchId);
      if (!batch) {
        throw new Error('Batch not found for order item');
      }
      const productId = payload.product_id ?? payload.productId;
      if (productId && String(batch.product_id) !== String(productId)) {
        throw new Error('Order item product_id mismatch with batch');
      }
      if (Number(batch.quantity_remaining) < Number(payload.quantity)) {
        throw new Error('Insufficient batch stock for order item');
      }
    }

    if (entityType === 'sync_queue') {
      const retryCount = payload.retry_count ?? payload.retryCount ?? 0;
      payload.retry_count = retryCount;
      if (Number(retryCount) > 3) {
        payload.status = 'failed';
      }
      if (!payload.status) {
        payload.status = 'pending';
      }
      const hashPayload = {
        type: payload.type,
        action: payload.action,
        entityId: payload.entityId,
        order_id: payload.order_id,
        refId: payload.refId,
        payload: payload.payload,
      };
      payload.payload_hash = hashString(stableStringify(hashPayload));
    }

    if (schema?.allowed?.length) {
      const filtered = {};
      schema.allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          filtered[key] = payload[key];
        }
      });
      payload = filtered;
    }

    return payload;
  } catch (error) {
    notifyValidationFailure(entityType, error, data);
    throw error;
  }
};

const prepareList = async (entityType, list) => {
  const prepared = [];
  for (const entry of list) {
    prepared.push(await validateAndPrepare(entityType, entry));
  }
  return prepared;
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
  const resolvedPaymentMode =
    transaction.payment_mode ??
    transaction.paymentMethod ??
    transaction.payment_method ??
    transaction.method ??
    transaction.mode ??
    null;
  const resolvedCreatedAt =
    transaction.created_at ??
    transaction.createdAt ??
    transaction.paid_at ??
    transaction.date ??
    transaction.transaction_date ??
    new Date().toISOString();
  return {
    id,
    order_id: transaction.order_id ?? transaction.orderId ?? null,
    reference_type: transaction.reference_type ?? transaction.referenceType ?? null,
    reference_id: transaction.reference_id ?? transaction.referenceId ?? null,
    client_order_id: transaction.client_order_id ?? transaction.clientOrderId ?? null,
    total_price: transaction.total_price ?? transaction.amount_paid ?? transaction.amount ?? null,
    amount: transaction.amount ?? transaction.total_price ?? transaction.amount_paid ?? transaction.amount ?? null,
    profit: transaction.profit ?? null,
    payment_mode: resolvedPaymentMode,
    txn_type: transaction.txn_type ?? transaction.txnType ?? null,
    direction: transaction.direction ?? null,
    party_type: transaction.party_type ?? transaction.partyType ?? null,
    party_id: transaction.party_id ?? transaction.partyId ?? null,
    notes: transaction.notes ?? null,
    sync_status: transaction.sync_status ?? transaction.syncStatus ?? null,
    created_at: resolvedCreatedAt,
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
  const prepared = await prepareList('product_cache', normalized);
  await db.products_cache.bulkPut(prepared);
  return prepared.length;
};

const normalizeCustomerPhone = (value) => String(value || '').replace(/\D+/g, '');

const dedupeCustomersByIdentity = (list = []) => {
  const map = new Map();
  const score = (entry) => {
    const hasPhone = Boolean(normalizeCustomerPhone(entry?.phone || entry?.mobile));
    const hasName = Boolean(String(entry?.name || '').trim());
    const updated = Date.parse(entry?.updated_at || entry?.updatedAt || entry?.created_at || entry?.createdAt || '') || 0;
    return (hasPhone ? 10 : 0) + (hasName ? 5 : 0) + updated / 1e13;
  };

  (Array.isArray(list) ? list : []).forEach((entry) => {
    const phone = normalizeCustomerPhone(entry?.phone || entry?.mobile);
    const name = String(entry?.name || '').trim().toLowerCase();
    const key = phone ? `p:${phone}` : `n:${name}`;
    const existing = map.get(key);
    if (!existing || score(entry) >= score(existing)) {
      map.set(key, entry);
    }
  });

  return Array.from(map.values());
};

export const getAllCustomers = async () => {
  const all = await db.customers.toArray();
  return dedupeCustomersByIdentity(all);
};

export const upsertCustomerLocal = async (customer) => {
  if (!customer) return null;
  const normalized = normalizeCustomer(customer);
  if (!normalized?.id) return null;
  const prepared = await validateAndPrepare('customer', normalized);
  await db.customers.put(prepared);
  return prepared;
};

export const getCustomerById = async (customerId) => {
  if (customerId === null || customerId === undefined) return null;
  const raw = String(customerId).trim();
  if (!raw) return null;
  const numeric = Number(raw);

  // Try both number and string keys because local cache IDs can be stored either way.
  if (Number.isFinite(numeric)) {
    const numericHit = await db.customers.get(numeric);
    if (numericHit) return numericHit;
  }

  return await db.customers.get(raw);
};

export const saveCustomersBulk = async (customers) => {
  const list = Array.isArray(customers) ? customers : [];
  const normalized = list.map((customer) => normalizeCustomer(customer)).filter(Boolean);
  if (!normalized.length) return 0;
  const prepared = await prepareList('customer', normalized);
  await db.transaction('rw', db.customers, async () => {
    await db.customers.clear();
    await db.customers.bulkPut(prepared);
  });
  return prepared.length;
};

export const upsertCustomersBulk = async (customers) => {
  const list = Array.isArray(customers) ? customers : [];
  const normalized = list.map((customer) => normalizeCustomer(customer)).filter(Boolean);
  if (!normalized.length) return 0;
  const prepared = await prepareList('customer', normalized);
  await db.customers.bulkPut(prepared);
  return prepared.length;
};

export const saveBatchesBulk = async (batches) => {
  const list = Array.isArray(batches) ? batches : [];
  const normalized = list.map((batch) => normalizeBatch(batch)).filter(Boolean);
  if (!normalized.length) return 0;
  const prepared = [];
  for (const entry of normalized) {
    prepared.push(await validateAndPrepare('batch', entry));
  }
  await db.transaction('rw', db.batches_cache, async () => {
    await db.batches_cache.clear();
    await db.batches_cache.bulkPut(prepared);
  });
  return prepared.length;
};

export const updateBatchesBulk = async (batches) => {
  const list = Array.isArray(batches) ? batches : [];
  const normalized = list.map((batch) => normalizeBatch(batch)).filter(Boolean);
  if (!normalized.length) return 0;
  const existing = await db.batches_cache.bulkGet(normalized.map((batch) => batch.id));
  const toUpsert = normalized.filter((batch, idx) => {
    const local = existing[idx];
    if (!local) return true;
    const localVersion = Number(local.sync_version ?? 0);
    const serverVersion = Number(batch.sync_version ?? 0);
    return serverVersion > localVersion;
  });
  if (!toUpsert.length) return 0;
  const prepared = [];
  for (const entry of toUpsert) {
    prepared.push(await validateAndPrepare('batch', entry));
  }
  await db.batches_cache.bulkPut(prepared);
  return prepared.length;
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

export const getProductByBarcode = async (barcode, branchId = null) => {
  const code = String(barcode || '').trim();
  if (!code) return null;
  if (!branchId) {
    return await db.products_cache.where('barcode').equals(code).first();
  }
  const matches = await db.products_cache.where('barcode').equals(code).toArray();
  const branchMatch =
    (Array.isArray(matches) ? matches : []).find(
      (product) =>
        product &&
        product.branch_id !== null &&
        product.branch_id !== undefined &&
        String(product.branch_id) === String(branchId)
    ) || null;
  return branchMatch;
};

export const updateProduct = async (product) => {
  const normalized = normalizeProduct(product);
  if (!normalized) throw new Error('Missing product identifier');
  const prepared = await validateAndPrepare('product_cache', normalized);
  await db.products_cache.put(prepared);
};

export const getAllProducts = async () => {
  return await db.products_cache.toArray();
};

export const updateProductsBulk = async (products) => {
  const list = Array.isArray(products) ? products : [];
  const normalized = list.map((product) => normalizeProduct(product)).filter(Boolean);
  if (!normalized.length) return 0;
  const prepared = await prepareList('product_cache', normalized);
  await db.products_cache.bulkPut(prepared);
  return prepared.length;
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
  const prepared = await prepareList('supplier_cache', normalized);
  await db.suppliers_cache.bulkPut(prepared);
  return prepared.length;
};

export const getAllSuppliersCache = async () => {
  return await db.suppliers_cache.toArray();
};

export const getSupplierCacheById = async (supplierId) => {
  if (!supplierId) return null;
  const numeric = Number(supplierId);
  if (Number.isFinite(numeric)) {
    const hit = await db.suppliers_cache.get(numeric);
    if (hit) return hit;
  }
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
  const prepared = await prepareList('transaction', normalized);
  await db.transactions.bulkPut(prepared);
  return prepared.length;
};

export const upsertTransaction = async (transaction) => {
  const normalized = normalizeTransaction(transaction);
  if (!normalized) throw new Error('Missing id in transaction payload');
  const prepared = await validateAndPrepare('transaction', normalized);
  await db.transactions.put(prepared);
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
  const prepared = await validateAndPrepare('transaction', transaction);
  await db.transactions.put(prepared);
};

const normalizeSupplierLedgerEntry = (entry) => {
  if (!entry) return null;
  const id = entry.id ?? entry.ledger_id ?? entry.payment_id ?? entry.transaction_id;
  if (!id) return null;
  return {
    id,
    supplier_id: String(entry.supplier_id ?? entry.supplierId ?? entry.party_id ?? ''),
    type: entry.type ?? entry.txn_type ?? null,
    amount: entry.amount ?? entry.total_amount ?? null,
    payment_mode: entry.payment_mode ?? null,
    running_balance: entry.running_balance ?? null,
    notes: entry.notes ?? null,
    created_at: entry.created_at ?? entry.createdAt ?? new Date().toISOString(),
    sync_status: entry.sync_status ?? null,
  };
};

export const upsertSupplierLedgerEntry = async (entry) => {
  const normalized = normalizeSupplierLedgerEntry(entry);
  if (!normalized) return null;
  const prepared = await validateAndPrepare('supplier_ledger', normalized);
  await db.supplier_ledger.put(prepared);
  return prepared;
};

export const upsertSupplierLedgerBulk = async (entries = []) => {
  const list = Array.isArray(entries) ? entries : [];
  const normalized = list.map((entry) => normalizeSupplierLedgerEntry(entry)).filter(Boolean);
  if (!normalized.length) return 0;
  const prepared = await prepareList('supplier_ledger', normalized);
  await db.supplier_ledger.bulkPut(prepared);
  return prepared.length;
};

export const getSupplierLedgerBySupplierId = async (supplierId) => {
  if (!supplierId) return [];
  const key = String(supplierId);
  return await db.supplier_ledger.where('supplier_id').equals(key).toArray();
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
  const prepared = await validateAndPrepare('session', {
    key: normalized,
    value,
    updatedAt: new Date().toISOString(),
  });
  await db.session.put(prepared);
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
  const prepared = await prepareList('offline_order', list);
  await db.transaction('rw', db.offline_orders, async () => {
    await db.offline_orders.clear();
    if (prepared.length) {
      await db.offline_orders.bulkPut(prepared);
    }
  });
  return prepared.length;
};

export const upsertOfflineOrder = async (entry) => {
  if (!entry || !entry.id) return;
  const prepared = await validateAndPrepare('offline_order', entry);
  await db.offline_orders.put(prepared);
};

export const deleteOfflineOrdersByIds = async (ids) => {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return;
  await db.offline_orders.bulkDelete(list);
};

export const saveConfigValue = async (key, value) => {
  const normalized = normalizeSessionKey(key);
  if (!normalized) return;
  const prepared = await validateAndPrepare('config', {
    key: normalized,
    value,
    updatedAt: new Date().toISOString(),
  });
  await db.config.put(prepared);
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
  const prepared = await validateAndPrepare('product', product);
  await db.products.put(prepared);
};

export const getLocalProducts = async (status = null) => {
  const all = await db.products.toArray();
  if (!status) return all;
  const normalized = normalizeSyncStatus(status);
  return all.filter((item) => normalizeSyncStatus(item.syncStatus || item.sync_status) === normalized);
};

export const upsertLocalSupplier = async (supplier) => {
  if (!supplier || !supplier.id) return;
  const prepared = await validateAndPrepare('supplier', supplier);
  await db.suppliers.put(prepared);
};

export const getLocalSuppliers = async (status = null) => {
  const all = await db.suppliers.toArray();
  if (!status) return all;
  const normalized = normalizeSyncStatus(status);
  return all.filter((item) => normalizeSyncStatus(item.syncStatus || item.sync_status) === normalized);
};

export const upsertLocalPurchase = async (purchase) => {
  if (!purchase || !purchase.id) return;
  const prepared = await validateAndPrepare('purchase', purchase);
  await db.purchases.put(prepared);
};

export const upsertLocalPurchasesBulk = async (purchases = []) => {
  const list = Array.isArray(purchases) ? purchases.filter((item) => item && item.id) : [];
  if (!list.length) return 0;
  const prepared = await prepareList('purchase', list);
  await db.purchases.bulkPut(prepared);
  return prepared.length;
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
  const prepared = await prepareList('purchase_item', list);
  await db.purchase_items.bulkPut(prepared);
  return prepared.length;
};

export const getLocalPurchaseItems = async (purchaseId) => {
  if (!purchaseId) return [];
  return await db.purchase_items.where('purchaseId').equals(purchaseId).toArray();
};

export const upsertLocalPurchaseReturn = async (entry) => {
  if (!entry || !entry.id) return;
  const prepared = await validateAndPrepare('purchase_return', entry);
  await db.purchase_returns.put(prepared);
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
  const prepared = await validateAndPrepare('sync_queue', payload);
  const existing = (await db.sync_queue.toArray()).find(
    (item) => item?.payload_hash && item.payload_hash === prepared.payload_hash
  );
  if (existing) return existing;
  const id = await db.sync_queue.add(prepared);
  return { ...prepared, id };
};

export const updateInventorySyncQueueEntry = async (entry) => {
  if (!entry || !entry.id) return null;
  const payload = { ...entry, updated_at: new Date().toISOString() };
  const prepared = await validateAndPrepare('sync_queue', payload);
  await db.sync_queue.put(prepared);
  return prepared;
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
  const prepared = await validateAndPrepare('sync_log', {
    type,
    entityId: entityId ?? null,
    status: normalizeSyncStatus(status),
    message: message || null,
    createdAt: new Date().toISOString(),
  });
  await db.sync_logs.add(prepared);
};

export const replaceProductIdReferences = async (oldId, newId) => {
  if (!oldId || !newId || oldId === newId) return;
  const existing = await db.products_cache.get(oldId);
  if (existing) {
    await db.products_cache.delete(oldId);
    const nextBarcode = existing.barcode && String(existing.barcode).startsWith('id:') ? `id:${newId}` : existing.barcode;
    const prepared = await validateAndPrepare('product_cache', { ...existing, id: newId, barcode: nextBarcode });
    await db.products_cache.put(prepared);
  }
  const batches = await db.batches_cache.where('product_id').equals(oldId).toArray();
  if (batches.length) {
    const prepared = await prepareList(
      'batch',
      batches.map((batch) => ({ ...batch, product_id: newId }))
    );
    await db.batches_cache.bulkPut(prepared);
  }
  const offlineBatches = await db.offline_stock_batches.where('productId').equals(oldId).toArray();
  if (offlineBatches.length) {
    const prepared = await prepareList(
      'offline_stock_batch',
      offlineBatches.map((batch) => ({ ...batch, productId: newId }))
    );
    await db.offline_stock_batches.bulkPut(prepared);
  }
  const items = await db.purchase_items.where('productId').equals(oldId).toArray();
  if (items.length) {
    const prepared = await prepareList(
      'purchase_item',
      items.map((item) => ({ ...item, productId: newId }))
    );
    await db.purchase_items.bulkPut(prepared);
  }
  const importItems = await db.offline_import_items.where('productId').equals(oldId).toArray();
  if (importItems.length) {
    const prepared = await prepareList(
      'offline_import_item',
      importItems.map((item) => ({ ...item, productId: newId }))
    );
    await db.offline_import_items.bulkPut(prepared);
  }
};

export const replaceSupplierIdReferences = async (oldId, newId) => {
  if (!oldId || !newId || oldId === newId) return;
  const existing = await db.suppliers_cache.get(oldId);
  if (existing) {
    await db.suppliers_cache.delete(oldId);
    const prepared = await validateAndPrepare('supplier_cache', { ...existing, id: newId });
    await db.suppliers_cache.put(prepared);
  }
  const purchases = await db.purchases.where('supplierId').equals(oldId).toArray();
  if (purchases.length) {
    const prepared = await prepareList(
      'purchase',
      purchases.map((purchase) => ({ ...purchase, supplierId: newId }))
    );
    await db.purchases.bulkPut(prepared);
  }
};

const isTempSupplierId = (value) => {
  const text = String(value || '');
  return text.startsWith('temp_') || text.startsWith('temp:') || text.startsWith('local:') || text.startsWith('tmp:');
};

const normalizeSupplierKey = (supplier) => {
  const name = String(supplier?.name || '').trim().toLowerCase();
  const mobile = String(supplier?.mobile || supplier?.phone || '').trim().toLowerCase();
  if (!name && !mobile) return '';
  return `${name}|${mobile}`;
};

const supplierScore = (supplier) => {
  const id = supplier?.id;
  const status = String(supplier?.sync_status || supplier?.syncStatus || '').toLowerCase();
  const hasRealId = id && !isTempSupplierId(id);
  let score = 0;
  if (hasRealId) score += 2;
  if (status === 'synced') score += 2;
  if (status === 'pending') score += 1;
  const ts = Date.parse(supplier?.updated_at || supplier?.updatedAt || supplier?.created_at || supplier?.createdAt || '') || 0;
  return { score, ts };
};

const pickPreferredSupplier = (current, candidate) => {
  if (!current) return candidate;
  const currentScore = supplierScore(current);
  const candidateScore = supplierScore(candidate);
  if (candidateScore.score > currentScore.score) return candidate;
  if (candidateScore.score < currentScore.score) return current;
  if (candidateScore.ts > currentScore.ts) return candidate;
  return current;
};

export const dedupeSuppliersCache = async () => {
  const cachedList = await db.suppliers_cache.toArray();
  if (!cachedList.length) return [];
  const keepByKey = new Map();
  const replaceMap = new Map();
  cachedList.forEach((supplier) => {
    const key = normalizeSupplierKey(supplier);
    if (!key) return;
    const current = keepByKey.get(key);
    const preferred = pickPreferredSupplier(current, supplier);
    if (!current || preferred === supplier) {
      keepByKey.set(key, supplier);
      if (current && current.id && supplier.id && current.id !== supplier.id) {
        replaceMap.set(current.id, supplier.id);
      }
    } else if (supplier.id && current?.id && supplier.id !== current.id) {
      replaceMap.set(supplier.id, current.id);
    }
  });

  for (const [oldId, newId] of replaceMap.entries()) {
    await replaceSupplierIdReferences(oldId, newId);
    await db.suppliers.delete(oldId).catch(() => {});
  }

  const keepIds = new Set(
    Array.from(keepByKey.values())
      .map((supplier) => supplier?.id)
      .filter(Boolean)
      .map((id) => String(id))
  );
  const toDeleteIds = cachedList
    .map((supplier) => supplier?.id)
    .filter((id) => id && !keepIds.has(String(id)));
  if (toDeleteIds.length) {
    await db.suppliers_cache.bulkDelete(toDeleteIds);
  }

  const finalList = await db.suppliers_cache.toArray();
  return Array.isArray(finalList) ? finalList : [];
};

export const upsertOfflinePurchase = async (purchase) => {
  if (!purchase || !purchase.local_id) return;
  const prepared = await validateAndPrepare('offline_purchase', purchase);
  await db.offline_purchases.put(prepared);
};

export const addOfflinePurchaseItems = async (items = []) => {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return 0;
  const prepared = await prepareList('offline_purchase_item', list);
  await db.offline_purchase_items.bulkPut(prepared);
  return prepared.length;
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
  const next = Number(current) + numericDelta;
  if (next < 0) {
    throw new Error('Stock update would make quantity negative');
  }
  const updated = existing
    ? { ...existing, stock_quantity: next, branch_id: existing.branch_id ?? branchId ?? null }
    : { id: productId, stock_quantity: next, branch_id: branchId ?? null };
  const prepared = await validateAndPrepare('product_cache', updated);
  await db.products_cache.put(prepared);
};

export const addLocalBatchCache = async (batch) => {
  if (!batch) return;
  const normalized = normalizeBatch(batch);
  if (!normalized) return;
  const prepared = await validateAndPrepare('batch', normalized);
  await db.batches_cache.put(prepared);
};

export const upsertOfflinePurchaseReturn = async (returnEntry) => {
  if (!returnEntry || !returnEntry.local_id) return;
  const prepared = await validateAndPrepare('offline_purchase_return', returnEntry);
  await db.offline_purchase_returns.put(prepared);
};

export const addOfflineImport = async ({ importEntry, items = [], batches = [] } = {}) => {
  if (!importEntry?.id) return null;
  const preparedImport = await validateAndPrepare('offline_import', importEntry);
  const preparedItems = await prepareList('offline_import_item', items);
  const preparedBatches = await prepareList('offline_stock_batch', batches);
  await db.transaction('rw', db.offline_imports, db.offline_import_items, db.offline_stock_batches, async () => {
    await db.offline_imports.put(preparedImport);
    if (preparedItems.length) {
      await db.offline_import_items.bulkPut(preparedItems);
    }
    if (preparedBatches.length) {
      await db.offline_stock_batches.bulkPut(preparedBatches);
    }
  });
  return preparedImport;
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
  const prepared = await validateAndPrepare('offline_import', entry);
  await db.offline_imports.put(prepared);
  return prepared;
};

export const updateOfflineImportStatus = async (importId, status) => {
  if (!importId) return null;
  const existing = await db.offline_imports.get(importId);
  if (!existing) return null;
  const updated = { ...existing, status, updatedAt: new Date().toISOString() };
  const prepared = await validateAndPrepare('offline_import', updated);
  await db.offline_imports.put(prepared);
  return prepared;
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
  const prepared = await validateAndPrepare('sync_queue', payload);
  const existing = (await db.sync_queue.toArray()).find(
    (item) => item?.payload_hash && item.payload_hash === prepared.payload_hash
  );
  if (existing) return existing;
  const id = await db.sync_queue.add(prepared);
  return { ...prepared, id };
};

export const updateSyncQueueItem = async (entry) => {
  if (!entry?.id) return null;
  const payload = { ...entry, updated_at: new Date().toISOString() };
  const prepared = await validateAndPrepare('sync_queue', payload);
  await db.sync_queue.put(prepared);
  return prepared;
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
  const prepared = await validateAndPrepare('product_id_map', payload);
  await db.product_id_map.put(prepared);
  return prepared;
};

export const getProductIdMappings = async () => {
  return await db.product_id_map.toArray();
};

export const replaceCustomerIdReferences = async (oldId, newId) => {
  if (!oldId || !newId || oldId === newId) return;
  const existing = await db.customers.get(oldId);
  if (existing) {
    await db.customers.delete(oldId);
    const prepared = await validateAndPrepare('customer', { ...existing, id: newId });
    await db.customers.put(prepared);
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
      const prepared = await prepareList('offline_order', updated);
      await db.offline_orders.bulkPut(prepared);
    }
  } catch {
    // ignore offline order remap errors
  }
  try {
    const cachedOrders = await db.orders.toArray();
    if (cachedOrders.length) {
      const updatedOrders = cachedOrders.map((order) => {
        const orderCustomerId = order?.customer_id ?? order?.customerId ?? null;
        if (String(orderCustomerId) !== String(oldId)) return order;
        return { ...order, customer_id: newId };
      });
      const prepared = await prepareList('order', updatedOrders);
      await db.orders.bulkPut(prepared);
    }
  } catch {
    // ignore cached order remap errors
  }
};

export const getOfflinePurchaseReturns = async (status = null) => {
  const all = await db.offline_purchase_returns.toArray();
  if (!status) return all;
  return all.filter((entry) => entry.status === status);
};

export const upsertLocalStaff = async (staff) => {
  if (!staff?.staffId) return null;
  const prepared = await validateAndPrepare('staff', staff);
  await db.staff.put(prepared);
  return prepared;
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
  const prepared = await validateAndPrepare('salary', salary);
  await db.salaries.put(prepared);
  return prepared;
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
  const prepared = await validateAndPrepare('expense', expense);
  await db.expenses.put(prepared);
  return prepared;
};

export const getLocalExpenses = async ({ type, staffId, from, to, category } = {}) => {
  const list = await db.expenses.toArray();
  const normalizeDateOnly = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      const maybeIso = new Date(trimmed);
      if (!Number.isNaN(maybeIso.getTime())) {
        const y = maybeIso.getFullYear();
        const m = String(maybeIso.getMonth() + 1).padStart(2, '0');
        const d = String(maybeIso.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const fromDate = normalizeDateOnly(from);
  const toDate = normalizeDateOnly(to);
  return list.filter((expense) => {
    if (type && String(expense.type) !== String(type)) return false;
    if (staffId && String(expense.staffId) !== String(staffId)) return false;
    if (category && String(expense.category || '').toLowerCase() !== String(category).toLowerCase()) {
      return false;
    }
    const expenseDate = normalizeDateOnly(expense.date);
    if (!expenseDate) return false;
    if (fromDate && expenseDate < fromDate) {
      return false;
    }
    if (toDate && expenseDate > toDate) {
      return false;
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
  const prepared = await validateAndPrepare('sales_return', entry);
  await db.sales_returns.put(prepared);
  return prepared;
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
  const prepared = await validateAndPrepare('correction', entry);
  await db.corrections.put(prepared);
  return prepared;
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
  const prepared = await validateAndPrepare('gst_entry', entry);
  await db.gst_ledger.put(prepared);
  return prepared;
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
  const prepared = await validateAndPrepare('eway_bill', entry);
  await db.eway_bills.put(prepared);
  return prepared;
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

export const exportLocalDbSnapshot = async () => {
  const snapshot = {};
  for (const table of db.tables) {
    const rows = await table.toArray();
    snapshot[table.name] = rows;
  }
  return {
    exportedAt: new Date().toISOString(),
    database: db.name,
    stores: snapshot,
  };
};

export const restoreLocalDbSnapshot = async (snapshot = {}) => {
  const stores = snapshot?.stores && typeof snapshot.stores === 'object' ? snapshot.stores : {};
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rows = Array.isArray(stores[table.name]) ? stores[table.name] : null;
      if (!rows) continue;
      await table.clear();
      if (rows.length > 0) {
        await table.bulkPut(rows);
      }
    }
  });
  return true;
};

export { db };
export default db;
