import {
  __setDevelopmentPosProfilePortForTests,
  clearLocalPosSession,
  getCachedLocalPosUserId,
  getDevelopmentPosProfile,
  getLocalPosDevice,
  localPosRequest,
  loginLocalPosUser,
  registerLocalPosDevice,
  requestLocalManagerApproval,
} from './posLocalApiClient';

const jsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(payload),
});

describe('local POS API client security contract', () => {
  beforeEach(() => {
    __setDevelopmentPosProfilePortForTests(null);
    window.sessionStorage.clear();
    window.localStorage.clear();
    process.env.REACT_APP_POS_LOCAL_API_TOKEN = 'machine-token-test';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    __setDevelopmentPosProfilePortForTests(null);
    delete process.env.REACT_APP_POS_LOCAL_API_TOKEN;
    jest.restoreAllMocks();
  });

  const setLocationPort = (port) => {
    __setDevelopmentPosProfilePortForTests(port);
  };

  test('local login uses machine trust without a cashier session and caches only returned session token/user id', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      session_token: 'cashier-session-token',
      user: { user_id: 'user-42', role: 'cashier' },
    }));

    await loginLocalPosUser({ userId: 'user-42', pin: '1234' });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['X-POS-Local-Token']).toBe('machine-token-test');
    expect(options.headers['X-POS-Session-Token']).toBeUndefined();
    expect(options.body).toBe(JSON.stringify({ user_id: 'user-42', pin: '1234' }));
    expect(window.sessionStorage.getItem('pos_local_session_token')).toBe('cashier-session-token');
    expect(getCachedLocalPosUserId()).toBe('user-42');
  });

  test('development tabs bind to their own POS profile and scoped local session cache', async () => {
    setLocationPort(3001);
    global.fetch.mockResolvedValue(jsonResponse({
      session_token: 'pos1-session-token',
      user: { user_id: 'user-42', role: 'cashier' },
    }));

    expect(getDevelopmentPosProfile()).toMatchObject({ label: 'POS1', deviceId: 'SIM-POS-DTN-01' });
    await loginLocalPosUser({ userId: 'user-42', pin: '1234' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:4781/api/v1/auth/login');
    expect(options.headers['X-POS-Session-Token']).toBeUndefined();
    expect(window.sessionStorage.getItem('pos_local_session_token')).toBeNull();
    expect(window.sessionStorage.getItem('pos_local_session_token:pos1')).toBe('pos1-session-token');
    expect(window.localStorage.getItem('pos_local_user_id:pos1')).toBe('user-42');
  });

  test('device identity lookup uses machine trust without a cashier session', async () => {
    setLocationPort(3000);
    global.fetch.mockResolvedValue(jsonResponse({
      device_id: 'dev_pos_1',
      store_id: 'store-1',
    }));

    const device = await getLocalPosDevice();

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/device');
    expect(options.headers['X-POS-Local-Token']).toBe('machine-token-test');
    expect(options.headers['X-POS-Session-Token']).toBeUndefined();
    expect(device.device_id).toBe('dev_pos_1');
  });

  test('development device lookup fails when the tab reaches the wrong POS service', async () => {
    setLocationPort(3002);
    global.fetch.mockResolvedValue(jsonResponse({
      device_id: 'SIM-POS-DTN-01',
      store_id: '11111111-1111-4111-8111-111111111111',
      terminal_id: 'T01',
    }));

    await expect(getLocalPosDevice()).rejects.toMatchObject({
      code: 'DEV_POS_PROFILE_MISMATCH',
      profile: expect.objectContaining({ label: 'POS2' }),
    });
  });

  test('device registration uses machine trust and binds store plus terminal without a cashier session', async () => {
    global.fetch.mockResolvedValue(jsonResponse({
      device_id: 'dev_pos_1',
      store_id: 'store-1',
      terminal_id: 'POS-01',
      status: 'active',
    }));

    const device = await registerLocalPosDevice({ storeId: 'store-1', terminalId: ' POS-01 ' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/device/registration');
    expect(options.method).toBe('PUT');
    expect(options.headers['X-POS-Local-Token']).toBe('machine-token-test');
    expect(options.headers['X-POS-Session-Token']).toBeUndefined();
    expect(JSON.parse(options.body)).toEqual({ store_id: 'store-1', terminal_id: 'POS-01' });
    expect(device.status).toBe('active');
  });

  test('business requests send both machine token and verified local cashier session token', async () => {
    window.sessionStorage.setItem('pos_local_session_token', 'cashier-session-token');
    global.fetch.mockResolvedValue(jsonResponse({ id: 'ord-1' }));

    await localPosRequest('/orders/ord-1');

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['X-POS-Local-Token']).toBe('machine-token-test');
    expect(options.headers['X-POS-Session-Token']).toBe('cashier-session-token');
    expect(options.headers['X-POS-User-ID']).toBeUndefined();
    expect(options.headers['X-POS-Permissions']).toBeUndefined();
  });

  test('business requests fail closed when no local cashier session exists', async () => {
    clearLocalPosSession();

    await expect(localPosRequest('/orders')).rejects.toThrow('local_pos_session_unavailable');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('manager approval is requested under the cashier session without replacing it', async () => {
    window.sessionStorage.setItem('pos_local_session_token', 'cashier-session-token');
    global.fetch.mockResolvedValue(jsonResponse({
      approval_token: 'single-use-token',
      approver_user_id: 'manager-7',
      permission: 'pos:discount',
    }, 201));

    const result = await requestLocalManagerApproval({
      managerUserId: 'manager-7',
      pin: '2468',
      permission: 'pos:discount',
      reason: 'customer retention',
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/auth/approvals');
    expect(options.headers['X-POS-Session-Token']).toBe('cashier-session-token');
    expect(JSON.parse(options.body)).toEqual({
      manager_user_id: 'manager-7',
      pin: '2468',
      permission: 'pos:discount',
      reason: 'customer retention',
    });
    expect(result.approval_token).toBe('single-use-token');
    expect(window.sessionStorage.getItem('pos_local_session_token')).toBe('cashier-session-token');
  });

  test('approval token is attached only to the explicitly retried business request', async () => {
    window.sessionStorage.setItem('pos_local_session_token', 'cashier-session-token');
    global.fetch.mockResolvedValue(jsonResponse({ id: 'ord-1' }, 201));

    await localPosRequest('/orders', {
      method: 'POST',
      approvalToken: 'single-use-token',
      body: { items: [{ discount_minor: 250 }] },
    });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['X-POS-Approval-Token']).toBe('single-use-token');
    expect(window.sessionStorage.getItem('pos_local_session_token')).toBe('cashier-session-token');
  });
});
