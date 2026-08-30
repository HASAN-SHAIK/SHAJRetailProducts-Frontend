import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BarcodeInput from './BarcodeInput';

jest.mock('./CameraBarcodeScannerModal', () => () => null);

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
      return (
        <BarcodeInput
          barcodeValue={barcode}
          quantityValue="1"
          onBarcodeChange={setBarcode}
          onQuantityChange={() => {}}
          onSubmit={() => onSubmit(barcode)}
        />
      );
    };

    act(() => root.render(<Harness />));

    const barcodeInput = container.querySelector('input[placeholder="Scan or type barcode"]');
    expect(barcodeInput).not.toBeNull();

    act(() => {
      barcodeInput.focus();
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      ).set;
      valueSetter.call(barcodeInput, '8901234567890');
      barcodeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(barcodeInput.value).toBe('8901234567890');

    let enterEvent;
    act(() => {
      enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      barcodeInput.dispatchEvent(enterEvent);
    });

    expect(enterEvent.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('8901234567890');
  });

  test('non-Enter scanner keystrokes do not submit prematurely', () => {
    const onSubmit = jest.fn();

    act(() => {
      root.render(
        <BarcodeInput
          barcodeValue="890123"
          quantityValue="1"
          onBarcodeChange={() => {}}
          onQuantityChange={() => {}}
          onSubmit={onSubmit}
        />
      );
    });

    const barcodeInput = container.querySelector('input[placeholder="Scan or type barcode"]');

    act(() => {
      barcodeInput.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '9',
          code: 'Digit9',
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
