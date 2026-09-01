import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BarcodeInput from './BarcodeInput';

jest.mock('./CameraBarcodeScannerModal', () => () => null);

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('V1 physical barcode scanner keyboard-wedge input', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test('accepts scanner text in the focused barcode field and submits on Enter', () => {
    const onSubmit = jest.fn();
    const Harness = () => {
      const [barcode, setBarcode] = useState('');
      return <BarcodeInput barcodeValue={barcode} quantityValue="1" onBarcodeChange={setBarcode} onQuantityChange={() => {}} onSubmit={() => onSubmit(barcode)} />;
    };
    act(() => root.render(<Harness />));
    const input = container.querySelector('input[placeholder="Scan or type barcode"]');
    expect(input).not.toBeNull();
    act(() => {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '8901234567890');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.value).toBe('8901234567890');
    let enter;
    act(() => {
      enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
      input.dispatchEvent(enter);
    });
    expect(enter.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('8901234567890');
  });

  test('non-Enter scanner keystrokes do not submit prematurely', () => {
    const onSubmit = jest.fn();
    act(() => root.render(<BarcodeInput barcodeValue="890123" quantityValue="1" onBarcodeChange={() => {}} onQuantityChange={() => {}} onSubmit={onSubmit} />));
    const input = container.querySelector('input[placeholder="Scan or type barcode"]');
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: '9', code: 'Digit9', bubbles: true, cancelable: true })));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
