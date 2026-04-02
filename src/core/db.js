const DB_NAME = 'shajretaildb';
const STORE_NAME = 'products';
const OFFLINE_ORDERS_STORE = 'offline_orders';
const SESSION_STORE = 'session';
const ORDERS_STORE = 'orders';
const ORDER_ITEMS_STORE = 'order_items';
const BATCHES_STORE = 'batches';
const TRANSACTIONS_STORE = 'transactions';
const CUSTOMERS_STORE = 'customers';
const SYNC_QUEUE_STORE = 'sync_queue';
const CONFIG_STORE = 'config';

let dbPromise = null;

const REQUIRED_STORES = [
  STORE_NAME,
  OFFLINE_ORDERS_STORE,
  SESSION_STORE,
  ORDERS_STORE,
  ORDER_ITEMS_STORE,
  BATCHES_STORE,
  TRANSACTIONS_STORE,
  CUSTOMERS_STORE,
  SYNC_QUEUE_STORE,
  CONFIG_STORE,
];

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
    company: product.company ?? product.company_name,
    category: product.category ?? product.category_name,
    barcode: resolvedBarcode,
    selling_price: product.selling_price,
    purchase_price: product.purchase_price,
    mrp: product.mrp ?? product.mrp_price ?? null,
    purchase_price: product.purchase_price ?? null,
    hsn_code: product.hsn_code ?? null,
    gst_percentage: product.gst_percentage ?? null,
    is_batch_enabled: product.is_batch_enabled ?? null,
    expiry_date: product.expiry_date ?? product.expiryDate ?? null,
    stock_quantity: product.stock_quantity,
    branch_id: product.branch_id ?? product.branchId ?? null,
    is_weight_based: product.is_weight_based,
    time_for_delivery: product.time_for_delivery ?? null,
    created_at: product.created_at ?? null,
  };
};

const normalizeCustomer = (customer) => {
  if (!customer) return null;
  const id = customer.id ?? customer.customer_id ?? null;
  const mobile = customer.mobile ?? customer.phone ?? null;
  if (!id && !mobile) return null;
  return {
    id: id ?? null,
    name: customer.name ?? customer.customer_name ?? '',
    mobile,
    address: customer.address ?? customer.customer_address ?? null,
    location: customer.location ?? customer.customer_location ?? null,
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
    created_at: batch.created_at ?? batch.createdAt ?? null,
  };
};

const waitForRequest = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const waitForTransaction = (transaction) =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

