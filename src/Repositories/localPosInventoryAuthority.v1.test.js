import { LocalPosInventoryRepository } from './LocalPosInventoryRepository';
import { localPosRequest } from './local/posLocalApiClient';

jest.mock('./local/posLocalApiClient', () => ({
  localPosRequest: jest.fn(),
}));

describe('V1 local POS inventory authority', () => {
  beforeEach(() => {
    localPosRequest.mockReset();
  });

  test('reads operator stock truth from the authenticated POS SQLite balance endpoint', async () => {
    localPosRequest.mockResolvedValue({
      store_id: 'store-1',
      product_id: '101',
      on_hand_milli: 3500,
      reserved_milli: 500,
      available_milli: 3000,
      version: 7,
      updated_at: '2026-08-17T00:00:00Z',
    });

    const repository = new LocalPosInventoryRepository();
    const rows = await repository.getBranchStock(101);

    expect(localPosRequest).toHaveBeenCalledWith('/inventory/balances/101');
    expect(rows).toEqual([
      expect.objectContaining({
        branch_id: 'store-1',
        quantity: 3.5,
        on_hand_milli: 3500,
        reserved_milli: 500,
        available_milli: 3000,
        version: 7,
      }),
    ]);
  });

  test('does not turn the POS edge into stock consistency or intelligence authority', async () => {
    const repository = new LocalPosInventoryRepository();
    await expect(repository.runStockConsistency()).rejects.toMatchObject({ code: 'LOCAL_POS_INVENTORY_READ_ONLY' });
    await expect(repository.fetchInventoryIntelligence()).rejects.toMatchObject({ code: 'LOCAL_POS_INVENTORY_READ_ONLY' });
  });
});
