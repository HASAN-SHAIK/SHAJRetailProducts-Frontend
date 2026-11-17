jest.mock('axios', () => ({
  create: () => ({
    get: jest.fn(),
    post: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  }),
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('./axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import {
  detectDeviceProfile,
  getPermissionPreference,
  savePermissionPreference,
  clearPermissionPreference,
  getOfflineDatabaseStatus,
  DEPENDENCY_STEPS,
  POS_OFFLINE_DB_STORAGE_KEYS,
} from './posDatabaseDownloader';

describe('POS Database & Dependencies Downloader', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Device Detection', () => {
    test('detects mobile device when mobile userAgent matches', () => {
      const mockNav = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', maxTouchPoints: 5 };
      const mockWin = { innerWidth: 390, innerHeight: 844, matchMedia: (query) => ({ matches: query.includes('768') }) };

      const profile = detectDeviceProfile(mockNav, mockWin);
      expect(profile.isMobile).toBe(true);
      expect(profile.type).toBe('mobile');
      expect(profile.icon).toBe('📱');
      expect(profile.label).toContain('Mobile');
    });

    test('detects laptop / desktop workstation on large screens with desktop userAgent', () => {
      const mockNav = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115.0.0.0', maxTouchPoints: 0 };
      const mockWin = { innerWidth: 1440, innerHeight: 900, matchMedia: () => ({ matches: false }) };

      const profile = detectDeviceProfile(mockNav, mockWin);
      expect(profile.isMobile).toBe(false);
      expect(profile.type).toBe('laptop');
      expect(profile.icon).toBe('💻');
      expect(profile.label).toContain('Laptop');
    });

    test('falls back gracefully when window/navigator are missing', () => {
      const profile = detectDeviceProfile(null, null);
      expect(profile.type).toBe('laptop');
      expect(profile.isMobile).toBe(false);
    });
  });

  describe('Permission Preferences', () => {
    test('returns null choice if no preference has been saved', () => {
      const pref = getPermissionPreference();
      expect(pref.choice).toBeNull();
      expect(pref.remember).toBe(false);
    });

    test('saves and retrieves download permission when remember is true', () => {
      savePermissionPreference('download', true);
      const pref = getPermissionPreference();
      expect(pref.choice).toBe('download');
      expect(pref.remember).toBe(true);
    });

    test('saves and retrieves skip choice when remember is true', () => {
      savePermissionPreference('skip', true);
      const pref = getPermissionPreference();
      expect(pref.choice).toBe('skip');
      expect(pref.remember).toBe(true);
    });

    test('does not return saved choice if remember was false', () => {
      savePermissionPreference('download', false);
      const pref = getPermissionPreference();
      expect(pref.choice).toBeNull();
      expect(pref.remember).toBe(false);
    });

    test('clearPermissionPreference removes stored preferences', () => {
      savePermissionPreference('download', true);
      clearPermissionPreference();
      const pref = getPermissionPreference();
      expect(pref.choice).toBeNull();
    });
  });

  describe('Dependency Steps Definition', () => {
    test('exposes 6 clear sequential dependencies for offline POS initialization', () => {
      expect(DEPENDENCY_STEPS).toHaveLength(6);
      const ids = DEPENDENCY_STEPS.map((s) => s.id);
      expect(ids).toEqual([
        'config',
        'products',
        'inventory',
        'customers',
        'accounting_tax',
        'offline_engine',
      ]);
    });
  });

  describe('Offline Database Status', () => {
    test('reports not ready when no database has been downloaded yet', () => {
      const status = getOfflineDatabaseStatus();
      expect(status.isReady).toBe(false);
      expect(status.lastDownloadedAt).toBeNull();
    });

    test('reports ready and timestamps when database was previously downloaded', () => {
      const now = new Date().toISOString();
      localStorage.setItem(POS_OFFLINE_DB_STORAGE_KEYS.LAST_DOWNLOADED_AT, now);
      localStorage.setItem(POS_OFFLINE_DB_STORAGE_KEYS.LAST_DEVICE_TYPE, 'laptop');

      const status = getOfflineDatabaseStatus();
      expect(status.isReady).toBe(true);
      expect(status.lastDownloadedAt).toBe(now);
      expect(status.lastDevice).toBe('laptop');
    });
  });
});
