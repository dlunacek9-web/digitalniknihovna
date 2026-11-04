import { useCallback, useEffect, useRef, useState } from 'react';
import { toValidBookCode } from './isbn';

// Formats for BarcodeDetector (native in Chrome / Android, ZXing WASM elsewhere, e.g. iOS)
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

// Light zoom keeps the book further from the lens, where the camera can still focus
const TARGET_ZOOM = 1.7;
// Size of the guide frame relative to the visible camera area
export const FRAME_W = 0.8;
export const FRAME_H = 0.4;
const MAX_DECODE_WIDTH = 1280;
// Průběžné skenování: pauza po každém přečtení a doba, po kterou se stejný kód v záběru nepočítá znovu
const SCAN_PAUSE_MS = 700;
const REPEAT_BLOCK_MS = 2000;

let detectorPromise;
export function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          if (FORMATS.every((f) => supported.includes(f))) {
            return new window.BarcodeDetector({ formats: FORMATS });
          }
        } catch (e) {
          // use the WASM detector below
        }
      }
      const [{ BarcodeDetector, setZXingModuleOverrides }, { default: wasmUrl }] = await Promise.all([
        import('barcode-detector/ponyfill'),
        import('zxing-wasm/reader/zxing_reader.wasm?url')
      ]);
      setZXingModuleOverrides({
        locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path)
      });
      return new BarcodeDetector({ formats: FORMATS });
    })();
    detectorPromise.catch(() => {
      detectorPromise = undefined;
    });
  }
  return detectorPromise;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Part of the video that is visible in the preview box (object-cover) after digital zoom.
// `region` scales it down further: 1 = whole visible area, <1 = middle part only.
function grabFrameCanvas(videoEl, boxEl, digitalZoom, regionW, regionH) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh || !boxEl.clientWidth || !boxEl.clientHeight) return null;

  const boxAspect = boxEl.clientWidth / boxEl.clientHeight;
  let visW;
  let visH;
  if (vw / vh > boxAspect) {
    visH = vh;
    visW = vh * boxAspect;
  } else {
    visW = vw;
    visH = vw / boxAspect;
  }
  const sw = Math.round((visW / digitalZoom) * regionW);
  const sh = Math.round((visH / digitalZoom) * regionH);
  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);
  const scale = Math.min(1, MAX_DECODE_WIDTH / sw);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d').drawImage(videoEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function detectCode(detector, canvas, accept = toValidBookCode) {
  try {
    const results = await detector.detect(canvas);
    for (const result of results) {
      const code = accept(result.rawValue);
      if (code) return code;
    }
  } catch (e) {
    // no code in this frame
  }
  return null;
}

/**
 * Kamera se čtením čárového kódu. První platný kód předá do `onCode` a kameru vypne.
 * S `continuous` kamera běží dál a každý kód předá znovu. Stejný kód, který zůstává
 * v záběru, se počítá jen jednou; další výtisk se započítá, až kód ze záběru zmizí.
 * `paused` zastaví jen čtení čárového kódu, náhled i `grabFrame` běží dál.
 */
