import { searchLocalProducts } from './localProductSearch';
import { isLocalPosEnabled, localPosRequest } from '../Repositories/local/posLocalApiClient';
import { db } from '../core/db';

jest.mock('../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: jest.fn(),
  localPosRequest: jest.fn(),
}));

jest.mock('../core/db', () => ({
  db: {
    products_cache: {
      where: jest.fn(),
      filter: jest.fn(),
    },
  },
}));

describe('V1 cashier product text search authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('packaged local POS mode searches the POS SQLite catalog and does not read browser product cache', async () => {
    isLocalPosEnabled.mockReturnValue(true);
    localPosRequest.mockResolvedValue({
      items: [
        {
          id: '101',
          name: 'Tea Powder',
          sku: 'TEA-101',
          barcodes: ['8901001'],
          is_active: true,
          price: { amount_minor: 5550, currency: 'INR', tax_inclusive: true },
        },
      ],
    });

    const products = await searchLocalProducts('tea');

    expect(localPosRequest).toHaveBeenCalledWith('/catalog/products?q=tea&limit=50');
    expect(db.products_cache.where).not.toHaveBeenCalled();
    expect(db.products_cache.filter).not.toHaveBeenCalled();
    expect(products).toEqual([
      expect.objectContaining({
        id: '101',
        product_id: '101',
        name: 'Tea Powder',
        barcode: '8901001',
        selling_price: 55.5,
        price: 55.5,
      }),
    ]);
  });

  test('legacy non-local-POS mode retains browser cache search', async () => {
    isLocalPosEnabled.mockReturnValue(false);
    const toArray = jest.fn().mockResolvedValue([{ id: 'legacy-1', name: 'Tea', barcode: '1001' }]);
    const equals = jest.fn(() => ({ toArray }));
    db.products_cache.where.mockReturnValue({ equals });

    const products = await searchLocalProducts('1001');

    expect(localPosRequest).not.toHaveBeenCalled();
    expect(db.products_cache.where).toHaveBeenCalledWith('barcode');
    expect(products).toEqual([expect.objectContaining({ id: 'legacy-1' })]);
  });
});
