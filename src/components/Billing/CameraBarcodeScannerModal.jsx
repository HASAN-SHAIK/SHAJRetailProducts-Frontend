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
  const zxingReaderRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const frameRef = useRef(null);
  const lastScanAtRef = useRef(0);
  const isDetectedRef = useRef(false);
  const [error, setError] = useState('');
  const [initializing, setInitializing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const isSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.BarcodeDetector !== 'undefined' &&
      !!navigator?.mediaDevices?.getUserMedia,
    []
  );
  const hasCameraSupport = useMemo(
    () => typeof window !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia,
    []
  );

  useEffect(() => {
    if (!open) return undefined;

    const stopScanner = () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (zxingControlsRef.current) {
        try {
          zxingControlsRef.current.stop();
        } catch {
          // ignore
        }
        zxingControlsRef.current = null;
      }
      if (zxingReaderRef.current) {
        try {
          zxingReaderRef.current.reset();
        } catch {
          // ignore
        }
        zxingReaderRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      detectorRef.current = null;
      isDetectedRef.current = false;
    };

    const bootZxingScanner = async () => {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType, NotFoundException }] =
        await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
      ]);
      const reader = new BrowserMultiFormatReader(hints, 250);
      zxingReaderRef.current = reader;
      const video = videoRef.current;
      if (!video) return;

      const controls = await reader.decodeFromVideoDevice(undefined, video, (result, err) => {
        if (result) {
          const rawValue = String(result.getText?.() || '').trim();
          if (rawValue) {
            isDetectedRef.current = true;
            onDetected?.(rawValue);
            onClose?.();
          }
        }
        if (err && !(err instanceof NotFoundException)) {
          // keep scanning for recoverable decode errors
        }
      });
      zxingControlsRef.current = controls;
    };

    const bootScanner = async () => {
      if (!hasCameraSupport) {
        setError('Camera access is not supported on this browser/device.');
        return;
      }

      setInitializing(true);
      setError('');
      try {
        if (!isSupported) {
          await bootZxingScanner();
          return;
        }
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
        try {
          // Fallback for browsers where BarcodeDetector fails at runtime.
          await bootZxingScanner();
        } catch {
          setError('Unable to access camera scanner. Allow permission and use HTTPS (or localhost).');
          stopScanner();
        }
      } finally {
        setInitializing(false);
      }
    };

    bootScanner();
    return () => {
      stopScanner();
    };
  }, [hasCameraSupport, isSupported, onClose, onDetected, open]);

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
          {!hasCameraSupport ? (
            <div className="billing-camera-status">
              Camera is unavailable here. Use HTTPS and allow permission, or enter barcode manually below.
            </div>
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
          <div className="mt-2">
            <label className="form-label text-light">Manual Barcode Entry</label>
            <input
              type="text"
              className="form-control"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Enter barcode and submit"
            />
            <button
              type="button"
              className="btn btn-primary btn-sm mt-2"
              onClick={() => {
                const value = String(manualCode || '').trim();
                if (!value) return;
                onDetected?.(value);
                onClose?.();
              }}
            >
              Use Barcode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraBarcodeScannerModal;
