const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'CartItemRow.jsx'), 'utf8');

describe('V1 cashier cart item accessibility', () => {
  test('labels quantity and price controls with the product identity', () => {
    expect(source).toContain('aria-label={`Quantity for ${itemName}`}');
    expect(source).toContain('aria-label={`Price for ${itemName}`}');
  });

  test('exposes actual-price disclosure state without changing price authority', () => {
    expect(source).toContain("aria-label={`${showActualPrice ? 'Hide' : 'Show'} actual price for ${itemName}`}");
    expect(source).toContain('aria-expanded={showActualPrice}');
    expect(source).toContain('readOnly={!canEditPrice}');
    expect(source).toContain('disabled={!canEditPrice}');
  });

  test('gives the remove action an item-specific accessible name', () => {
    expect(source).toContain('aria-label={`Remove ${itemName}`}');
  });
});
