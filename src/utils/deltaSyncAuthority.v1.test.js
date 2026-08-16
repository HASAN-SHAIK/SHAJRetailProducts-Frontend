const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'deltaSync.js'), 'utf8');

describe('V1 legacy delta sync authority', () => {
  test('fails over to POS edge authority before any Central delta request in local POS mode', () => {
    expect(source).toContain("import { isLocalPosEnabled } from '../Repositories/local/posLocalApiClient';");
    const functionStart = source.indexOf('export const runDeltaSync');
    const localPosGuard = source.indexOf('if (isLocalPosEnabled())', functionStart);
    const productFetch = source.indexOf('fetchProductsDelta(', functionStart);
    expect(functionStart).toBeGreaterThan(-1);
    expect(localPosGuard).toBeGreaterThan(functionStart);
    expect(productFetch).toBeGreaterThan(localPosGuard);
    const guardedSection = source.slice(localPosGuard, productFetch);
    expect(guardedSection).toContain("authority: 'pos_edge'");
    expect(guardedSection).toContain("skipped: 'local_pos_authoritative'");
    expect(guardedSection).toContain('return');
  });

  test('retains the legacy browser delta worker for explicitly non-local-POS deployments', () => {
    expect(source).toContain('fetchProductsDelta(');
    expect(source).toContain('fetchBatchesDelta(');
    expect(source).toContain('fetchSuppliersDelta(');
  });
});