export const initDB = async () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      console.log('\u{1F4E6} Opening IndexedDB');
      // Open without an explicit version to avoid VersionError mismatches.
      const request = indexedDB.open(DB_NAME);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          console.log('Creating products store');
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('barcode', 'barcode', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('hsn_code', 'hsn_code', { unique: false });
        }
        if (!db.objectStoreNames.contains(OFFLINE_ORDERS_STORE)) {
          console.log('Creating offline orders store');
          db.createObjectStore(OFFLINE_ORDERS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          console.log('Creating session store');
          db.createObjectStore(SESSION_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(ORDERS_STORE)) {
          console.log('Creating orders store');
          db.createObjectStore(ORDERS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(ORDER_ITEMS_STORE)) {
          console.log('Creating order items store');
          const store = db.createObjectStore(ORDER_ITEMS_STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('order_id', 'order_id', { unique: false });
        }
        if (!db.objectStoreNames.contains(BATCHES_STORE)) {
          console.log('Creating batches store');
          db.createObjectStore(BATCHES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(TRANSACTIONS_STORE)) {
          console.log('Creating transactions store');
          db.createObjectStore(TRANSACTIONS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(CUSTOMERS_STORE)) {
          console.log('Creating customers store');
          db.createObjectStore(CUSTOMERS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          console.log('Creating sync queue store');
          const store = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('order_id', 'order_id', { unique: false });
        }
        if (!db.objectStoreNames.contains(CONFIG_STORE)) {
          console.log('Creating config store');
          db.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  const db = await dbPromise;
  const missingStores = REQUIRED_STORES.filter(
    (store) => !db.objectStoreNames.contains(store)
  );
  if (!missingStores.length) {
    return db;
  }

  // If required stores are missing, reset the DB so onupgradeneeded can recreate.
  db.close();
  dbPromise = null;
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('IndexedDB delete blocked by another tab'));
  });
  return await initDB();
};

const withDbRetry = async (work) => {
  try {
    const db = await initDB();
    return await work(db);
  } catch (err) {
    if (err?.name !== 'InvalidStateError') {
      throw err;
    }
    dbPromise = null;
    const db = await initDB();
    return await work(db);
  }
};

export const saveProductsBulk = async (products) => {
  const list = Array.isArray(products) ? products : [];
  const normalized = list.map((product) => normalizeProduct(product));
  const safe = normalized.filter(Boolean);
  if (!safe.length) return 0;

  await withDbRetry(async (db) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    console.log('\u{1F4E5} Bulk inserting products');
    safe.forEach((product) => {
      store.put(product);
    });
    await waitForTransaction(transaction);
  });
  console.log('\u2705 Products saved successfully');
  return safe.length;
};

export const getAllCustomers = async () => {
  return await withDbRetry(async (db) => {
    const transaction = db.transaction([CUSTOMERS_STORE], 'readonly');
    const store = transaction.objectStore(CUSTOMERS_STORE);
    const result = await waitForRequest(store.getAll());
    return Array.isArray(result) ? result : [];
  });
};

export const saveCustomersBulk = async (customers) => {
  const list = Array.isArray(customers) ? customers : [];
  const normalized = list.map((customer) => normalizeCustomer(customer)).filter(Boolean);
  await withDbRetry(async (db) => {
    const transaction = db.transaction([CUSTOMERS_STORE], 'readwrite');
    const store = transaction.objectStore(CUSTOMERS_STORE);
    store.clear();
    normalized.forEach((entry) => store.put(entry));
    await waitForTransaction(transaction);
  });
  return normalized.length;
};
export const saveBatchesBulk = async (batches) => {
  const list = Array.isArray(batches) ? batches : [];
  const normalized = list.map((batch) => normalizeBatch(batch)).filter(Boolean);
  if (!normalized.length) return 0;
  await withDbRetry(async (db) => {
    const transaction = db.transaction([BATCHES_STORE], 'readwrite');
    const store = transaction.objectStore(BATCHES_STORE);
    store.clear();
    normalized.forEach((entry) => store.put(entry));
    await waitForTransaction(transaction);
  });
  return normalized.length;
};

export const getAllBatches = async () => {
  return await withDbRetry(async (db) => {
    const transaction = db.transaction([BATCHES_STORE], 'readonly');
    const store = transaction.objectStore(BATCHES_STORE);
    const result = await waitForRequest(store.getAll());
    return Array.isArray(result) ? result : [];
  });
};


export const upsertCustomersBulk = async (customers) => {
  const list = Array.isArray(customers) ? customers : [];
  const normalized = list.map((customer) => normalizeCustomer(customer)).filter(Boolean);
  if (!normalized.length) return 0;
  await withDbRetry(async (db) => {
    const transaction = db.transaction([CUSTOMERS_STORE], 'readwrite');
    const store = transaction.objectStore(CUSTOMERS_STORE);
    normalized.forEach((entry) => store.put(entry));
    await waitForTransaction(transaction);
  });
  return normalized.length;
};

export const getProductByBarcode = async (barcode) => {
  console.log('\u26A1 Fetching product from IndexedDB');
  if (!barcode) return null;
  return await withDbRetry(async (db) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    if (store.indexNames.contains('barcode')) {
      const index = store.index('barcode');
      const result = await waitForRequest(index.get(barcode));
      return result || null;
    }
    const result = await waitForRequest(store.get(barcode));
    return result || null;
  });
};

export const updateProduct = async (product) => {
  const normalized = normalizeProduct(product);
  if (!normalized) {
    throw new Error('Missing product identifier');
  }
  await withDbRetry(async (db) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const existing = await waitForRequest(store.get(normalized.id));
    const merged = existing
      ? Object.keys(normalized).reduce((acc, key) => {
          const value = normalized[key];
          acc[key] = value === undefined ? existing[key] : value;
          return acc;
        }, { ...existing })
      : normalized;
    store.put(merged);
    await waitForTransaction(transaction);
  });
};

export const getAllProducts = async () => {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const result = await waitForRequest(store.getAll());
  return Array.isArray(result) ? result : [];
};

export const updateProductsBulk = async (products) => {
  const list = Array.isArray(products) ? products : [];
  const normalized = list.map((product) => normalizeProduct(product));
  const safe = normalized.filter(Boolean);
  if (!safe.length) return 0;
  await withDbRetry(async (db) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const product of safe) {
      const existing = await waitForRequest(store.get(product.id));
      const merged = existing
        ? Object.keys(product).reduce((acc, key) => {
            const value = product[key];
            acc[key] = value === undefined ? existing[key] : value;
            return acc;
          }, { ...existing })
        : product;
      store.put(merged);
    }
    await waitForTransaction(transaction);
  });
  return safe.length;
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
    profit: transaction.profit ?? null,
    payment_mode: transaction.payment_mode ?? transaction.paymentMethod ?? transaction.payment_method ?? null,
    created_at: transaction.created_at ?? transaction.createdAt ?? new Date().toISOString(),
    status: transaction.status ?? null,
  };
};

export const saveTransactionsBulk = async (transactions) => {
  const list = Array.isArray(transactions) ? transactions : [];
  const normalized = list.map((item) => normalizeTransaction(item)).filter(Boolean);
  if (!normalized.length) return 0;
  await withDbRetry(async (db) => {
    const transaction = db.transaction([TRANSACTIONS_STORE], 'readwrite');
    const store = transaction.objectStore(TRANSACTIONS_STORE);
    normalized.forEach((item) => store.put(item));
    await waitForTransaction(transaction);
  });
  return normalized.length;
};

