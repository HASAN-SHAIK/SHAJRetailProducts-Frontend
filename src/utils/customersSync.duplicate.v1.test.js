jest.mock('../services/local/syncLocalService', () => ({
  getSyncQueueItems: jest.fn(),
  replaceCustomerIdReferences: jest.fn(),
  updateSyncQueueItem: jest.fn(),
}));
jest.mock('../Repositories/api/customerApiClient', () => ({
  createCustomerRemote: jest.fn(),
  updateCustomerRemote: jest.fn(),
}));

const sync = require('../services/local/syncLocalService');
const api = require('../Repositories/api/customerApiClient');
const { syncAllCustomers } = require('./customersSync');

const duplicate409 = () => ({
  response: {
    status: 409,
    data: { success: false, error: { code: 'DUPLICATE_CUSTOMER', details: { existing_customer: { id: 77, name: 'Existing' } } } },
  },
});

const queued = (extra = {}) => ({
  id: 1,
  type: 'customer',
  action: 'create',
  entityId: 'temp:abc',
  status: 'pending',
  payload: { name: 'Quick', phone: '9000000001' },
  ...extra,
});

beforeEach(() => {
  Object.defineProperty(global.navigator, 'onLine', { value: true, configurable: true });
  sync.getSyncQueueItems.mockReset();
  sync.replaceCustomerIdReferences.mockReset();
  sync.updateSyncQueueItem.mockReset();
  api.createCustomerRemote.mockReset();
  api.updateCustomerRemote.mockReset();
});

describe('customer sync worker with a server-side duplicate', () => {
  test('409 maps the temp customer to the existing one, closes the item, never updates it', async () => {
    sync.getSyncQueueItems.mockResolvedValue([queued()]);
    api.createCustomerRemote.mockRejectedValue(duplicate409());

    const result = await syncAllCustomers();

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(sync.replaceCustomerIdReferences).toHaveBeenCalledWith('temp:abc', 77);
    expect(api.updateCustomerRemote).not.toHaveBeenCalled();
    const last = sync.updateSyncQueueItem.mock.calls[sync.updateSyncQueueItem.mock.calls.length - 1][0];
    expect(last.status).toBe('done');
    expect(last.duplicateOf).toBe(77);
  });

  test('other failures are still retried with error status', async () => {
    sync.getSyncQueueItems.mockResolvedValue([queued()]);
    api.createCustomerRemote.mockRejectedValue({ response: { status: 500 } });

    const result = await syncAllCustomers();

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(sync.replaceCustomerIdReferences).not.toHaveBeenCalled();
    const last = sync.updateSyncQueueItem.mock.calls[sync.updateSyncQueueItem.mock.calls.length - 1][0];
    expect(last.status).toBe('error');
  });

  test('a normal create still remaps the temp id to the new id', async () => {
    sync.getSyncQueueItems.mockResolvedValue([queued()]);
    api.createCustomerRemote.mockResolvedValue({ id: 99 });

    const result = await syncAllCustomers();

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(sync.replaceCustomerIdReferences).toHaveBeenCalledWith('temp:abc', 99);
  });
});
