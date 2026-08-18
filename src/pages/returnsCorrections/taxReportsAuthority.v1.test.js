const fs = require('fs');
const path = require('path');

describe('V1 GST reporting frontend authority', () => {
  const source = fs.readFileSync(path.join(__dirname, 'TaxReports.jsx'), 'utf8');

  test('packaged local POS mode treats Central as the canonical GST reporting authority', () => {
    expect(source).toContain("import { isLocalPosEnabled } from '../../Repositories/local/posLocalApiClient';");
    expect(source).toContain('const centralReportingRequired = isLocalPosEnabled();');
    expect(source).toContain('if (centralReportingRequired) {');
    expect(source).toContain('Central GST reporting is unavailable. Check the connection and retry.');
    expect(source).toContain('GST reports require Central reporting authority. Reconnect and retry.');
  });

  test('legacy browser GST cache fallback is reached only after Central-required branches return', () => {
    const centralGuard = source.indexOf('const centralReportingRequired = isLocalPosEnabled();');
    const onlineFailureGuard = source.indexOf('if (centralReportingRequired) {', centralGuard);
    const offlineFailureGuard = source.indexOf('} else if (centralReportingRequired) {', onlineFailureGuard);
    const legacyFallback = source.indexOf('const list = await getLocalGstEntries({ from, to });');

    expect(centralGuard).toBeGreaterThanOrEqual(0);
    expect(onlineFailureGuard).toBeGreaterThan(centralGuard);
    expect(offlineFailureGuard).toBeGreaterThan(onlineFailureGuard);
    expect(legacyFallback).toBeGreaterThan(offlineFailureGuard);
  });

  test('report failures are not rendered as fake empty results and expose an actionable retry', () => {
    expect(source).toContain("const [loadError, setLoadError] = useState('');");
    expect(source).toContain('role="alert"');
    expect(source).toContain('Retry GST report');
    expect(source).toContain('!isLoading && !loadError && entries.length === 0');
    expect(source).toContain('!loadError && entries.map((entry) => (');
  });

  test('date filters and loading state expose basic accessible associations', () => {
    expect(source).toContain('htmlFor="tax-report-from"');
    expect(source).toContain('id="tax-report-from"');
    expect(source).toContain('htmlFor="tax-report-to"');
    expect(source).toContain('id="tax-report-to"');
    expect(source).toContain('aria-busy={isLoading}');
    expect(source).toContain('role="status"');
  });
});