export const upsertTransaction = async (transaction) => {
  const normalized = normalizeTransaction(transaction);
  if (!normalized) {
    throw new Error('Missing id in transaction payload');
  }
  await withDbRetry(async (db) => {
    const tx = db.transaction([TRANSACTIONS_STORE], 'readwrite');
    const store = tx.objectStore(TRANSACTIONS_STORE);
    store.put(normalized);
    await waitForTransaction(tx);
  });
};

export const getTransactions = async () => {
  return await withDbRetry(async (db) => {
    const transaction = db.transaction([TRANSACTIONS_STORE], 'readonly');
    const store = transaction.objectStore(TRANSACTIONS_STORE);
    const result = await waitForRequest(store.getAll());
    return Array.isArray(result) ? result : [];
  });
};
const normalizeSessionKey = (key) => String(key || '').trim();

export const saveSessionValue = async (key, value) => {
  const normalized = normalizeSessionKey(key);
  if (!normalized) return;
  await withDbRetry(async (db) => {
    const transaction = db.transaction([SESSION_STORE], 'readwrite');
    const store = transaction.objectStore(SESSION_STORE);
    store.put({ key: normalized, value, updatedAt: new Date().toISOString() });
    await waitForTransaction(transaction);
  });
};

export const getSessionValue = async (key) => {
  const normalized = normalizeSessionKey(key);
  if (!normalized) return null;
  return await withDbRetry(async (db) => {
    const transaction = db.transaction([SESSION_STORE], 'readonly');
    const store = transaction.objectStore(SESSION_STORE);
    const result = await waitForRequest(store.get(normalized));
    return result ? result.value : null;
  });
};

export const clearSessionValue = async (key) => {
  const normalized = normalizeSessionKey(key);
  if (!normalized) return;
  await withDbRetry(async (db) => {
    const transaction = db.transaction([SESSION_STORE], 'readwrite');
    const store = transaction.objectStore(SESSION_STORE);
    store.delete(normalized);
    await waitForTransaction(transaction);
  });
};

export const clearSessionStore = async () => {
  await withDbRetry(async (db) => {
    const transaction = db.transaction([SESSION_STORE], 'readwrite');
    const store = transaction.objectStore(SESSION_STORE);
    store.clear();
    await waitForTransaction(transaction);
  });
};

export const getOfflineOrders = async () => {
  return await withDbRetry(async (db) => {
    const transaction = db.transaction([OFFLINE_ORDERS_STORE], 'readonly');
    const store = transaction.objectStore(OFFLINE_ORDERS_STORE);
    const result = await waitForRequest(store.getAll());
    return Array.isArray(result) ? result : [];
  });
};

export const saveOfflineOrdersBulk = async (orders) => {
  const list = Array.isArray(orders) ? orders : [];
  await withDbRetry(async (db) => {
    const transaction = db.transaction([OFFLINE_ORDERS_STORE], 'readwrite');
    const store = transaction.objectStore(OFFLINE_ORDERS_STORE);
    store.clear();
    list.forEach((entry) => store.put(entry));
    await waitForTransaction(transaction);
  });
  return list.length;
};

export const upsertOfflineOrder = async (entry) => {
  if (!entry || !entry.id) return;
  await withDbRetry(async (db) => {
    const transaction = db.transaction([OFFLINE_ORDERS_STORE], 'readwrite');
    const store = transaction.objectStore(OFFLINE_ORDERS_STORE);
    store.put(entry);
    await waitForTransaction(transaction);
  });
};

export const deleteOfflineOrdersByIds = async (ids) => {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return;
  await withDbRetry(async (db) => {
    const transaction = db.transaction([OFFLINE_ORDERS_STORE], 'readwrite');
    const store = transaction.objectStore(OFFLINE_ORDERS_STORE);
    list.forEach((id) => store.delete(id));
    await waitForTransaction(transaction);
  });
};














const normalizeConfigKey = (key) => String(key || '').trim();

export const saveConfigValue = async (key, value) => {
  const normalized = normalizeConfigKey(key);
  if (!normalized) return;
  await withDbRetry(async (db) => {
    const transaction = db.transaction([CONFIG_STORE], 'readwrite');
    const store = transaction.objectStore(CONFIG_STORE);
    store.put({ key: normalized, value, updatedAt: new Date().toISOString() });
    await waitForTransaction(transaction);
  });
};

export const getConfigValue = async (key) => {
  const normalized = normalizeConfigKey(key);
  if (!normalized) return null;
  return await withDbRetry(async (db) => {
    const transaction = db.transaction([CONFIG_STORE], 'readonly');
    const store = transaction.objectStore(CONFIG_STORE);
    const result = await waitForRequest(store.get(normalized));
    return result ? result.value : null;
  });
};
