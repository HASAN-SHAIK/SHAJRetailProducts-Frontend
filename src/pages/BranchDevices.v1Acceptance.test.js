const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'BranchDevices.jsx'), 'utf8');

describe('V1 Store/Device frontend authority', () => {
  test('keeps administrative device operations admin-only and Central-authoritative', () => {
    expect(source).toContain("if (userRole !== 'admin')");
    expect(source).toContain('Admin access only.');
    expect(source).toContain('await api.post(`/branches/${effectiveBranchId}/devices/register`');
    expect(source).toContain('await api.patch(`/branches/${effectiveBranchId}/devices/${deviceId}/deactivate`)');
  });

  test('uses the physical POS device identity and binds locally only after Central accepts the full business identity', () => {
    const centralRegistration = source.indexOf('await api.post(`/branches/${effectiveBranchId}/devices/register`');
    const localBinding = source.indexOf('const registered = await registerLocalPosDevice');

    expect(source).toContain('device_id: device.device_id');
    expect(source).toContain('store_number: storeNumber');
    expect(source).toContain('pos_no: normalizedPosNo');
    expect(source).toContain('touchpoint_id: normalizedTouchpoint');
    expect(centralRegistration).toBeGreaterThan(-1);
    expect(localBinding).toBeGreaterThan(centralRegistration);
  });

  test('blocks implicit cross-store reassignment and exposes Store POS Touchpoint identity', () => {
    expect(source).toContain('Reassignment must be performed explicitly.');
    expect(source).toContain('Automatic cross-store reassignment is blocked');
    expect(source).toContain("Installation: <span className=\"device-code\">{localDevice.installation_id || '—'}</span>");
    expect(source).toContain("Store: <strong>{localDevice.store_number || 'Not assigned'}</strong>");
    expect(source).toContain("POS: <strong>{localDevice.pos_no || localDevice.terminal_id || 'Not assigned'}</strong>");
    expect(source).toContain("Touchpoint: <strong>{localDevice.touchpoint_id || 'Not assigned'}</strong>");
  });

  test('shows licensing, loading and actionable Central/local errors without inventing browser authority', () => {
    expect(source).toContain('subscription_plan');
    expect(source).toContain('resolved_limit');
    expect(source).toContain("{isLoading ? 'Refreshing...' : 'Refresh'}");
    expect(source).toContain("setError(err?.response?.data?.message || 'Failed to load devices')");
    expect(source).toContain('Local POS token is unavailable. Start this screen from the configured POS runtime.');
  });
});
