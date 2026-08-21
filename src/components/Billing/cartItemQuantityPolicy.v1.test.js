const fs = require('fs');
const path = require('path');

const cartItemRowSource = fs.readFileSync(path.join(__dirname, 'CartItemRow.jsx'), 'utf8');
const billingStoreSource = fs.readFileSync(path.join(__dirname, '../../store/billingStore.js'), 'utf8');
const retailBillingSource = fs.readFileSync(path.join(__dirname, '../../pages/billing/RetailBilling.jsx'), 'utf8');

describe('V1 billing quantity policy', () => {
  test('blocks decimal typing for piece-based cart rows', () => {
    expect(cartItemRowSource).toContain("if (!weightBased && !/^\\d*$/.test(String(value))) return;");
    expect(cartItemRowSource).toContain("['.', ',', 'e', 'E', '+', '-'].includes(event.key)");
  });

  test('normalizes piece-based quantities at the billing store boundary', () => {
    expect(billingStoreSource).toContain('const normalizeQuantityForProduct = (product, qty, fallback = 1) =>');
    expect(billingStoreSource).toContain('return isWeightBased(product) ? safe : Math.floor(safe);');
    expect(billingStoreSource).toContain('const safeQty = normalizeQuantityForProduct(product, qty, 1);');
  });

  test('validates barcode and product-search add flows after product type is known', () => {
    expect(retailBillingSource).toContain("showPopup('Piece-based products must use whole-number quantity.', 'Validation');");
    expect(retailBillingSource.match(/!isWeightBasedProduct\(resolvedProduct\) && !isWholeQuantity\(requestedQty\)/g)).toHaveLength(2);
  });
});
