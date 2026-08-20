import { ApiProductRepository } from './ApiProductRepository';
import { isLocalPosEnabled, localPosRequest } from './local/posLocalApiClient';

const normalizeBarcode = (barcode) =>
  String(barcode || '').trim().replace(/^["']+|["']+$/g, '').trim();

const normalizeProduct = (product) => {
  if (!product) return product;
  const price = product.price || null;
  const primaryBarcode = product.barcode || (Array.isArray(product.barcodes) ? product.barcodes[0] : undefined);
  const onHand =
    product.stock_quantity ??
    product.stockQuantity ??
    product.quantity_remaining ??
    product.quantityRemaining ??
    product.available_quantity ??
    product.availableQuantity ??
    product.stock ??
    product.quantity ??
    null;
  return {
    ...product,
    barcode: primaryBarcode,
    product_id: product.product_id || product.id,
    selling_price: product.selling_price ?? (price ? Number(price.amount_minor || 0) / 100 : undefined),
    price: product.selling_price ?? (price ? Number(price.amount_minor || 0) / 100 : product.price),
    stock_quantity: onHand,
    __stock: onHand,
  };
};

const milliToQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 1000 : null;
};

const hydrateProductStock = async (product) => {
  const normalized = normalizeProduct(product);
  const productId = normalized?.product_id || normalized?.id;
  if (!normalized || !productId) return normalized;

  try {
    const balance = await localPosRequest(`/inventory/balances/${encodeURIComponent(String(productId).trim())}`);
    const onHand = milliToQuantity(balance?.on_hand_milli);
    const available = milliToQuantity(balance?.available_milli);
    if (!Number.isFinite(onHand) && !Number.isFinite(available)) return normalized;
    const stock = Number.isFinite(onHand) ? onHand : available;
    return {
      ...normalized,
      stock_quantity: stock,
      quantity_remaining: stock,
      available_quantity: Number.isFinite(available) ? available : stock,
      __stock: stock,
      stock_balance: balance,
    };
  } catch {
    return normalized;
  }
};

/** Sources sale-time catalog data from the local POSService/SQLite API. */
export class LocalPosProductRepository extends ApiProductRepository {
  async updateBatchesBulk(batches) {
    if (isLocalPosEnabled()) {
      const error = new Error('Batch changes are Central-authoritative while local POS mode is enabled.');
      error.code = 'LOCAL_POS_BATCH_MUTATION_CENTRAL_ONLY';
      throw error;
    }
    return super.updateBatchesBulk(batches);
  }

  async searchLocalCatalog(search = '', limit = 50) {
    if (!isLocalPosEnabled()) return [];
    const query = String(search || '').trim();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
    const payload = await localPosRequest(
      `/catalog/products?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(safeLimit))}`
    );
    const catalogProducts = Array.isArray(payload?.items) ? payload.items : [];
    const products = await Promise.all(catalogProducts.map(hydrateProductStock));
    if (products.length) await this.cache.updateProductsBulk(products).catch(() => {});
    return products;
  }

  async getAllProducts() {
    if (!isLocalPosEnabled()) return super.getAllProducts();
    return this.searchLocalCatalog('', 200);
  }

  async getProductByBarcode(barcode, branchId = null) {
    if (!isLocalPosEnabled()) return super.getProductByBarcode(barcode, branchId);
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) return null;
    let product = null;
    try {
      product = await hydrateProductStock(
        await localPosRequest(`/catalog/products/barcode/${encodeURIComponent(normalizedBarcode)}`)
      );
    } catch (error) {
      if (error?.status === 404 || error?.message === 'product_not_found' || error?.payload?.error === 'product_not_found') {
        return null;
      }
      throw error;
    }
    if (product) await this.cache.updateProductsBulk([product]).catch(() => {});
    return product;
  }

  async getProductCacheByBarcode(barcode) {
    const cached = await this.cache.getProductCacheByBarcode(barcode);
    if (cached) return cached;
    return this.getProductByBarcode(barcode);
  }

  async getProductCacheById(productId) {
    const cached = await this.cache.getProductCacheById(productId);
    if (cached || !isLocalPosEnabled()) return cached || super.getProductCacheById(productId);
    const product = await hydrateProductStock(
      await localPosRequest(`/catalog/products/${encodeURIComponent(String(productId || '').trim())}`)
    );
    if (product) await this.cache.updateProductsBulk([product]).catch(() => {});
    return product;
  }
}
