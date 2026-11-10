import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Flashlight, SwitchCamera } from 'lucide-react';
import { applyBookToForm, EMPTY_CATALOG_FORM, formToRow } from '../lib/catalog';
import { toValidIsbn } from '../lib/isbn';
import { useAction } from '../lib/useAsync';
import { FRAME_H, FRAME_W, useBarcodeCamera } from '../lib/useBarcodeCamera';
import { lookupByIsbn } from '../services/knihovnyApi';
import { addCatalogItems } from '../services/publicLibraryApi';
import { plural } from '../services/genres';

const LOOKUP_PARALLEL = 4;
const TICK_MS = 700;

const FIELDS = [
  ['title', 'Název *'],
  ['authors', 'Autoři'],
  ['isbn', 'ISBN'],
  ['publisher', 'Nakladatel'],
  ['year', 'Rok vydání'],
  ['genre', 'Žánr'],
  ['inventory_number', 'Inventární číslo']
];

const countLabel = (n) => `${n} ${plural(n, 'výtisk', 'výtisky', 'výtisků')}`;

/** Fáze 1: kamera běží, každý přečtený kód jen zvýší počítadlo. */
function ScanPhase({ onFinish, onCancel }) {
  const [codes, setCodes] = useState([]);
  const [tick, setTick] = useState(false);
  const tickTimer = useRef(null);

  const onCode = useCallback((code) => {
    setCodes((current) => [...current, code]);
    setTick(true);
    navigator.vibrate?.(60);
    clearTimeout(tickTimer.current);
    tickTimer.current = setTimeout(() => setTick(false), TICK_MS);
  }, []);
  useEffect(() => () => clearTimeout(tickTimer.current), []);

  const camera = useBarcodeCamera({ onCode, accept: toValidIsbn, continuous: true });

  return (
    <section className="staff-scanner" aria-label="Hromadné skenování">
      <div ref={camera.boxRef} className="staff-scanner__view">
        <video
          ref={camera.videoRef}
          playsInline
          muted
          autoPlay
          style={camera.digitalZoom > 1 ? { transform: `scale(${camera.digitalZoom})` } : undefined}
        />
        {camera.isScanning && (
          <div
            className={`staff-scanner__frame ${tick ? 'is-hit' : ''}`}
            style={{ width: `${FRAME_W * 100}%`, height: `${FRAME_H * 100}%` }}
          />
        )}
        {tick && (
          <div className="staff-scanner__tick" aria-hidden="true">
            <Check size={56} strokeWidth={3} />
          </div>
        )}
        {camera.hasPermissionError && <p className="staff-scanner__error">{camera.errorMessage}</p>}
      </div>

      <p className="plain-muted" role="status">
        {camera.isScanning || camera.hasPermissionError
          ? `Přidržuj kódy před kamerou jeden po druhém. Naskenováno: ${codes.length}.`
          : 'Spouštím kameru…'}
      </p>

      <div className="plain-actions">
        <button
          type="button"
          className="plain-btn plain-btn--primary"
          onClick={() => onFinish(codes)}
        >
          Ukončit skenování ({codes.length})
        </button>
        {camera.canFlip && camera.isScanning && (
          <button type="button" className="plain-btn" onClick={camera.flipCamera}>
            <SwitchCamera size={15} /> Otočit kameru
          </button>
        )}
        {camera.torchSupported && camera.isScanning && (
          <button type="button" className="plain-btn" aria-pressed={camera.torchOn} onClick={camera.toggleTorch}>
            <Flashlight size={15} /> {camera.torchOn ? 'Zhasnout' : 'Přisvítit'}
          </button>
        )}
        <button type="button" className="plain-btn" onClick={onCancel}>Zrušit</button>
      </div>
    </section>
  );
}

