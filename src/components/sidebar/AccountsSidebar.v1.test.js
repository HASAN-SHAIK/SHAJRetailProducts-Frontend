const fs = require('fs');
const path = require('path');
const { canAccessReceiptEntry, canAccessPaymentEntry } = require('../../utils/permissions');

const source = fs.readFileSync(path.join(__dirname, 'AccountsSidebar.jsx'), 'utf8');

describe('V1 POS AccountsSidebar component and role navigation authority', () => {
  test('uses permission helpers to conditionally render operational accounting links', () => {
    expect(source).toContain('canAccessReceiptEntry');
    expect(source).toContain('canAccessPaymentEntry');
    expect(source).toContain('{showReceipt && (');
    expect(source).toContain('{showPayment && (');
  });

  test('cashier role evaluates to show receipt but hide payment entry', () => {
    const cashierUser = { role: 'cashier' };
    expect(canAccessReceiptEntry(cashierUser)).toBe(true);
    expect(canAccessPaymentEntry(cashierUser)).toBe(false);
  });

  test('staff role evaluates to hide both receipt and payment entries', () => {
    const staffUser = { role: 'staff' };
    expect(canAccessReceiptEntry(staffUser)).toBe(false);
    expect(canAccessPaymentEntry(staffUser)).toBe(false);
  });

  test('manager and admin roles evaluate to show both receipt and payment entries', () => {
    const managerUser = { role: 'manager' };
    const adminUser = { role: 'admin' };

    expect(canAccessReceiptEntry(managerUser)).toBe(true);
    expect(canAccessPaymentEntry(managerUser)).toBe(true);

    expect(canAccessReceiptEntry(adminUser)).toBe(true);
    expect(canAccessPaymentEntry(adminUser)).toBe(true);
  });
});
