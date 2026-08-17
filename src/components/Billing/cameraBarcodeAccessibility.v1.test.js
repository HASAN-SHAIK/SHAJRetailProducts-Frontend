const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'CameraBarcodeScannerModal.jsx'), 'utf8');

describe('V1 camera barcode scanner accessibility', () => {
  test('exposes a labelled modal with an accessible close action', () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby={titleId}');
    expect(source).toContain('aria-label="Close barcode scanner"');
  });

  test('supports keyboard dismissal and focus restoration', () => {
    expect(source).toContain("if (event.key === 'Escape')");
    expect(source).toContain('closeButtonRef.current?.focus();');
    expect(source).toContain('previous.focus();');
  });

  test('associates manual barcode input and exposes scanner state', () => {
    expect(source).toContain('htmlFor={manualInputId}');
    expect(source).toContain('id={manualInputId}');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('role="alert"');
  });
});
