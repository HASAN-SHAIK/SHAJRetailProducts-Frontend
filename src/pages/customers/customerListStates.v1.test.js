const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'CustomerList.jsx'), 'utf8');

describe('V1 customer screen loading and retry states', () => {
  test('keeps local cached customers visible when the configured customer repository fails', () => {
    expect(source).toContain("await loadCustomersFromCache(term).catch(() => setCustomers([]));");
    expect(source).toContain('Customer service is unavailable. Showing locally cached customers.');
  });

  test('exposes an actionable retry using the current search term', () => {
    expect(source).toContain("const retryCustomers = () => fetchCustomers(search.trim());");
    expect(source).toContain('onClick={retryCustomers}');
    expect(source).toContain("{loading ? 'Retrying...' : 'Retry'}");
  });

  test('exposes deterministic loading, empty and accessible error states', () => {
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("aria-busy={loading ? 'true' : 'false'}");
    expect(source).toContain('Loading customers...');
    expect(source).toContain('No customers match this search.');
  });

  test('gives repeated customer row actions customer-specific accessible names', () => {
    expect(source).toContain("const customerActionLabel = customer.name || customer.phone || customer.mobile || customer.id || 'customer';");
    expect(source).toContain('aria-label={`View customer ${customerActionLabel}`}');
    expect(source).toContain('aria-label={`Edit customer ${customerActionLabel}`}');
  });
});
