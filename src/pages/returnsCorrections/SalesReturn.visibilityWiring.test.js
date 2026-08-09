import fs from 'fs';
import path from 'path';

describe('Sales Return visibility wiring', () => {
  const source = fs.readFileSync(path.join(__dirname, 'SalesReturn.jsx'), 'utf8');

  test('renders remaining quantity and operator-facing return state', () => {
    expect(source).toContain('<th>Remaining</th>');
    expect(source).toContain('<th>Status</th>');
    expect(source).toContain('{lineState.remaining}');
    expect(source).toContain('{getReturnLineLabel(row)}');
  });

  test('prevents quantity entry for non-returnable lines and bounds input to remaining quantity', () => {
    expect(source).toContain('max={lineState.remaining}');
    expect(source).toContain('disabled={!lineState.isReturnable || submitting}');
    expect(source).toContain('if (!lineState.isReturnable) return { ...row, qty: \'\' };');
  });
});
