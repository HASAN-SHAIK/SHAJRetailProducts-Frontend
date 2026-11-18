import fs from 'fs';
import path from 'path';
import { stepQuantity } from './CartItemRow';

describe('CartItemRow quantity step buttons policy', () => {
  test('stepping up increments integer quantity by 1 for piece items', () => {
    expect(stepQuantity(1, 1, false)).toBe('2');
    expect(stepQuantity('5', 1, false)).toBe('6');
    expect(stepQuantity(10, 1, false)).toBe('11');
  });

  test('stepping down decrements integer quantity by 1 for piece items', () => {
    expect(stepQuantity(3, -1, false)).toBe('2');
    expect(stepQuantity('2', -1, false)).toBe('1');
  });

  test('stepping down never drops quantity below 1', () => {
    expect(stepQuantity(1, -1, false)).toBe('1');
    expect(stepQuantity(0, -1, false)).toBe('1');
    expect(stepQuantity(-2, -1, false)).toBe('1');
  });

  test('weight-based items do not allow step buttons and return null', () => {
    expect(stepQuantity(1, 1, true)).toBeNull();
    expect(stepQuantity(1, -1, true)).toBeNull();
    expect(stepQuantity(0.5, 1, true)).toBeNull();
    expect(stepQuantity('2.75', -1, true)).toBeNull();
  });

  test('CartItemRow source guards +/- buttons behind !weightBased check', () => {
    const rowSource = fs.readFileSync(
      path.resolve(__dirname, 'CartItemRow.jsx'),
      'utf8'
    );

    // Verify both minus and plus buttons are guarded by !weightBased
    expect(rowSource).toMatch(/!weightBased\s*&&\s*\(\s*<button[^>]*billing-qty-btn-minus/);
    expect(rowSource).toMatch(/!weightBased\s*&&\s*\(\s*<button[^>]*billing-qty-btn-plus/);

    // Verify stepQuantity helper is utilized
    expect(rowSource).toContain('stepQuantity');
    expect(rowSource).toContain('Math.max(1, safeCurrent + delta)');
  });
});
