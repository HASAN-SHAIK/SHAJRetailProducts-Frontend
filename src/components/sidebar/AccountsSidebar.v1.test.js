const fs = require('fs');
const path = require('path');
const {
  canAccessReceiptEntry,
  canAccessPaymentEntry,
  canAccessExpenseEntry,
  canAccessCashBook,
  canAccessOutstanding,
} = require('../../utils/permissions');

const source = fs.readFileSync(path.join(__dirname, 'AccountsSidebar.jsx'), 'utf8');

describe('V1 POS AccountsSidebar component and role navigation authority', () => {
  test('uses permission helpers to conditionally render operational accounting links', () => {
    expect(source).toContain('canAccessReceiptEntry');
    expect(source).toContain('canAccessPaymentEntry');
    expect(source).toContain('canAccessExpenseEntry');
    expect(source).toContain('canAccessCashBook');
    expect(source).toContain('canAccessOutstanding');
    expect(source).toContain('{showReceipt && (');
    expect(source).toContain('{showPayment && (');
    expect(source).toContain('{showExpense && (');
    expect(source).toContain('{showCashBook && (');
    expect(source).toContain('{showOutstanding && (');
  });

  test('cashier role evaluates to show receipt, cashbook, outstanding but hide payment and expense entry', () => {
    const cashierUser = { role: 'cashier' };
    expect(canAccessReceiptEntry(cashierUser)).toBe(true);
    expect(canAccessPaymentEntry(cashierUser)).toBe(false);
    expect(canAccessExpenseEntry(cashierUser)).toBe(false);
    expect(canAccessCashBook(cashierUser)).toBe(true);
    expect(canAccessOutstanding(cashierUser)).toBe(true);
  });

  test('staff role evaluates to hide all operational accounting entries', () => {
    const staffUser = { role: 'staff' };
    expect(canAccessReceiptEntry(staffUser)).toBe(false);
    expect(canAccessPaymentEntry(staffUser)).toBe(false);
    expect(canAccessExpenseEntry(staffUser)).toBe(false);
    expect(canAccessCashBook(staffUser)).toBe(false);
    expect(canAccessOutstanding(staffUser)).toBe(false);
  });

  test('manager and admin roles evaluate to show all operational accounting entries', () => {
    const managerUser = { role: 'manager' };
    const adminUser = { role: 'admin' };

    expect(canAccessReceiptEntry(managerUser)).toBe(true);
    expect(canAccessPaymentEntry(managerUser)).toBe(true);
    expect(canAccessExpenseEntry(managerUser)).toBe(true);
    expect(canAccessCashBook(managerUser)).toBe(true);
    expect(canAccessOutstanding(managerUser)).toBe(true);

    expect(canAccessReceiptEntry(adminUser)).toBe(true);
    expect(canAccessPaymentEntry(adminUser)).toBe(true);
    expect(canAccessExpenseEntry(adminUser)).toBe(true);
    expect(canAccessCashBook(adminUser)).toBe(true);
    expect(canAccessOutstanding(adminUser)).toBe(true);
  });
});
