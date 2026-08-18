const fs = require('fs');
const path = require('path');

const billingSource = fs.readFileSync(path.join(__dirname, 'RetailBilling.jsx'), 'utf8');
const productRepositorySource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'Repositories', 'LocalPosProductRepository.js'),
  'utf8'
);
const productSearchSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'Billing', 'ProductSearch.jsx'),
  'utf8'
);

describe('V1 billing product search authority', () => {
  test('uses POSService catalog as the authoritative lookup in local POS mode', () => {
    expect(productRepositorySource).toContain('async searchLocalCatalog');
    expect(productRepositorySource).toContain('/catalog/products?q=');
    expect(billingSource).toContain('getProductRepository().searchLocalCatalog(current, 8)');
    expect(billingSource).toContain("setSearchError('Local POS product search is unavailable. Retry after the POS service is reachable.');");
  });

  test('does not fall through to Central search after a local POS lookup', () => {
    const localBranchStart = billingSource.indexOf('if (isLocalPosEnabled()) {', billingSource.indexOf('latestSearchRef.current = current;'));
    const centralSearch = billingSource.indexOf('api.get(buildSearchUrl(current, transactionType))', localBranchStart);
    expect(localBranchStart).toBeGreaterThan(-1);
    expect(centralSearch).toBeGreaterThan(localBranchStart);
    const localBranch = billingSource.slice(localBranchStart, centralSearch);
    expect(localBranch).toContain('return;');
  });

  test('exposes an actionable retry without changing product authority', () => {
    expect(productSearchSource).toContain('role="alert"');
    expect(productSearchSource).toContain("'Retry POS search'");
    expect(billingSource).toContain('onRetry={() => setSearchRetryKey((value) => value + 1)}');
  });
});
