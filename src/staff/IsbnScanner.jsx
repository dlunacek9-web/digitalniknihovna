import React, { useEffect, useState } from 'react';
import { Barcode, Camera, Flashlight, TextCursorInput, X } from 'lucide-react';
import { toValidIsbn } from '../lib/isbn';
import { readIsbnFromImage, readIsbnFromPhoto, stopOcr } from '../lib/isbnOcr';
import { FRAME_H, FRAME_W, useBarcodeCamera } from '../lib/useBarcodeCamera';

const OCR_PAUSE_MS = 300;
const OCR_FAILED = 'Čtení textu se nepodařilo spustit. Zkontroluj připojení, nebo ISBN opiš ručně.';

export default function IsbnScanner({ onCode, onClose }) {
  const [mode, setMode] = useState('barcode'); // barcode | text
  const [ocrError, setOcrError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState('');
  const camera = useBarcodeCamera({ onCode, accept: toValidIsbn, paused: mode !== 'barcode' || photoBusy });
  const { isScanning, grabFrame, finishWithCode } = camera;

  useEffect(() => stopOcr, []);

  // Čte snímky jeden po druhém, dokud nenajde číslo s platnou kontrolní číslicí.
  useEffect(() => {
    if (mode !== 'text' || !isScanning || photoBusy) return undefined;
    let cancelled = false;
    setOcrError('');

    (async () => {
      try {
        while (!cancelled) {
          const canvas = grabFrame();
          const code = canvas ? await readIsbnFromImage(canvas) : null;
          if (cancelled) return;
          if (code) {
            finishWithCode(code);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, OCR_PAUSE_MS));
        }
      } catch (err) {
        console.error('OCR error:', err);
        if (!cancelled) setOcrError(OCR_FAILED);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, isScanning, photoBusy, grabFrame, finishWithCode]);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setPhotoNote('');
    setOcrError('');
    try {
      const code = await readIsbnFromPhoto(file);
      if (code) finishWithCode(code);
      else setPhotoNote('Na fotce se ISBN nepodařilo přečíst. Zkus ostřejší snímek, nebo číslo opiš ručně.');
    } catch (err) {
      console.error('Photo read error:', err);
      setOcrError(OCR_FAILED);
    } finally {
      setPhotoBusy(false);
    }
  };

  const status = camera.detectedCode
    ? `Načteno ${camera.detectedCode}.`
    : photoBusy
      ? 'Čtu fotku…'
      : !isScanning
        ? (camera.hasPermissionError ? '' : 'Spouštím kameru…')
        : mode === 'barcode'
          ? 'Namiř čárový kód do rámečku.'
          : 'Namiř vytištěné číslo ISBN do rámečku a chvíli podrž. První čtení může trvat déle.';

  return (
    <section className="staff-scanner" aria-label="Skener ISBN">
      <div className="staff-scanner__bar">
        <div className="staff-scanner__modes" role="group" aria-label="Co číst">
          <button
            type="button"
            className={`plain-btn ${mode === 'barcode' ? 'plain-btn--primary' : ''}`}
            aria-pressed={mode === 'barcode'}
            onClick={() => setMode('barcode')}
          >
            <Barcode size={15} /> Čárový kód
          </button>
          <button
            type="button"
            className={`plain-btn ${mode === 'text' ? 'plain-btn--primary' : ''}`}
            aria-pressed={mode === 'text'}
            onClick={() => setMode('text')}
          >
            <TextCursorInput size={15} /> Vytištěné číslo
          </button>
        </div>
        <button type="button" className="plain-btn" onClick={onClose}>
          <X size={15} /> Zavřít skener
        </button>
      </div>

      <div ref={camera.boxRef} className="staff-scanner__view">
        <video
          ref={camera.videoRef}
          playsInline
          muted
          autoPlay
          style={camera.digitalZoom > 1 ? { transform: `scale(${camera.digitalZoom})` } : undefined}
        />
        {isScanning && !camera.detectedCode && (
          <div className="staff-scanner__frame" style={{ width: `${FRAME_W * 100}%`, height: `${FRAME_H * 100}%` }} />
        )}
        {camera.hasPermissionError && <p className="staff-scanner__error">{camera.errorMessage}</p>}
      </div>

      {status && <p className="plain-muted" role="status">{status}</p>}
      {ocrError && <p className="plain-error" role="alert">{ocrError}</p>}
      {photoNote && <p className="plain-warn" role="status">{photoNote}</p>}

      <div className="plain-actions">
        <label className={`plain-btn ${photoBusy ? 'is-disabled' : ''}`}>
          <Camera size={15} /> Přečíst z fotky
          <input
            type="file"
            accept="image/*"
            className="staff-visually-hidden"
            disabled={photoBusy}
            onChange={handlePhoto}
          />
        </label>
        {camera.torchSupported && isScanning && (
          <button type="button" className="plain-btn" aria-pressed={camera.torchOn} onClick={camera.toggleTorch}>
            <Flashlight size={15} /> {camera.torchOn ? 'Zhasnout' : 'Přisvítit'}
          </button>
        )}
      </div>
    </section>
  );
}
