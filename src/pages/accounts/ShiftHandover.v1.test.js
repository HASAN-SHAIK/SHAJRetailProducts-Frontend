jest.mock('../../utils/axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const {
  calculateDenominationsTotal,
  DENOMINATION_MULTIPLIERS,
} = require('../../services/shiftService');

describe('V1 Cashier Shift Handover & Drawer Cash Declaration (FEAT-AUTH-005)', () => {
  const modalSource = fs.readFileSync(path.join(__dirname, '../../components/accounts/ShiftDeclarationModal.jsx'), 'utf8');
  const cashBookSource = fs.readFileSync(path.join(__dirname, 'CashBook.jsx'), 'utf8');

  test('shiftService computes denomination values correctly', () => {
    expect(DENOMINATION_MULTIPLIERS['500']).toBe(500);
    expect(DENOMINATION_MULTIPLIERS['200']).toBe(200);
    expect(DENOMINATION_MULTIPLIERS['100']).toBe(100);
    expect(DENOMINATION_MULTIPLIERS['50']).toBe(50);
    expect(DENOMINATION_MULTIPLIERS['20']).toBe(20);
    expect(DENOMINATION_MULTIPLIERS['10']).toBe(10);
    expect(DENOMINATION_MULTIPLIERS['5']).toBe(5);

    const counts = {
      '500': 4,   // 2000
      '200': 2,   // 400
      '100': 5,   // 500
      '50': 2,    // 100
      '20': 5,    // 100
      '10': 10,   // 100
      '5': 10,    // 50
      'coins': 25,// 25
    };
    // 2000 + 400 + 500 + 100 + 100 + 100 + 50 + 25 = 3275
    expect(calculateDenominationsTotal(counts)).toBe(3275);
  });

  test('ShiftDeclarationModal renders denominations, expected cash, and variance indicators', () => {
    expect(modalSource).toContain('Cashier Shift Handover & Drawer Cash Declaration');
    expect(modalSource).toContain('Expected Cash in Hand');
    expect(modalSource).toContain('Total Declared Physical Cash:');
    expect(modalSource).toContain('Drawer Reconciliation Variance:');
    expect(modalSource).toContain('Handover Remarks / Relieving Cashier Name');
    expect(modalSource).toContain('declareAndCloseShift');
  });

  test('CashBook wires ShiftDeclarationModal and exposes handover trigger button', () => {
    expect(cashBookSource).toContain("import ShiftDeclarationModal from '../../components/accounts/ShiftDeclarationModal';");
    expect(cashBookSource).toContain('Shift Handover & Declare Cash');
    expect(cashBookSource).toContain('<ShiftDeclarationModal');
    expect(cashBookSource).toContain('expectedCash={closingBalance}');
  });
});
