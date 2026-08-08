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
    const localPosRequest = jest.fn(async () => ({
      id: '665',
      name: 'Samsung TV 55"',
      barcodes: ['8901234567891'],
      price: { amount_minor: 5500000 },
    }));
    mockRepositoryDependencies(localPosRequest);

    const { LocalPosProductRepository } = require('./LocalPosProductRepository');
    const repository = new LocalPosProductRepository();
    const product = await repository.getProductByBarcode('"8901234567891"');

    expect(localPosRequest).toHaveBeenCalledWith('/catalog/products/barcode/8901234567891');
    expect(product.barcode).toBe('8901234567891');
    expect(product.selling_price).toBe(55000);
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
