const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

describe('POS Opening Setup retirement boundary', () => {
  test('Opening Setup is a RetailHub handoff and has no accounting mutation authority', () => {
    const source = read('pages/accounts/OpeningSetup.jsx');
    expect(source).toContain('SHAJ Retail Hub');
    expect(source).toContain('REACT_APP_RETAIL_HUB_URL');
    expect(source).toContain('Refresh setup status');
    expect(source).not.toMatch(/api\.(get|post|put|patch|delete)|\/accounts\/opening-setup|saveOpening|finalizeOpening/);
  });

  test('POS still consumes Central opening-completion state before execution', () => {
    const app = read('App.js');
    expect(app).toContain('is_opening_completed');
    expect(app).toContain('OpeningRequired');
  });
});
