import React, { useState } from 'react';
import CameraBarcodeScannerModal from './CameraBarcodeScannerModal';

const BarcodeInput = ({
  barcodeValue,
  quantityValue,
  onBarcodeChange,
  onQuantityChange,
  onSubmit,
  onCameraDetected,
  inputRef,
  isAdding = false,
}) => {
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleCameraDetected = (code) => {
    onBarcodeChange(code);
    if (typeof onCameraDetected === 'function') {
      onCameraDetected(code);
    }
  };

  return (
    <>
      <div className="billing-inputs">
        <label className="billing-label">
          Barcode
          <div className="billing-barcode-input-row">
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
            <button
              type="button"
              className="btn btn-outline-info billing-camera-btn"
              onClick={() => setCameraOpen(true)}
              disabled={isAdding}
              title="Scan barcode using camera"
            >
              Use Camera
            </button>
          </div>
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
      <CameraBarcodeScannerModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetected={handleCameraDetected}
      />
    </>
  );
};

export default BarcodeInput;
