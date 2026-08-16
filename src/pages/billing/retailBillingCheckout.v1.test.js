import fs from 'fs';
import path from 'path';

const readBillingSource = () =>
  fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'billing', 'RetailBilling.jsx'), 'utf8');

describe('V1 cashier checkout interaction safety', () => {
  test('checkout locks duplicate confirmation before asynchronous order work', () => {
    const source = readBillingSource();
    const handlerStart = source.indexOf('const handleConfirmCheckout = async () => {');
    const handlerEnd = source.indexOf('\n  const ', handlerStart + 1);
    const handler = source.slice(handlerStart, handlerEnd > handlerStart ? handlerEnd : undefined);

    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(handler).toContain('if (!items.length || isConfirmSubmitting) return;');

    const lockIndex = handler.indexOf('setIsConfirmSubmitting(true);');
    const createOrderIndex = handler.indexOf('createOrder(payload');
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(createOrderIndex).toBeGreaterThan(lockIndex);
    expect(handler).toContain('setIsConfirmSubmitting(false);');
  });

  test('local POS checkout fails closed and cannot fall through to legacy browser order enqueue', () => {
    const source = readBillingSource();
    const localPosStart = source.indexOf('if (isLocalPosEnabled()) {');
    const legacyEnqueueIndex = source.indexOf("enqueueOfflineOrder({ type: 'create', payload })", localPosStart);

    expect(localPosStart).toBeGreaterThanOrEqual(0);
    expect(legacyEnqueueIndex).toBeGreaterThan(localPosStart);

    const localPosSection = source.slice(localPosStart, legacyEnqueueIndex);
    expect(localPosSection).toContain('createOrder(payload');
    expect(localPosSection).toContain("showPopup(message, 'Local POS unavailable');");
    expect(localPosSection).toContain("showPopup('Local POS service unavailable. Please start POSService and retry checkout.'");
    expect(localPosSection).toMatch(/if \(!response\)[\s\S]*?return;/);
    expect(localPosSection).toMatch(/resetCheckoutModalState\(\);[\s\S]*?return;/);
  });
});
