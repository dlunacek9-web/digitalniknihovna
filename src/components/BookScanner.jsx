import React, { useEffect, useRef, useState } from 'react';
import { Flashlight, ArrowLeft, AlertCircle, KeyRound, Search, ScanLine, Loader2, Library } from 'lucide-react';

// Formats for BarcodeDetector (native in Chrome / Android, ZXing WASM elsewhere, e.g. iOS)
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

// Light zoom keeps the book further from the lens, where the camera can still focus
const TARGET_ZOOM = 1.7;
// Size of the guide frame relative to the visible camera area
const FRAME_W = 0.8;
const FRAME_H = 0.4;
const MAX_DECODE_WIDTH = 1280;

function cleanIsbnFrontend(isbnStr) {
  if (!isbnStr) return '';
  return String(isbnStr).replace(/[- \s]/g, '').trim().toUpperCase();
}

function hasValidEanChecksum(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    const weight = (digits.length - 1 - i) % 2 === 1 ? 3 : 1;
    sum += Number(digits[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

function hasValidIsbn10Checksum(code) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const value = code[i] === 'X' ? 10 : Number(code[i]);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

// Accept only codes that pass their check digit, so blurry misreads never reach the lookup
function toValidBookCode(rawText) {
  const code = cleanIsbnFrontend(rawText);
  if (/^\d{13}$/.test(code) || /^\d{12}$/.test(code) || /^\d{8}$/.test(code)) {
    return hasValidEanChecksum(code) ? code : null;
  }
  if (/^\d{9}[\dX]$/.test(code)) {
    return hasValidIsbn10Checksum(code) ? code : null;
  }
  return null;
}

let detectorPromise;
function getDetector() {
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

async function detectCode(detector, canvas) {
  try {
    const results = await detector.detect(canvas);
    for (const result of results) {
      const code = toValidBookCode(result.rawValue);
      if (code) return code;
    }
  } catch (e) {
    // no code in this frame
  }
  return null;
}

export default function BookScanner({
  libraries = [],
  selectedLibraryId = '',
  onSelectLibrary,
  onIsbnDetected,
  onClose
}) {
  const videoRef = useRef(null);
  const boxRef = useRef(null);
  const streamRef = useRef(null);
  const hasFinished = useRef(false);
  const onIsbnDetectedRef = useRef(onIsbnDetected);
  onIsbnDetectedRef.current = onIsbnDetected;

  const [isScanning, setIsScanning] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [detectedCode, setDetectedCode] = useState('');
  // Digital zoom (CSS + crop) is used only when the camera has no hardware zoom
  const [digitalZoom, setDigitalZoom] = useState(1);

  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [manualError, setManualError] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  const stopCamera = () => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
  };

  // Hand a detected code to the app exactly once
  const finishWithCode = (code) => {
    if (hasFinished.current) return;
    hasFinished.current = true;
    setDetectedCode(code);
    stopCamera();
    onIsbnDetectedRef.current(code);
  };

  useEffect(() => {
    let cancelled = false;
    let zoomUsed = 1;

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
          zoomUsed = TARGET_ZOOM;
          setDigitalZoom(TARGET_ZOOM);
        }
        if (advanced.length) {
          try {
            await track.applyConstraints({ advanced });
          } catch (e) {
            // zoom/focus constraints are optional; fall back to digital zoom
            if (capabilities.zoom && capabilities.zoom.max) {
              zoomUsed = TARGET_ZOOM;
              setDigitalZoom(TARGET_ZOOM);
            }
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
        while (!cancelled && !hasFinished.current) {
          if (videoEl.readyState >= 2 && boxRef.current) {
            // Mostly the guide frame (fast, sharp), sometimes the whole visible area
            const wide = attempt % 3 === 2;
            const canvas = grabFrameCanvas(
              videoEl,
              boxRef.current,
              zoomUsed,
              wide ? 1 : FRAME_W + 0.1,
              wide ? 1 : FRAME_H + 0.15
            );
            attempt++;
            if (canvas) {
              const code = await detectCode(detector, canvas);
              if (code && !cancelled) {
                finishWithCode(code);
                return;
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
  }, []);

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

  const handleManualSubmit = (e) => {
    e.preventDefault();
    setManualError('');
    const cleaned = cleanIsbnFrontend(manualIsbn);
    if (!cleaned) {
      setManualError('Zadejte číslo ISBN.');
      return;
    }
    if (!/^(?:\d{9}[\dX]|\d{13})$/.test(cleaned)) {
      setManualError('Neplatný formát ISBN (má mít 10 nebo 13 číslic).');
      return;
    }

    setIsSearchingManual(true);
    finishWithCode(cleaned);
  };

  return (
    <div className="scanner-view bg-white rounded-3xl p-4 border border-stone-200/80 shadow-md space-y-4 animate-fade-in relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
        <button
          onClick={onClose}
          className="flex items-center space-x-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zpět do knihovny</span>
        </button>

        <span className="text-xs font-bold text-burgundy-900 flex items-center space-x-1">
          <ScanLine className="w-4 h-4" />
          <span>Skener ISBN</span>
        </span>
      </div>

      {/* Dropdown for Target Library selection above camera */}
      <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
        <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
          <Library className="w-3.5 h-3.5 text-burgundy-900" />
          <span>Uložit naskenované knihy do:</span>
        </label>
        <select
          value={selectedLibraryId}
          onChange={(e) => onSelectLibrary && onSelectLibrary(e.target.value)}
          className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900 cursor-pointer shadow-xs"
        >
          {libraries.map((lib) => (
            <option key={lib.id} value={lib.id}>
              {lib.name}
            </option>
          ))}
        </select>
      </div>

      {/* Camera Preview Area */}
      <div
        ref={boxRef}
        className="relative w-full aspect-4/3 bg-stone-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
          style={digitalZoom > 1 ? { transform: `scale(${digitalZoom})` } : undefined}
        />

        {/* Guide frame only */}
        {isScanning && !hasPermissionError && !detectedCode && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="border-2 border-white/90 rounded-2xl"
              style={{ width: `${FRAME_W * 100}%`, height: `${FRAME_H * 100}%` }}
            />
          </div>
        )}

        {/* Torch Button */}
        {isScanning && torchSupported && (
          <button
            onClick={toggleTorch}
            className={`absolute top-3 right-3 p-2.5 rounded-full text-xs font-bold shadow-md transition-all ${
              torchOn
                ? 'bg-amber-400 text-amber-950 scale-105'
                : 'bg-black/50 text-white hover:bg-black/70 backdrop-blur-md'
            }`}
          >
            <Flashlight className="w-4 h-4" />
          </button>
        )}

        {/* Camera Permission / Access Error State */}
        {hasPermissionError && (
          <div className="absolute inset-0 bg-stone-900 p-6 flex flex-col items-center justify-center text-center text-white space-y-3 z-10">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-1">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold">Přístup k fotoaparátu selhal</h4>
            <p className="text-xs text-stone-300 leading-relaxed max-w-xs">{errorMessage}</p>
          </div>
        )}
      </div>

      {detectedCode && (
        <p className="text-xs font-semibold text-stone-700 text-center px-2 py-1 bg-stone-100 rounded-xl border border-stone-200 flex items-center justify-center space-x-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Načteno {detectedCode}, hledám knihu…</span>
        </p>
      )}

      {/* Manual ISBN Input Fallback */}
      <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/70">
        <div className="flex items-center space-x-1.5 mb-2">
          <KeyRound className="w-3.5 h-3.5 text-stone-500" />
          <h4 className="text-xs font-bold text-stone-700">Nemůžeš kód naskenovat? Zadej ISBN ručně</h4>
        </div>

        <form onSubmit={handleManualSubmit} className="space-y-2">
          <div className="flex space-x-2">
            <input
              type="text"
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              placeholder="Např. 9788073880545..."
              className="flex-1 px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
            />
            <button
              type="submit"
              disabled={isSearchingManual}
              className="px-4 py-2.5 bg-burgundy-900 hover:bg-burgundy-800 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Najít</span>
            </button>
          </div>

          {manualError && (
            <p className="text-[11px] text-red-600 font-medium pl-1">{manualError}</p>
          )}
        </form>
      </div>
    </div>
  );
}
