import fs from 'fs';
import path from 'path';

describe('Area 8 Accounts & Customers Responsive Policy', () => {
  test('ReceiptEntry, PaymentEntry, and ExpenseEntry enforce decimal inputMode on amounts', () => {
    const receiptSource = fs.readFileSync(
      path.resolve(__dirname, 'ReceiptEntry.jsx'),
      'utf8'
    );
    const paymentSource = fs.readFileSync(
      path.resolve(__dirname, 'PaymentEntry.jsx'),
      'utf8'
    );
    const expenseSource = fs.readFileSync(
      path.resolve(__dirname, 'ExpenseEntry.jsx'),
      'utf8'
    );

    expect(receiptSource).toContain('id="receipt-amount-input"');
    expect(receiptSource).toContain('inputMode="decimal"');

    expect(paymentSource).toContain('id="payment-amount-input"');
    expect(paymentSource).toContain('inputMode="decimal"');

    expect(expenseSource).toContain('id="expense-amount-input"');
    expect(expenseSource).toContain('inputMode="decimal"');
  });

  test('ShiftDeclarationModal enforces numeric inputMode on cash denomination inputs', () => {
    const modalSource = fs.readFileSync(
      path.resolve(__dirname, '../../components/accounts/ShiftDeclarationModal.jsx'),
      'utf8'
    );

    expect(modalSource).toContain('inputMode="numeric"');
  });

  test('Accounts.css provides responsive tables, touch targets, and single-column form stacking', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, 'Accounts.css'),
      'utf8'
    );

    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('accounts-table-wrapper');
    expect(css).toContain('overflow-x: auto;');
    expect(css).toContain('min-height: 44px;');
    expect(css).toContain('touch-action: manipulation;');

    expect(css).toContain('@media (max-width: 575.98px)');
    expect(css).toContain('grid-template-columns: 1fr;');
  });
});
