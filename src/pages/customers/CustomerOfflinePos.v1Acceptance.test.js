const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('RetailHub customer management retirement boundary', () => {
  test('POS customer management screens redirect back to store execution', () => {
    for (const file of ['CustomerList.jsx', 'CustomerForm.jsx', 'CustomerDetail.jsx', 'CustomerReorder.jsx']) {
      const source = read(file);
      expect(source).toContain('Navigate');
      expect(source).toContain('to="/billing/retail"');
      expect(source).not.toContain('credit_limit');
      expect(source).not.toContain('current_balance');
    }
  });

  test('customer management screens no longer perform repository writes or local sync queue mutation', () => {
    const combined = ['CustomerList.jsx', 'CustomerForm.jsx', 'CustomerDetail.jsx', 'CustomerReorder.jsx']
      .map(read)
      .join('\n');
    expect(combined).not.toContain('createCustomer(');
    expect(combined).not.toContain('updateCustomer(');
    expect(combined).not.toContain('addSyncQueueItem(');
    expect(combined).not.toContain('searchCustomers(');
  });
});
