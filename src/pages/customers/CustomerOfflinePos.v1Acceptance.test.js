const fs = require('fs');
const path = require('path');

describe('V1 customer frontend offline POS authority', () => {
  test('customer list always attempts the configured repository and surfaces fallback state', () => {
    const source = fs.readFileSync(path.join(__dirname, 'CustomerList.jsx'), 'utf8');
    expect(source).toContain('const list = await searchCustomers({');
    expect(source).not.toContain('if (!navigator.onLine) return;');
    expect(source).toContain('Customer service is unavailable. Showing locally cached customers.');
  });

  test('customer form always attempts repository create/update before legacy queue fallback', () => {
    const source = fs.readFileSync(path.join(__dirname, 'CustomerForm.jsx'), 'utf8');
    expect(source).not.toContain('if (navigator.onLine) {');
    expect(source).toContain('savedCustomer = await createCustomer(payload);');
    expect(source).toContain('savedCustomer = await updateCustomer(id, payload);');
    expect(source).toContain('await addSyncQueueItem({');
    expect(source).toContain('Credit Limit (Central)');
    expect(source).toContain('Current Balance (Central)');
  });
});
