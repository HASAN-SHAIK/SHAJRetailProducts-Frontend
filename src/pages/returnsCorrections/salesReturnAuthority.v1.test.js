const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'SalesReturn.jsx'), 'utf8');

describe('V1 sales return local POS authority', () => {
  test('does not fall back to browser order caches when local POS is authoritative', () => {
    expect(source).toContain("setOrdersError('Local POS orders are unavailable. Retry after the POS service is reachable.');");
    expect(source).toContain("setItemsError('Local POS bill details are unavailable. Retry this bill before returning items.');");
    expect(source).not.toContain('Fall back to the local browser cache if the loopback POS service is unavailable.');
    expect(source).not.toContain('orderItems = await getOrderItemsByOrderId(selectedOrderId);\n        }');
  });

  test('keeps legacy browser fallback only outside local POS mode', () => {
    expect(source).toContain('Legacy non-local-POS deployments may continue to the browser cache.');
    expect(source).toContain('const localList = await getAllOrderRecords();');
  });

  test('exposes actionable retry and blocks return submission while authoritative data is unavailable', () => {
    expect(source).toContain("{ordersLoading ? 'Retrying...' : 'Retry POS orders'}");
    expect(source).toContain("{itemsLoading ? 'Retrying...' : 'Retry bill'}");
    expect(source).toContain('disabled={submitting || Boolean(itemsError) || Boolean(ordersError)}');
    expect(source).toContain('role="alert"');
  });
});