import fs from 'fs';
import path from 'path';

describe('Area 2 Responsive Foundations Policy (Login, Setup, Devices, Sync, Support)', () => {
  test('Login component enforces numeric inputMode on tenant ID', () => {
    const loginSource = fs.readFileSync(
      path.resolve(__dirname, '../components/Login/Login.js'),
      'utf8'
    );
    expect(loginSource).toContain('inputMode="numeric"');
  });

  test('Login.css provides single-column layout and touch targets for mobile', () => {
    const loginCss = fs.readFileSync(
      path.resolve(__dirname, '../components/Login/Login.css'),
      'utf8'
    );
    expect(loginCss).toContain('grid-template-columns: 1fr;');
    expect(loginCss).toContain('min-height: 44px;');
    expect(loginCss).toContain('touch-action: manipulation;');
  });

  test('BranchDevices.css provides responsive table scrolling and touch targets', () => {
    const devicesCss = fs.readFileSync(
      path.resolve(__dirname, './BranchDevices.css'),
      'utf8'
    );
    expect(devicesCss).toContain('@media (max-width: 768px)');
    expect(devicesCss).toContain('overflow-x: auto;');
    expect(devicesCss).toContain('min-height: 44px;');
  });

  test('SyncCenter.css provides mobile touch targets and table wrapping', () => {
    const syncCss = fs.readFileSync(
      path.resolve(__dirname, './SyncCenter.css'),
      'utf8'
    );
    expect(syncCss).toContain('@media (max-width: 768px)');
    expect(syncCss).toContain('sync-table-wrap');
    expect(syncCss).toContain('overflow-x: auto;');
    expect(syncCss).toContain('min-height: 44px;');
  });

  test('SupportPage.css provides full-width mobile drawer and responsive modal', () => {
    const supportCss = fs.readFileSync(
      path.resolve(__dirname, '../components/Support/SupportPage.css'),
      'utf8'
    );
    expect(supportCss).toContain('@media (max-width: 768px)');
    expect(supportCss).toContain('width: 95vw !important;');
    expect(supportCss).toContain('width: 100vw !important;');
  });
});
