import fs from 'fs';
import path from 'path';
import { canAccessSyncCenter } from './syncCenterAccess';

const readPage = () =>
  fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'SyncCenter.jsx'), 'utf8');

describe('V1 Sync Center presentation boundary', () => {
  test('only tenant admins receive the broad support console', () => {
    expect(canAccessSyncCenter({ role: 'admin' })).toBe(true);
    expect(canAccessSyncCenter({ role: 'manager' })).toBe(false);
    expect(canAccessSyncCenter({ role: 'cashier' })).toBe(false);
    expect(canAccessSyncCenter({ role: 'staff' })).toBe(false);
    expect(canAccessSyncCenter(null)).toBe(false);
  });

  test('restricted users receive an explicit denial instead of recovery controls', () => {
    const source = readPage();
    expect(source).toContain('if (!canAccessSyncCenter(userDetails))');
    expect(source).toContain('Sync Center is restricted to administrators');
    expect(source).toContain('Cashier transaction synchronization status remains available from the Orders screen');
    expect(source).toContain('return <SyncCenterContent />');
  });
});
