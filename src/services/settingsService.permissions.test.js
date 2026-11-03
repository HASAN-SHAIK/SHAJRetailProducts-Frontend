import api from '../utils/axios';
import { getSettings } from './settingsService';

jest.mock('../utils/axios', () => ({ get: jest.fn() }));
jest.mock('../Repositories/api/applicationSettingsApiClient', () => ({
  fetchApplicationSettingsRemote: jest.fn(),
  updateApplicationSettingsRemote: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

test('cashier setup never sends an unauthorized settings request', async () => {
  await expect(getSettings({ role: 'cashier', permissions: ['pos:sale'] }))
    .rejects.toMatchObject({ code: 'SETTINGS_READ_NOT_PERMITTED' });
  expect(api.get).not.toHaveBeenCalled();
});

test('screens using the stored cashier session also avoid the request', async () => {
  localStorage.setItem('session_info', JSON.stringify({
    user: { role: 'cashier', permissions: ['pos:sale'] },
  }));
  await expect(getSettings()).rejects.toMatchObject({ code: 'SETTINGS_READ_NOT_PERMITTED' });
  expect(api.get).not.toHaveBeenCalled();
});

test.each([['settings:read'], ['*']])('authorized settings readers still fetch settings: %s', async (permission) => {
  api.get.mockResolvedValue({ data: { success: true, data: { is_opening_completed: true } } });
  await getSettings({ permissions: [permission] });
  expect(api.get).toHaveBeenCalledWith('/settings');
});
