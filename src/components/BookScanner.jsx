import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Flashlight, ArrowLeft, AlertCircle, KeyRound, Search, ScanLine, Loader2, FolderPlus, Library } from 'lucide-react';

function cleanIsbnFrontend(isbnStr) {
  if (!isbnStr) return '';
  return String(isbnStr).replace(/[- \s]/g, '').trim().toUpperCase();
}

export default function BookScanner({
  libraries = [],
  selectedLibraryId = '',
  onSelectLibrary,
  onIsbnDetected,
  onClose
}) {
  const html5QrcodeScanner = useRef(null);

  const [isScanning, setIsScanning] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [captureError, setCaptureError] = useState('');
  const [isProcessingFrame, setIsProcessingFrame] = useState(false);

  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [manualError, setManualError] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const scannerId = 'reader-video-container';

    const startScanner = async () => {
      try {
        setHasPermissionError(false);
        setErrorMessage('');
        setCaptureError('');

        const qrInstance = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E
          ],
          verbose: false
        });

        html5QrcodeScanner.current = qrInstance;

        const config = {
          fps: 10,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.0
        };

        // We provide dummy callback for continuous scan (we won't auto-trigger on decodedText)
        await qrInstance.start(
          { facingMode: 'environment' },
          config,
          () => {
            // No automatic processing on live stream feed; scanning is triggered explicitly by button tap
          },
          () => {
            // Frame scan failure - ignored
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
      if (html5QrcodeScanner.current) {
        try {
          if (html5QrcodeScanner.current.isScanning) {
            html5QrcodeScanner.current.stop().catch(() => {});
          }
        } catch (e) {
          // ignore cleanup errors
        }
      }
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
    setIsProcessingFrame(true);

    try {
      const container = document.getElementById('reader-video-container');
      const videoEl = container ? container.querySelector('video') : null;

      if (!videoEl || videoEl.readyState < 2) {
        setCaptureError('Fotoaparát ještě není připraven.');
        setIsProcessingFrame(false);
        return;
      }

      // Capture frame to canvas
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth || 1280;
      canvas.height = videoEl.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        setCaptureError('Nepodařilo se zachytit snímek z fotoaparátu.');
        setIsProcessingFrame(false);
        return;
      }

      const file = new File([blob], 'captured_frame.png', { type: 'image/png' });

      // Create separate instance for static image decoding
      const fileDecoder = new Html5Qrcode('file-decoder-temp', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E
        ],
        verbose: false
      });

      let decodedText = null;
      try {
        decodedText = await fileDecoder.scanFile(file, false);
      } catch (scanErr) {
        console.log('Static image scan error:', scanErr);
      } finally {
        try {
          fileDecoder.clear();
        } catch (e) {}
      }

      if (decodedText) {
        const cleaned = cleanIsbnFrontend(decodedText);
        if (html5QrcodeScanner.current) {
          try {
            await html5QrcodeScanner.current.stop();
          } catch (e) {}
        }
        onIsbnDetected(cleaned);
      } else {
        setCaptureError('Čárový kód nebyl na fotce rozpoznán. Zkus zamířit přesněji nebo rozsvítit světlo.');
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
    if (html5QrcodeScanner.current) {
      try {
        html5QrcodeScanner.current.stop().catch(() => {});
      } catch (e) {}
    }
    onIsbnDetected(cleaned);
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
              Zaměř čárový kód v rámečku a stiskni tlačítko Skenovat
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
            disabled={isProcessingFrame}
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