function ReviewRow({ entry, onChange, onRemove }) {
  const [editing, setEditing] = useState(false);
  const { form } = entry;
  const missingTitle = entry.state !== 'loading' && !form.title.trim();

  return (
    <li className={`staff-bulk__row ${missingTitle ? 'is-problem' : ''}`}>
      <div className="staff-bulk__head">
        <div className="staff-bulk__text">
          <b>{form.title || 'Bez názvu'}</b>
          <small>
            {entry.state === 'loading' && 'Hledám údaje…'}
            {entry.state === 'notfound' && 'Kniha nebyla nalezena, doplň údaje ručně. '}
            {[form.authors, form.publisher, form.year, form.isbn && `ISBN ${form.isbn}`].filter(Boolean).join(' · ')}
          </small>
        </div>
        <div className="staff-row-actions">
          <button type="button" className="plain-btn" aria-expanded={editing} onClick={() => setEditing(!editing)}>
            {editing ? 'Hotovo' : 'Upravit'}
          </button>
          <button type="button" className="plain-btn" onClick={onRemove}>Smazat</button>
        </div>
      </div>
      {(editing || missingTitle) && (
        <div className="staff-form-grid staff-bulk__form">
          {FIELDS.map(([key, label]) => (
            <label key={key}>
              {label}
              <input value={form[key]} onChange={(e) => onChange({ ...form, [key]: e.target.value })} />
            </label>
          ))}
        </div>
      )}
    </li>
  );
}

/** Fáze 2: seznam naskenovaných knih k úpravě a uložení. */
function ReviewPhase({ libraryId, codes, onSaved, onCancel }) {
  const [entries, setEntries] = useState(() =>
    codes.map((isbn, index) => ({
      key: index,
      state: 'loading',
      form: { ...EMPTY_CATALOG_FORM, isbn }
    }))
  );
  const save = useAction();

  // Údaje se dohledávají po několika najednou; stejné ISBN se hledá jen jednou.
  useEffect(() => {
    let cancelled = false;
    const cache = new Map();
    const lookup = (isbn) => {
      if (!cache.has(isbn)) {
        cache.set(isbn, lookupByIsbn(isbn).catch((err) => ({ success: false, error: err.message })));
      }
      return cache.get(isbn);
    };
    const queue = codes.map((isbn, index) => ({ isbn, index }));

    const worker = async () => {
      for (let job = queue.shift(); job && !cancelled; job = queue.shift()) {
        const result = await lookup(job.isbn);
        if (cancelled) return;
        setEntries((current) =>
          current.map((entry) =>
            entry.key !== job.index
              ? entry
              : result.success
                ? { ...entry, state: 'ok', form: applyBookToForm(entry.form, result.book) }
                : { ...entry, state: 'notfound' }
          )
        );
      }
    };
    Promise.all(Array.from({ length: LOOKUP_PARALLEL }, worker));
    return () => {
      cancelled = true;
    };
  }, [codes]);

  const loading = entries.some((entry) => entry.state === 'loading');

  const update = (key, form) =>
    setEntries((current) => current.map((entry) => (entry.key === key ? { ...entry, form } : entry)));
  const remove = (key) => setEntries((current) => current.filter((entry) => entry.key !== key));

  const saveAll = () => {
    save.run(async () => {
      const rows = entries.map((entry, index) => {
        try {
          return formToRow(entry.form);
        } catch (err) {
          throw new Error(`Kniha č. ${index + 1} (${entry.form.isbn || 'bez ISBN'}): ${err.message}`);
        }
      });
      await addCatalogItems(libraryId, rows);
      onSaved(rows.length);
    });
  };

  return (
    <section className="staff-panel" aria-label="Naskenované knihy">
      <div className="staff-head">
        <h2>Naskenováno: {countLabel(entries.length)}</h2>
        <div className="plain-actions">
          <button
            type="button"
            className="plain-btn plain-btn--primary"
            disabled={save.busy || loading || entries.length === 0}
            onClick={saveAll}
          >
            {save.busy ? 'Ukládám…' : loading ? 'Hledám údaje…' : `Uložit vše (${entries.length})`}
          </button>
          <button type="button" className="plain-btn" disabled={save.busy} onClick={onCancel}>Zahodit</button>
        </div>
      </div>

      {save.error && <p className="plain-error" role="alert" style={{ marginBottom: 12 }}>{save.error}</p>}
      {entries.length === 0 && <p className="staff-empty">Seznam je prázdný.</p>}

      <ul className="staff-bulk">
        {entries.map((entry) => (
          <ReviewRow
            key={entry.key}
            entry={entry}
            onChange={(form) => update(entry.key, form)}
            onRemove={() => remove(entry.key)}
          />
        ))}
      </ul>
    </section>
  );
}

export default function BulkScan({ libraryId, onSaved, onClose }) {
  const [codes, setCodes] = useState(null); // null = skenuje se, pole = kontrola seznamu

  if (codes === null) {
    return <ScanPhase onFinish={setCodes} onCancel={onClose} />;
  }
  return <ReviewPhase libraryId={libraryId} codes={codes} onSaved={onSaved} onCancel={onClose} />;
}
