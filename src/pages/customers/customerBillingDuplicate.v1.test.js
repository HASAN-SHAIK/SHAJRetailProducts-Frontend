const fs = require('fs');
const path = require('path');

const read = (relative) => fs.readFileSync(path.join(__dirname, relative), 'utf8');

// Source-contract checks: the billing pages are too large to mount in a unit
// test, so these pin the guard that keeps quick-create from writing duplicates.
describe.each([
  ['retail', '../billing/RetailBilling.jsx'],
  ['wholesale', '../billing/WholesaleBilling.jsx'],
])('%s billing quick-create duplicate guard', (name, file) => {
  const source = read(file);
  const body = source.slice(source.indexOf('const queueCustomerSync'));

  test('looks up the mobile number in the customer cache before queueing a create', () => {
    const guard = body.indexOf('findCustomerByPhone(');
    const queue = body.indexOf('addSyncQueueItem(');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(queue);
    expect(body).toContain('if (known?.id) return known.id;');
  });

  test('imports the shared phone matcher', () => {
    expect(source).toContain("import { findCustomerByPhone } from '../customers/customerHelpers';");
  });
});

test('customer form surfaces the server duplicate response with a link to the existing customer', () => {
  const form = read('CustomerForm.jsx');
  expect(form).toContain('isDuplicateCustomerError(err)');
  expect(form).toContain('Open existing customer');
  expect(form).toContain('buildCustomerSubmitPayload(form, { isEdit })');
});
