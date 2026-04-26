import React, { useEffect, useMemo, useRef, useState } from 'react';

const PREFERRED_BARCODE_FORMATS = [
  'qr_code',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'codabar',
];

const CameraBarcodeScannerModal = ({ open, onClose, onDetected }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const lastScanAtRef = useRef(0);
  const isDetectedRef = useRef(false);
  const [error, setError] = useState('');
  const [initializing, setInitializing] = useState(false);
  const isSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.BarcodeDetector !== 'undefined' &&
      !!navigator?.mediaDevices?.getUserMedia,
    []
  );

  useEffect(() => {
    if (!open) return undefined;

    const stopScanner = () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      detectorRef.current = null;
      isDetectedRef.current = false;
    };

    const bootScanner = async () => {
      if (!isSupported) {
        setError('Camera barcode scan is not supported on this browser.');
        return;
      }

      setInitializing(true);
      setError('');
      try {
        const supportedFormats = window.BarcodeDetector.getSupportedFormats
          ? await window.BarcodeDetector.getSupportedFormats()
          : [];
        const selectedFormats =
          supportedFormats.length > 0
            ? PREFERRED_BARCODE_FORMATS.filter((format) => supportedFormats.includes(format))
            : PREFERRED_BARCODE_FORMATS;
        detectorRef.current =
          selectedFormats.length > 0
            ? new window.BarcodeDetector({ formats: selectedFormats })
            : new window.BarcodeDetector();

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stopScanner();
          return;
        }
        video.srcObject = stream;
        await video.play();

        const detectFrame = async () => {
          const activeVideo = videoRef.current;
          const detector = detectorRef.current;
          if (!activeVideo || !detector || isDetectedRef.current) {
            return;
          }
          if (activeVideo.readyState < 2) {
            frameRef.current = window.requestAnimationFrame(detectFrame);
            return;
          }

          const now = Date.now();
          if (now - lastScanAtRef.current < 250) {
            frameRef.current = window.requestAnimationFrame(detectFrame);
            return;
          }
          lastScanAtRef.current = now;

          try {
            const barcodes = await detector.detect(activeVideo);
            if (Array.isArray(barcodes) && barcodes.length > 0) {
              const rawValue = String(barcodes[0]?.rawValue || '').trim();
              if (rawValue) {
                isDetectedRef.current = true;
                onDetected?.(rawValue);
                onClose?.();
                return;
              }
            }
          } catch (scanError) {
            // Swallow frame-level detection failures and continue scanning.
          }

          frameRef.current = window.requestAnimationFrame(detectFrame);
        };

        frameRef.current = window.requestAnimationFrame(detectFrame);
      } catch (bootError) {
        setError('Unable to access the camera. Please allow camera permission and try again.');
        stopScanner();
      } finally {
        setInitializing(false);
      }
    };

    bootScanner();
    return () => {
      stopScanner();
    };
  }, [isSupported, onClose, onDetected, open]);

  if (!open) return null;

  return (
    <div className="billing-camera-overlay" onClick={onClose}>
      <div className="billing-camera-modal" onClick={(event) => event.stopPropagation()}>
        <div className="billing-camera-header">
          <h5>Scan Product Barcode</h5>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="billing-camera-body">
          {!isSupported ? (
            <div className="billing-camera-status">This browser does not support camera barcode scanning.</div>
          ) : (
            <>
              <div className="billing-camera-video-wrap">
                <video ref={videoRef} className="billing-camera-video" playsInline muted autoPlay />
              </div>
              <div className="billing-camera-status">
                {initializing ? 'Starting camera...' : 'Point camera at barcode or QR code.'}
              </div>
            </>
          )}
          {error ? <div className="billing-camera-error">{error}</div> : null}
        </div>
      </div>
    </div>
  );
};

export default CameraBarcodeScannerModal;
