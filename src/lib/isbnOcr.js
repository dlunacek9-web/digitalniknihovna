import { extractIsbnFromText, toValidIsbn } from './isbn';
import { detectCode, getDetector } from './useBarcodeCamera';

const MAX_PHOTO_SIDE = 2000;
// Rozptýlený text: číslo může být v rohu tiráže i samotné pod čárovým kódem.
const SPARSE_TEXT = '11';

let workerPromise = null;

// Knihovna se stahuje až při prvním čtení textu. Jádro a jazyková data načítá
// z CDN, obrázek ale zůstává v prohlížeči.
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789Xx-ISBN :',
        tessedit_pageseg_mode: SPARSE_TEXT
      });
      return worker;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

export async function stopOcr() {
  const pending = workerPromise;
  workerPromise = null;
  if (pending) (await pending.catch(() => null))?.terminate();
}

/** Přečte vytištěné ISBN z obrázku. Vrací null, když v něm žádné platné není. */
export async function readIsbnFromImage(canvas) {
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas);
  return extractIsbnFromText(data.text);
}

async function photoToCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Z fotky zkusí nejdřív čárový kód, který je rychlý a přesný, potom vytištěné číslo. */
export async function readIsbnFromPhoto(file) {
  const canvas = await photoToCanvas(file);
  const detector = await getDetector().catch(() => null);
  const barcode = detector ? await detectCode(detector, canvas, toValidIsbn) : null;
  return barcode || readIsbnFromImage(canvas);
}
