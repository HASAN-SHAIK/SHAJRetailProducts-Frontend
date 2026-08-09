import fs from 'fs';
import path from 'path';

describe('ReturnHistoryPanel refund diagnostics refresh wiring', () => {
  const source = fs.readFileSync(path.join(__dirname, 'ReturnHistoryPanel.jsx'), 'utf8');

  test('listens for refund fact changes and filters them to the selected bill', () => {
    expect(source).toContain('REFUND_DIAGNOSTICS_REFRESH_EVENT');
    expect(source).toContain("String(event?.detail?.orderId || '') !== String(orderId)");
    expect(source).toContain('setEventRefreshKey((value) => value + 1);');
  });

  test('uses the same effective refresh key for history and reconciliation facts', () => {
    expect(source).toContain('const effectiveRefreshKey = refreshKey + eventRefreshKey;');
    expect(source).toContain('[enabled, orderId, effectiveRefreshKey]');
    expect(source).toContain('refreshKey={effectiveRefreshKey}');
  });
});
