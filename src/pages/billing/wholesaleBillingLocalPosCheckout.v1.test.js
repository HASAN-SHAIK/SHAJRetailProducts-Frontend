const fs = require('fs');
const path = require('path');

describe('wholesale billing local POS checkout', () => {
  test('uses local POS order creation instead of offline queue when local POS is enabled', () => {
    const source = fs.readFileSync(path.join(__dirname, 'WholesaleBilling.jsx'), 'utf8');
    const localPosBranch = source.slice(
      source.indexOf('if (localPosMode) {'),
      source.indexOf('const offlineEntry = await enqueueOfflineOrder')
    );

    expect(source).toContain("import { createOrder } from '../../services/orderService';");
    expect(source).toContain("import { isLocalPosEnabled } from '../../Repositories/local/posLocalApiClient';");
    expect(localPosBranch).toContain('await createOrder(payload)');
    expect(localPosBranch).not.toContain('enqueueOfflineOrder');
  });
});
