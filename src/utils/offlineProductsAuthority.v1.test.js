import {
  createOfflineProduct,
  updateOfflineProduct,
  deleteOfflineProduct,
} from './offlineProducts';
import { isLocalPosEnabled } from '../Repositories/local/posLocalApiClient';
import * as productLocal from '../services/local/productLocalService';
import * as inventorySync from './inventorySync';

jest.mock('../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: jest.fn(),
}));

jest.mock('../services/local/productLocalService', () => ({
  getAllBatches: jest.fn(),
  getAllProducts: jest.fn(),
  getProductCacheById: jest.fn(),
  updateBatchesBulk: jest.fn(),
  updateProductsBulk: jest.fn(),
  upsertLocalProduct: jest.fn(),
}));

jest.mock('./inventorySync', () => ({
  enqueueInventorySync: jest.fn(),
  processInventorySyncQueue: jest.fn(),
}));

describe('V1 local POS product mutation authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isLocalPosEnabled.mockReturnValue(true);
  });

  test.each([
    ['create', () => createOfflineProduct({ product_name: 'Tea', barcode: '1001' })],
    ['update', () => updateOfflineProduct({ id: '101', selling_price: 50 })],
    ['delete', () => deleteOfflineProduct('101')],
  ])('%s fails closed before browser product state or legacy sync can mutate', async (_name, action) => {
    await expect(action()).rejects.toMatchObject({
      code: 'CENTRAL_PRODUCT_AUTHORITY_REQUIRED',
      message: expect.stringContaining('Central product catalog'),
    });

    expect(productLocal.getAllProducts).not.toHaveBeenCalled();
    expect(productLocal.getProductCacheById).not.toHaveBeenCalled();
    expect(productLocal.updateProductsBulk).not.toHaveBeenCalled();
    expect(productLocal.updateBatchesBulk).not.toHaveBeenCalled();
    expect(productLocal.upsertLocalProduct).not.toHaveBeenCalled();
    expect(inventorySync.enqueueInventorySync).not.toHaveBeenCalled();
    expect(inventorySync.processInventorySyncQueue).not.toHaveBeenCalled();
  });
});
