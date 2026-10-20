import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Flashlight, ArrowLeft, AlertCircle, KeyRound, Search, ScanLine, Loader2, FolderPlus, Library } from 'lucide-react';

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E
];

// Formats for the browser's native BarcodeDetector (Chrome / Android)
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

// How long the "Skenovat" button keeps trying fresh camera frames before giving up
const CAPTURE_TIMEOUT_MS = 4000;
// A code read by the live preview is reused by the button if it is at most this old
const RECENT_DETECTION_MS = 2000;

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

let nativeDetector;
function getNativeDetector() {
  if (nativeDetector !== undefined) return nativeDetector;
  nativeDetector = null;
  try {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      nativeDetector = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
    }
  } catch (e) {
    nativeDetector = null;
  }
  return nativeDetector;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Crop the middle band of the video (where the guide frame is) and upscale it,
// so thin barcode bars stay sharp enough for the decoder.
function grabFrameCanvas(videoEl, cropToGuide) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return null;

  const sw = cropToGuide ? Math.round(vw * 0.9) : vw;
  const sh = cropToGuide ? Math.round(vh * 0.5) : vh;
  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);
  const scale = Math.max(1, Math.min(2, 1600 / sw));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function decodeCanvas(canvas, fileDecoder) {
  const detector = getNativeDetector();
  if (detector) {
    try {
      const results = await detector.detect(canvas);
      for (const result of results) {
        const code = toValidBookCode(result.rawValue);
        if (code) return code;
      }
    } catch (e) {
      // fall back to ZXing below
    }
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  try {
    const result = await fileDecoder.scanFileV2(new File([blob], 'frame.png', { type: 'image/png' }), false);
    return toValidBookCode(result?.decodedText);
  } catch (e) {
    return null;
  }
}

export default function BookScanner({
  libraries = [],
  selectedLibraryId = '',
  onSelectLibrary,
  onIsbnDetected,
  onClose
}) {
  const html5QrcodeScanner = useRef(null);
  const fileDecoderRef = useRef(null);
  const lastLiveDetection = useRef(null);
  const hasFinished = useRef(false);
  const onIsbnDetectedRef = useRef(onIsbnDetected);
  onIsbnDetectedRef.current = onIsbnDetected;

  const [isScanning, setIsScanning] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [captureError, setCaptureError] = useState('');
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);
  const [detectedCode, setDetectedCode] = useState('');

  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [manualError, setManualError] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  const stopCamera = async () => {
    const scanner = html5QrcodeScanner.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch (e) {
      // ignore stop errors
    }
  };

  // Hand a detected code to the app exactly once
  const finishWithCode = async (code) => {
    if (hasFinished.current) return;
    hasFinished.current = true;
    setDetectedCode(code);
    await stopCamera();
    onIsbnDetectedRef.current(code);
  };

  useEffect(() => {
    let isMounted = true;
    const scannerId = 'reader-video-container';

    const startScanner = async () => {
      try {
        setHasPermissionError(false);
        setErrorMessage('');
        setCaptureError('');

        const qrInstance = new Html5Qrcode(scannerId, {
          formatsToSupport: SUPPORTED_FORMATS,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false
        });
        html5QrcodeScanner.current = qrInstance;

        fileDecoderRef.current = new Html5Qrcode('file-decoder-temp', {
          formatsToSupport: SUPPORTED_FORMATS,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false
        });

        const config = {
          fps: 15,
          // Wide, low scan box that matches the shape of a book barcode
          qrbox: (viewfinderWidth, viewfinderHeight) => ({
            width: Math.max(50, Math.round(viewfinderWidth * 0.85)),
            height: Math.max(50, Math.round(viewfinderHeight * 0.45))
          }),
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' }]
          }
        };

        // The live preview decodes continuously: a valid code is used immediately,
        // so simply pointing the camera at the barcode is enough.
        await qrInstance.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            const code = toValidBookCode(decodedText);
            if (!code) return;
            lastLiveDetection.current = { code, at: Date.now() };
            finishWithCode(code);
          },
          () => {
            // No code in this frame - keep looking
          }
        );

        if (isMounted) {
          setIsScanning(true);
          try {
            const capabilities = qrInstance.getRunningTrackCapabilities();
            if (capabilities && capabilities.torch) {
              setTorchSupported(true);
            }
          } catch (e) {
            setTorchSupported(false);
          }
        } else {
          stopCamera();
        }
      } catch (err) {
        console.error('Html5Qrcode start error:', err);
        if (!isMounted) return;

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

    const timeout = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      stopCamera();
    };
  }, []);

  const toggleTorch = async () => {
    if (!html5QrcodeScanner.current || !torchSupported) return;
    try {
      const nextState = !torchOn;
      await html5QrcodeScanner.current.applyVideoConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
    } catch (e) {
      console.error('Torch toggle failed:', e);
    }
  };

  const handleCaptureAndScan = async () => {
    if (isProcessingFrame) return;
    setCaptureError('');

    const recent = lastLiveDetection.current;
    if (recent && Date.now() - recent.at < RECENT_DETECTION_MS) {
      finishWithCode(recent.code);
      return;
    }

    setIsProcessingFrame(true);
    try {
      const container = document.getElementById('reader-video-container');
      const videoEl = container ? container.querySelector('video') : null;
      if (!videoEl || videoEl.readyState < 2 || !fileDecoderRef.current) {
        setCaptureError('Fotoaparát ještě není připraven.');
        return;
      }

      // One frame is often blurry, so keep trying fresh frames for a few seconds,
      // alternating between the guide area and the whole picture.
      const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
      let attempt = 0;
      while (Date.now() < deadline && !hasFinished.current) {
        const canvas = grabFrameCanvas(videoEl, attempt % 2 === 0);
        attempt++;
        if (canvas) {
          const code = await decodeCanvas(canvas, fileDecoderRef.current);
          if (code) {
            await finishWithCode(code);
            return;
          }
        }
        await wait(120);
      }

      if (!hasFinished.current) {
        setCaptureError('Čárový kód se nepodařilo přečíst. Podrž knihu v klidu asi 10–15 cm od fotoaparátu, ať je kód ostrý a celý v rámečku, případně rozsviť světlo.');
      }
    } catch (err) {
      console.error('Capture and scan error:', err);
      setCaptureError('Při skenování fotky došlo k chybě. Zkuste to prosím znovu.');
    } finally {
      setIsProcessingFrame(false);
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
      {/* Hidden container for temp file decoding */}
      <div id="file-decoder-temp" className="hidden" />

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
      <div className="relative w-full aspect-4/3 bg-stone-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
        {/* Scanner HTML container */}
        <div id="reader-video-container" className="w-full h-full object-cover" />

        {/* Target Overlay UI */}
        {isScanning && !hasPermissionError && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            {/* Guide Frame Box */}
            <div className="w-64 h-36 border-2 border-burgundy-500/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-white rounded-br-lg" />

              {/* Center line */}
              <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-burgundy-500/70" />
            </div>

            <p className="text-white text-xs font-semibold mt-3 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-md text-center">
              Zaměř čárový kód do rámečku – načte se sám
            </p>
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

      {/* Manual Capture Button */}
      {isScanning && !hasPermissionError && (
        <div className="flex flex-col items-center space-y-2">
          <button
            onClick={handleCaptureAndScan}
            disabled={isProcessingFrame || !!detectedCode}
            className="w-full py-3.5 px-4 bg-burgundy-900 hover:bg-burgundy-800 text-white font-bold rounded-2xl flex items-center justify-center space-x-2 shadow-lg active:scale-98 transition-all disabled:opacity-60"
          >
            {isProcessingFrame ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>Probíhá skenování...</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span>Vyfotit a naskenovat kód</span>
              </>
            )}
          </button>

          {detectedCode && (
            <p className="text-xs font-semibold text-stone-700 text-center px-2 py-1 bg-stone-100 rounded-xl border border-stone-200 flex items-center space-x-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Načteno {detectedCode}, hledám knihu…</span>
            </p>
          )}

          {captureError && (
            <p className="text-xs font-semibold text-red-600 text-center px-2 py-1 bg-red-50 rounded-xl border border-red-100">
              {captureError}
            </p>
          )}
        </div>
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
