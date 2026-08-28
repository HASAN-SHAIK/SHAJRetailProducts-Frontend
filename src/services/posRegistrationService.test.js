import {
  getPosRegistrationStatus,
  requestPosRegistration,
} from './posRegistrationService';

const jsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(payload),
});

describe('POS registration service', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn();
    jest.spyOn(Date, 'now').mockReturnValue(100000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('throttles automatic pending status checks and bypasses cache for manual checks', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({
        request_id: 'posreg-1',
        request_token: 'token-1',
        status: 'PENDING',
      }))
      .mockResolvedValueOnce(jsonResponse({
        request_id: 'posreg-1',
        status: 'APPROVED',
        branch_id: 'branch-1',
      }));

    const pending = await requestPosRegistration({
      tenantId: 'tenant-1',
      device: { device_id: 'device-1', installation_id: 'install-1', device_name: 'POS 1' },
      storeNumber: 'store-1',
      posNo: 'pos-1',
      touchpointId: 'tp-1',
    });

    const automatic = await getPosRegistrationStatus(pending);
    const manual = await getPosRegistrationStatus(pending, { force: true });

    expect(automatic).toBe(pending);
    expect(manual.status).toBe('APPROVED');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][1].cache).toBe('no-store');
    expect(global.fetch.mock.calls[1][1].cache).toBe('no-store');
  });
});
