const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'PopUp.jsx'), 'utf8');

describe('V1 shared popup accessibility', () => {
  test('exposes the popup as a labelled modal dialog', () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby={titleId}');
    expect(source).toContain('aria-describedby={messageId}');
    expect(source).toContain('<h2 id={titleId}>{title}</h2>');
    expect(source).toContain('<p id={messageId}>{message}</p>');
  });

  test('provides an accessible close action and keyboard dismissal', () => {
    expect(source).toContain('aria-label="Close notification"');
    expect(source).toContain("if (event.key === 'Escape')");
    expect(source).toContain('onClose();');
  });

  test('moves focus into the popup and restores the previous focus on close', () => {
    expect(source).toContain('previouslyFocusedRef.current = document.activeElement');
    expect(source).toContain('closeButtonRef.current?.focus();');
    expect(source).toContain('previous.focus();');
  });
});
