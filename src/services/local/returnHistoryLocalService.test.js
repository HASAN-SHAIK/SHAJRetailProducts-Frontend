jest.mock('../../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: jest.fn(() => true),
  localPosRequest: jest.fn(),
}));

import { localPosRequest } from '../../Repositories/local/posLocalApiClient';
import { getLocalOrderReturnHistory } from './returnHistoryLocalService';

describe('local POS return history client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads the permission-protected order return history endpoint', async () => {
    localPosRequest.mockResolvedValue({
      count: 1,
      items: [{ return_id: 'ret-1', approved_by_user_id: 'manager-1' }],
    });

    const result = await getLocalOrderReturnHistory('ord 1');

    expect(localPosRequest).toHaveBeenCalledWith('/orders/ord%201/returns', { method: 'GET' });
    expect(result.count).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  test('normalizes missing response arrays without inventing history', async () => {
    localPosRequest.mockResolvedValue({});
    await expect(getLocalOrderReturnHistory('ord-2')).resolves.toEqual({ count: 0, items: [] });
  });

  test('fails before requesting when order identity is missing', async () => {
    await expect(getLocalOrderReturnHistory('   ')).rejects.toThrow('order_id_required');
    expect(localPosRequest).not.toHaveBeenCalled();
  });
});
