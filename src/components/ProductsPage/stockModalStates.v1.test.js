const fs = require('fs');
const path = require('path');

describe('V1 inventory stock modal truth states', () => {
  const source = fs.readFileSync(path.join(__dirname, 'ProductsPage.jsx'), 'utf8');

  test('keeps authoritative POS failures distinct from a genuine empty result', () => {
    expect(source).toContain("const [stockError, setStockError] = useState('')");
    expect(source).toContain("setStockError('POS inventory is unavailable. Check POSService and retry.')");
    expect(source).toContain('!stockLoading && stockError');
    expect(source).toContain('!stockLoading && !stockError && stockRows.length === 0');
    expect(source).toContain('Retry POS inventory');
    expect(source).not.toContain("setStockRows([]);\n      showPopup('Failed to load branch stock.', 'Error');");
  });

  test('preserves POS on-hand/reserved/available inventory facts in operator presentation', () => {
    expect(source).toContain('row.quantity ?? 0');
    expect(source).toContain('row.reserved_milli');
    expect(source).toContain('row.available_milli');
    expect(source).toContain('Loading POS inventory...');
  });
});
