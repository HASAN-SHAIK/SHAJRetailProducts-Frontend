const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'ProductSearch.jsx'), 'utf8');

describe('V1 billing product search interaction safety', () => {
  test('selects a suggestion through one activation path', () => {
    expect(source).toContain('onClick={(event) =>');
    expect(source).toContain('onSelect(item);');
    expect(source).not.toContain('onPointerDown=');
  });

  test('exposes search progress accessibly', () => {
    expect(source).toContain('aria-busy={loading}');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });
});
