import fs from 'fs';
import path from 'path';

describe('Area 6 Staff & Expenses Responsive Policy', () => {
  test('StaffExpenses.css provides responsive mobile header, cards, and touch targets', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, 'StaffExpenses.css'),
      'utf8'
    );

    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('flex-direction: column;');
    expect(css).toContain('min-height: 44px;');
    expect(css).toContain('touch-action: manipulation;');
    expect(css).toContain('overflow-x: auto;');
  });

  test('StaffExpenses.css provides single-column forms on screens below 576px', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, 'StaffExpenses.css'),
      'utf8'
    );

    expect(css).toContain('@media (max-width: 575.98px)');
    expect(css).toContain('grid-template-columns: 1fr;');
  });
});
