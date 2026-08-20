describe('LocalPosProductRepository barcode lookup', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  const mockRepositoryDependencies = (localPosRequest) => {
    jest.doMock('./ApiProductRepository', () => ({
      ApiProductRepository: class ApiProductRepository {
        constructor() {
          this.cache = {
            getProductCacheByBarcode: jest.fn(async () => null),
            getProductCacheById: jest.fn(async () => null),
            updateProductsBulk: jest.fn(async () => {}),
          };
        }
      },
    }));
    jest.doMock('./local/posLocalApiClient', () => ({
      isLocalPosEnabled: () => true,
      localPosRequest,
    }));
  };

  test('strips scanner-added quote characters before local POS lookup', async () => {
    const localPosRequest = jest.fn(async (path) => {
      if (path === '/inventory/balances/665') {
        return { on_hand_milli: 7000, available_milli: 6500 };
      }
      return {
        id: '665',
        name: 'Samsung TV 55"',
        barcodes: ['8901234567891'],
        price: { amount_minor: 5500000 },
      };
    });
    mockRepositoryDependencies(localPosRequest);

    const { LocalPosProductRepository } = require('./LocalPosProductRepository');
    const repository = new LocalPosProductRepository();
    const product = await repository.getProductByBarcode('"8901234567891"');

    expect(localPosRequest).toHaveBeenCalledWith('/catalog/products/barcode/8901234567891');
    expect(localPosRequest).toHaveBeenCalledWith('/inventory/balances/665');
    expect(product.barcode).toBe('8901234567891');
    expect(product.selling_price).toBe(55000);
    expect(product.stock_quantity).toBe(7);
    expect(product.available_quantity).toBe(6.5);
    expect(product.__stock).toBe(7);
  });

  test('hydrates local POS catalog search results with SQLite inventory balances for billing stock checks', async () => {
    const localPosRequest = jest.fn(async (path) => {
      if (path.startsWith('/catalog/products?')) {
        return {
          items: [
            {
              id: '101',
              name: 'Catalog Rice',
              barcode: '101101',
              price: { amount_minor: 12500 },
            },
          ],
        };
      }
      if (path === '/inventory/balances/101') {
        return {
          store_id: 'store-1',
          product_id: '101',
          on_hand_milli: 12000,
          available_milli: 11500,
        };
      }
      return null;
    });
    mockRepositoryDependencies(localPosRequest);

    const { LocalPosProductRepository } = require('./LocalPosProductRepository');
    const repository = new LocalPosProductRepository();
    const products = await repository.searchLocalCatalog('rice');

    expect(localPosRequest).toHaveBeenCalledWith('/catalog/products?q=rice&limit=50');
    expect(localPosRequest).toHaveBeenCalledWith('/inventory/balances/101');
    expect(products).toEqual([
      expect.objectContaining({
        id: '101',
        stock_quantity: 12,
        quantity_remaining: 12,
        available_quantity: 11.5,
        __stock: 12,
      }),
    ]);
  });

  test('loads the SQLite catalog for inventory product lists in local POS mode', async () => {
    const localPosRequest = jest.fn(async (path) => {
      if (path === '/catalog/products?q=&limit=200') {
        return {
          items: [
            {
              id: '201',
              name: 'Inventory Soap',
              barcode: '201201',
              price: { amount_minor: 3500 },
            },
          ],
        };
      }
      if (path === '/inventory/balances/201') {
        return { on_hand_milli: 9000, available_milli: 9000 };
      }
      return null;
    });
    mockRepositoryDependencies(localPosRequest);

    const { LocalPosProductRepository } = require('./LocalPosProductRepository');
    const repository = new LocalPosProductRepository();
    const products = await repository.getAllProducts();

    expect(localPosRequest).toHaveBeenCalledWith('/catalog/products?q=&limit=200');
    expect(products).toEqual([
      expect.objectContaining({
        id: '201',
        name: 'Inventory Soap',
        stock_quantity: 9,
      }),
    ]);
  });

  test('keeps catalog products visible when inventory balance lookup is missing', async () => {
    const localPosRequest = jest.fn(async (path) => {
      if (path === '/catalog/products?q=&limit=200') {
        return {
          items: [
            {
              id: '301',
              name: 'Uninitialized Stock Item',
              barcode: '301301',
              price: { amount_minor: 1000 },
            },
          ],
        };
      }
      throw new Error('inventory_balance_failed');
    });
    mockRepositoryDependencies(localPosRequest);

    const { LocalPosProductRepository } = require('./LocalPosProductRepository');
    const repository = new LocalPosProductRepository();
    const products = await repository.getAllProducts();

    expect(products).toEqual([
      expect.objectContaining({
        id: '301',
        name: 'Uninitialized Stock Item',
      }),
    ]);
  });

  test('returns null for local POS product_not_found instead of throwing runtime error', async () => {
    const notFound = new Error('product_not_found');
    notFound.status = 404;
    notFound.payload = { error: 'product_not_found' };
    mockRepositoryDependencies(jest.fn(async () => {
      throw notFound;
    }));

    const { LocalPosProductRepository } = require('./LocalPosProductRepository');
    const repository = new LocalPosProductRepository();

    await expect(repository.getProductByBarcode('missing-code')).resolves.toBeNull();
  });
});
