import React from 'react';

const BarcodeInput = ({
  barcodeValue,
  quantityValue,
  onBarcodeChange,
  onQuantityChange,
  onSubmit,
  inputRef,
  isAdding = false,
}) => (
  <div className="billing-inputs">
    <label className="billing-label">
      Barcode
      <input
        ref={inputRef}
        className="form-control billing-input"
        value={barcodeValue}
        onChange={(event) => onBarcodeChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Scan or type barcode"
      />
    </label>
    <label className="billing-label">
      Qty
      <input
        className="form-control billing-input"
        type="number"
        min="1"
        value={quantityValue}
        onChange={(event) => onQuantityChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
    </label>
    <button className="btn btn-primary w-100" type="button" onClick={onSubmit} disabled={isAdding}>
      {isAdding ? 'Item Adding...' : 'Add Item'}
    </button>
  </div>
);

export default BarcodeInput;