export function useBarcodeCamera({ onCode, accept = toValidBookCode, paused = false, continuous = false }) {
  const videoRef = useRef(null);
  const boxRef = useRef(null);
  const streamRef = useRef(null);
  const hasFinished = useRef(false);
  const zoomUsedRef = useRef(1);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;

  const [isScanning, setIsScanning] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [detectedCode, setDetectedCode] = useState('');
  // Digital zoom (CSS + crop) is used only when the camera has no hardware zoom
  const [digitalZoom, setDigitalZoom] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stopCamera = () => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
  };

  // Hand a detected code to the app exactly once
  const finishWithCode = useCallback((code) => {
    if (hasFinished.current) return;
    hasFinished.current = true;
    setDetectedCode(code);
    stopCamera();
    onCodeRef.current(code);
  }, []);

  const grabFrame = useCallback((regionW = FRAME_W, regionH = FRAME_H) => {
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.readyState < 2 || !boxRef.current) return null;
    return grabFrameCanvas(videoEl, boxRef.current, zoomUsedRef.current, regionW, regionH);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyDigitalZoom = () => {
      zoomUsedRef.current = TARGET_ZOOM;
      setDigitalZoom(TARGET_ZOOM);
    };

    const startScanner = async () => {
      try {
        setHasPermissionError(false);
        setErrorMessage('');

        const detectorPromiseLocal = getDetector();
        detectorPromiseLocal.catch(() => {});

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        let capabilities = {};
        try {
          capabilities = track.getCapabilities ? track.getCapabilities() : {};
        } catch (e) {
          capabilities = {};
        }

        // Continuous autofocus + light hardware zoom where the browser allows it
        const advanced = [];
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          advanced.push({ focusMode: 'continuous' });
        }
        if (capabilities.zoom && capabilities.zoom.max) {
          const zoom = Math.min(capabilities.zoom.max, Math.max(capabilities.zoom.min || 1, TARGET_ZOOM));
          advanced.push({ zoom });
        } else {
          applyDigitalZoom();
        }
        if (advanced.length) {
          try {
            await track.applyConstraints({ advanced });
          } catch (e) {
            // zoom/focus constraints are optional; fall back to digital zoom
            if (capabilities.zoom && capabilities.zoom.max) applyDigitalZoom();
          }
        }
        setTorchSupported(!!capabilities.torch);

        const videoEl = videoRef.current;
        if (!videoEl) return;
        videoEl.srcObject = stream;
        await videoEl.play();
        if (cancelled) return;
        setIsScanning(true);

        const detector = await detectorPromiseLocal;

        // Decode fresh frames continuously; the first valid code is used immediately.
        let attempt = 0;
        let last = { code: '', at: 0 };
        while (!cancelled && !hasFinished.current) {
          if (!pausedRef.current && videoEl.readyState >= 2 && boxRef.current) {
            // Mostly the guide frame (fast, sharp), sometimes the whole visible area
            const wide = attempt % 3 === 2;
            const canvas = grabFrameCanvas(
              videoEl,
              boxRef.current,
              zoomUsedRef.current,
              wide ? 1 : FRAME_W + 0.1,
              wide ? 1 : FRAME_H + 0.15
            );
            attempt++;
            if (canvas) {
              const code = await detectCode(detector, canvas, acceptRef.current);
              if (code && !cancelled) {
                if (!continuousRef.current) {
                  finishWithCode(code);
                  return;
                }
                const now = Date.now();
                const repeat = code === last.code && now - last.at < REPEAT_BLOCK_MS;
                last = { code, at: now };
                if (!repeat) {
                  onCodeRef.current(code);
                  await wait(SCAN_PAUSE_MS);
                }
              }
            }
          }
          await wait(30);
        }
      } catch (err) {
        console.error('Camera start error:', err);
        if (cancelled) return;

        setIsScanning(false);
        setHasPermissionError(true);

        const errStr = String(err).toLowerCase();
        if (errStr.includes('notallowederror') || errStr.includes('permission') || errStr.includes('denied')) {
          setErrorMessage('Přístup k fotoaparátu byl zamítnut. Pro skenování čárových kódů je potřeba povolit přístup k fotoaparátu v nastavení prohlížeče.');
        } else if (errStr.includes('notfounderror') || errStr.includes('device not found')) {
          setErrorMessage('Žádné vhodné zařízení s fotoaparátem nebylo nalezeno.');
        } else {
          setErrorMessage('Nepodařilo se spustit fotoaparát. Můžeš využít ruční zadání ISBN níže.');
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [finishWithCode]);

  const toggleTorch = async () => {
    const track = streamRef.current && streamRef.current.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    try {
      const nextState = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: nextState }] });
      setTorchOn(nextState);
    } catch (e) {
      console.error('Torch toggle failed:', e);
    }
  };

  return {
    videoRef,
    boxRef,
    isScanning,
    hasPermissionError,
    errorMessage,
    detectedCode,
    digitalZoom,
    torchOn,
    torchSupported,
    toggleTorch,
    finishWithCode,
    grabFrame
  };
}
