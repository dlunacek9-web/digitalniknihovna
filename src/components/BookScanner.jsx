import React, { useState } from 'react';
import { Flashlight, SwitchCamera, ArrowLeft, AlertCircle, KeyRound, Search, ScanLine, Loader2, Library, BookPlus } from 'lucide-react';
import { FRAME_H, FRAME_W, useBarcodeCamera } from '../lib/useBarcodeCamera';

function cleanIsbnFrontend(isbnStr) {
  if (!isbnStr) return '';
  return String(isbnStr).replace(/[- \s]/g, '').trim().toUpperCase();
}

export default function BookScanner({
  libraries = [],
  selectedLibraryId = '',
  onSelectLibrary,
  keepScanning = false,
  onKeepScanningChange,
  onIsbnDetected,
  onManualEntry,
  onClose
}) {
  const {
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
    canFlip,
    flipCamera,
    finishWithCode
  } = useBarcodeCamera({ onCode: onIsbnDetected });

  const [manualIsbn, setManualIsbn] = useState('');
  const [manualError, setManualError] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    setManualError('');
    const cleaned = cleanIsbnFrontend(manualIsbn);
    if (!cleaned) {
      setManualError('Zadej číslo ISBN.');
      return;
    }
    if (!/^(?:\d{9}[\dX]|\d{13})$/.test(cleaned)) {
      setManualError('ISBN má mít 10 nebo 13 číslic. Kniha bez ISBN? Přidej ji ručně níže.');
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
          type="button"
          onClick={onClose}
          className="flex items-center space-x-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zpět do chaty</span>
        </button>

        <span className="text-xs font-bold text-burgundy-900 flex items-center space-x-1">
          <ScanLine className="w-4 h-4" />
          <span>Skener ISBN</span>
        </span>
      </div>

      {/* Dropdown for Target Library selection above camera */}
      <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200/80">
        {libraries.length > 0 && (
          <>
            <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <Library className="w-3.5 h-3.5 text-burgundy-900" />
              <span>Ukládat do chaty:</span>
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
          </>
        )}
        <label className="mt-2.5 flex items-center space-x-2 text-xs font-semibold text-stone-700 cursor-pointer">
          <input
            type="checkbox"
            checked={keepScanning}
            onChange={(e) => onKeepScanningChange && onKeepScanningChange(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
            style={{ minHeight: 0 }}
          />
          <span>Zůstat ve skeneru po uložení knihy</span>
        </label>
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

        {/* Přepnutí přední / zadní kamery */}
        {isScanning && canFlip && (
          <button
            type="button"
            onClick={flipCamera}
            aria-label="Otočit kameru"
            title="Otočit kameru"
            className="absolute top-3 left-3 p-2.5 rounded-full shadow-md bg-black/50 text-white hover:bg-black/70 backdrop-blur-md"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>
        )}

        {/* Torch Button */}
        {isScanning && torchSupported && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-label={torchOn ? 'Vypnout svítilnu' : 'Zapnout svítilnu'}
            aria-pressed={torchOn}
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
              inputMode="numeric"
              aria-label="ISBN"
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
            <p className="text-[11px] text-red-600 font-medium pl-1" role="alert">{manualError}</p>
          )}
        </form>
      </div>

      {onManualEntry && (
        <button
          type="button"
          onClick={onManualEntry}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl border border-dashed border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          <BookPlus className="w-4 h-4" />
          <span>Kniha nemá ISBN? Přidat ručně</span>
        </button>
      )}
    </div>
  );
}
