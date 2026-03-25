const DB_NAME = 'shajretaildb';
const DB_VERSION = 3;
const STORE_NAME = 'products';
const OFFLINE_ORDERS_STORE = 'offline_orders';
const SESSION_STORE = 'session';

let dbPromise = null;

const normalizeProduct = (product) => {
  if (!product || !product.barcode) return null;
  return {
    id: product.id,
    name: product.name ?? product.product_name,
    company: product.company ?? product.company_name,
    barcode: product.barcode,
    selling_price: product.selling_price,
    actual_price: product.actual_price,
    expiry_date: product.expiry_date ?? product.expiryDate ?? null,
    stock_quantity: product.stock_quantity,
    is_weight_based: product.is_weight_based,
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
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          console.log('\u{1F9F1} Creating products store');
          db.createObjectStore(STORE_NAME, { keyPath: 'barcode' });
        }
        if (!db.objectStoreNames.contains(OFFLINE_ORDERS_STORE)) {
          console.log('\u{1F9F1} Creating offline orders store');
          db.createObjectStore(OFFLINE_ORDERS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          console.log('\u{1F9F1} Creating session store');
          db.createObjectStore(SESSION_STORE, { keyPath: 'key' });
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

  return dbPromise;
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
  if (normalized.some((item) => !item)) {
    throw new Error('Missing barcode in product payload');
  }

  await withDbRetry(async (db) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    console.log('\u{1F4E5} Bulk inserting products');
    normalized.forEach((product) => {
      store.put(product);
    });
    await waitForTransaction(transaction);
  });
  console.log('\u2705 Products saved successfully');
  return normalized.length;
};

export const getProductByBarcode = async (barcode) => {
  console.log('\u26A1 Fetching product from IndexedDB');
  if (!barcode) return null;
  return await withDbRetry(async (db) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const result = await waitForRequest(store.get(barcode));
    return result || null;
  });
};

export const updateProduct = async (product) => {
  const normalized = normalizeProduct(product);
  if (!normalized) {
    throw new Error('Missing barcode in product payload');
  }
  await withDbRetry(async (db) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(normalized);
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
  if (normalized.some((item) => !item)) {
    throw new Error('Missing barcode in product payload');
  }
  await withDbRetry(async (db) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    normalized.forEach((product) => {
      store.put(product);
    });
    await waitForTransaction(transaction);
  });
  return normalized.length;
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



