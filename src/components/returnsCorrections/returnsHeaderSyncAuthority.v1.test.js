const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'ReturnsHeader.jsx'), 'utf8');

describe('V1 returns header sync authority', () => {
  test('local POS mode blocks the legacy browser returns synchronizer', () => {
    const authorityGuard = source.indexOf('if (localPosAuthoritative)');
    const legacySync = source.indexOf('await syncAllReturnsCorrections()');

    expect(source).toContain("isLocalPosEnabled");
    expect(authorityGuard).toBeGreaterThan(-1);
    expect(legacySync).toBeGreaterThan(authorityGuard);
    expect(source).toContain('Local POS synchronization is automatic');
  });

  test('local POS mode exposes automatic read-only sync state instead of a mutation control', () => {
    expect(source).toContain('disabled={syncing || localPosAuthoritative}');
    expect(source).toContain("localPosAuthoritative ? 'POS Sync Automatic'");
    expect(source).toContain("Use Sync Center diagnostics for sync state");
  });

  test('legacy manual sync remains available only outside local POS mode', () => {
    expect(source).toContain("syncing ? 'Syncing...' : 'Sync Now'");
    expect(source).toContain("showPopup('Synced Successfully', 'Success')");
    expect(source).toContain("showPopup('Sync failed. Try again.', 'Error')");
  });
});
