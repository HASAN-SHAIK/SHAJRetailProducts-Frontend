import fs from 'fs';
import path from 'path';

describe('Area 7 Returns, Corrections & GST Responsive Policy', () => {
  test('ReturnsCorrections.css provides responsive mobile header, actions, and touch targets', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, 'ReturnsCorrections.css'),
      'utf8'
    );

    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('flex-direction: column;');
    expect(css).toContain('min-height: 44px;');
    expect(css).toContain('touch-action: manipulation;');
  });

  test('ReturnsCorrections.css ensures wide returns/GST tables scroll horizontally inside card', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, 'ReturnsCorrections.css'),
      'utf8'
    );

    expect(css).toContain('overflow-x: auto;');
    expect(css).toContain('min-width: 600px;');
  });

  test('ReturnsCorrections.css stacks forms and rows on screens below 576px', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, 'ReturnsCorrections.css'),
      'utf8'
    );

    expect(css).toContain('@media (max-width: 575.98px)');
    expect(css).toContain('flex-direction: column;');
    expect(css).toContain('width: 100%;');
  });
});
