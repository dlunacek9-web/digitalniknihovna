import React, { useMemo, useRef, useState } from 'react';
import { useStaffContext } from './StaffApp';
import { useAction, useAsync } from '../lib/useAsync';
import {
  analyzeCatalog,
  copyPreset,
  editionPreset,
  EMPTY_FILTERS,
  filterCatalog,
  optionsFor,
  sortCatalog,
  SORT_OPTIONS
} from '../lib/catalog';
import { ITEM_STATUS_LABELS } from '../lib/loanRules';
import { plural } from '../services/genres';
import { buildCatalogCsv, catalogCsvFileName, parseCatalogCsv } from '../lib/catalogCsv';
import { downloadFile } from '../services/libraryBackup';
import { addCatalogItems, deleteCatalogItem, listCatalog, setItemStatus } from '../services/publicLibraryApi';
import { ConfirmButton, LoadState } from '../pages/PlainParts';
import BulkScan from './BulkScan';
import ItemForm from './ItemForm';

const TAG_CLASS = { available: 'is-ok', reserved: 'is-warn', on_loan: 'is-warn', unavailable: 'is-off' };

function groupLabel(group) {
  const parts = [];
  if (group?.copies > 1) parts.push(`${group.copies} ${plural(group.copies, 'výtisk', 'výtisky', 'výtisků')} tohoto vydání`);
  if (group?.editions > 1) parts.push(`${group.editions} ${plural(group.editions, 'vydání', 'vydání', 'vydání')} knihy`);
  return parts.join(' · ');
}

export default function Catalog() {
  const { library } = useStaffContext();
  const { data, loading, error, reload } = useAsync(() => listCatalog(library.id), [library.id]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('newest');
  const [formState, setFormState] = useState(null); // null | { key, editing, preset, heading }
  const formKey = useRef(0);
  const action = useAction();
  const [bulk, setBulk] = useState(false);
  const [importPlan, setImportPlan] = useState(null); // null | { fileName, rows, errors }
  const [notice, setNotice] = useState('');
  const importAction = useAction();

  const allItems = data ?? [];
  const groups = useMemo(() => analyzeCatalog(allItems), [data]);
  const items = useMemo(
    () => sortCatalog(filterCatalog(allItems, filters, groups), sort),
    [data, filters, groups, sort]
  );
  const genres = useMemo(() => optionsFor(allItems, 'genre'), [data]);
  const publishers = useMemo(() => optionsFor(allItems, 'publisher'), [data]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const filtersActive = Object.keys(EMPTY_FILTERS).some((key) => filters[key] !== EMPTY_FILTERS[key]);

  const openForm = (next) => {
    formKey.current += 1;
    setFormState({ key: formKey.current, editing: null, preset: null, heading: 'Přidat výtisk', ...next });
  };
  const openEdit = (item) => openForm({ editing: item, heading: 'Upravit výtisk' });

  const changeStatus = (item, status) => {
    action.run(async () => {
      await setItemStatus(item.id, status);
      await reload();
    });
  };

  const exportCsv = () => {
    downloadFile(catalogCsvFileName(), buildCatalogCsv(allItems), 'text/csv;charset=utf-8');
  };

  const chooseImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNotice('');
    importAction.clearError();
    setImportPlan({ fileName: file.name, ...parseCatalogCsv(await file.text(), allItems) });
  };

  const runImport = () => {
    importAction.run(async () => {
      await addCatalogItems(library.id, importPlan.rows.map((entry) => entry.row));
      setNotice(`Naimportováno ${importPlan.rows.length} ${plural(importPlan.rows.length, 'výtisk', 'výtisky', 'výtisků')}.`);
      setImportPlan(null);
      await reload();
    });
  };

  const removeItem = (item) => {
    action.run(async () => {
      await deleteCatalogItem(item.id);
      if (formState?.editing?.id === item.id) setFormState(null);
      await reload();
    });
  };

  return (
    <>
      <header className="staff-head">
        <h1>Katalog</h1>
        <div className="plain-actions">
          <button type="button" className="plain-btn" disabled={!allItems.length} onClick={exportCsv}>
            Exportovat tabulku
          </button>
          <label className="plain-btn">
            Importovat tabulku
            <input type="file" accept=".csv,text/csv" className="staff-visually-hidden" onChange={chooseImportFile} />
          </label>
          <button
            type="button"
            className="plain-btn"
            onClick={() => {
              setFormState(null);
              setNotice('');
              setBulk(true);
            }}
          >
            Hromadné skenování
          </button>
          <button type="button" className="plain-btn plain-btn--primary" onClick={() => { setBulk(false); openForm(); }}>
            Přidat výtisk
          </button>
        </div>
      </header>

      {notice && <p className="plain-notice" role="status" style={{ marginBottom: 12 }}>{notice}</p>}

      {bulk && (
        <BulkScan
          libraryId={library.id}
          onClose={() => setBulk(false)}
          onSaved={(count) => {
            setBulk(false);
            setNotice(`Uloženo ${count} ${plural(count, 'výtisk', 'výtisky', 'výtisků')}.`);
            reload();
          }}
        />
      )}

      {importPlan && (
        <section className="staff-panel" aria-label="Import tabulky">
          <h2>Import: {importPlan.fileName}</h2>
          <p>
            K importu je {importPlan.rows.length} {plural(importPlan.rows.length, 'výtisk', 'výtisky', 'výtisků')}
            {importPlan.errors.length > 0 && `, ${importPlan.errors.length} ř. s chybou se přeskočí`}.
          </p>
          {importPlan.errors.length > 0 && (
            <ul className="plain-warn staff-similar" role="status">
              {importPlan.errors.slice(0, 20).map((err) => (
                <li key={`${err.line}-${err.message}`}>{err.line ? `Řádek ${err.line}: ` : ''}{err.message}</li>
              ))}
              {importPlan.errors.length > 20 && <li>… a dalších {importPlan.errors.length - 20}</li>}
            </ul>
          )}
          {importAction.error && <p className="plain-error" role="alert">{importAction.error}</p>}
          <div className="plain-actions">
            <button
              type="button"
              className="plain-btn plain-btn--primary"
              disabled={importAction.busy || importPlan.rows.length === 0}
              onClick={runImport}
            >
              {importAction.busy ? 'Importuji…' : `Importovat ${importPlan.rows.length}`}
            </button>
            <button type="button" className="plain-btn" disabled={importAction.busy} onClick={() => setImportPlan(null)}>
              Zrušit
            </button>
          </div>
        </section>
      )}

      {formState && (
        <ItemForm
          key={formState.key}
          libraryId={library.id}
          editing={formState.editing}
          preset={formState.preset}
          heading={formState.heading}
          items={allItems}
          onEdit={openEdit}
          onCancel={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            reload();
          }}
        />
      )}

      <div className="staff-toolbar">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilter('query', e.target.value)}
          placeholder="Hledat název, autora, ISBN…"
          aria-label="Hledat v katalogu"
        />
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Filtrovat podle stavu">
          <option value="">Všechny stavy</option>
          {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={filters.genre} onChange={(e) => setFilter('genre', e.target.value)} aria-label="Filtrovat podle žánru">
          <option value="">Všechny žánry</option>
          {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
        </select>
        <select value={filters.publisher} onChange={(e) => setFilter('publisher', e.target.value)} aria-label="Filtrovat podle nakladatele">
          <option value="">Všichni nakladatelé</option>
          {publishers.map((publisher) => <option key={publisher} value={publisher}>{publisher}</option>)}
        </select>
        <input
          className="staff-toolbar__year"
          type="number"
          value={filters.yearFrom}
          onChange={(e) => setFilter('yearFrom', e.target.value)}
          placeholder="Rok od"
          aria-label="Rok vydání od"
        />
        <input
          className="staff-toolbar__year"
          type="number"
          value={filters.yearTo}
          onChange={(e) => setFilter('yearTo', e.target.value)}
          placeholder="Rok do"
          aria-label="Rok vydání do"
        />
        <select value={filters.isbn} onChange={(e) => setFilter('isbn', e.target.value)} aria-label="Filtrovat podle ISBN">
          <option value="">S ISBN i bez něj</option>
          <option value="with">Jen s ISBN</option>
          <option value="without">Jen bez ISBN</option>
        </select>
        <select value={filters.group} onChange={(e) => setFilter('group', e.target.value)} aria-label="Filtrovat duplicity a vydání">
          <option value="">Všechny knihy</option>
          <option value="copies">Duplicity (víc výtisků)</option>
          <option value="editions">Víc vydání</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Řazení">
          {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {filtersActive && (
          <button type="button" className="plain-btn" onClick={() => setFilters(EMPTY_FILTERS)}>Zrušit filtry</button>
        )}
      </div>

      {action.error && <p className="plain-error" role="alert" style={{ marginBottom: 12 }}>{action.error}</p>}

      <LoadState loading={loading} error={error} hasData={Boolean(data)} onRetry={reload}>
        {data?.length > 0 && <p className="plain-muted staff-count">Zobrazeno {items.length} z {data.length}</p>}
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Název</th>
                <th>ISBN</th>
                <th>Inv. číslo</th>
                <th>Žánr</th>
                <th>Stav</th>
                <th>Akce</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const group = groupLabel(groups.get(item.id));
                return (
                  <tr key={item.id}>
                    <td>
                      {item.title}
                      <small>{[item.authors, item.publisher, item.year].filter(Boolean).join(' · ')}</small>
                      {group && <small className="staff-group">{group}</small>}
                    </td>
                    <td>{item.isbn || <span className="plain-muted">bez ISBN</span>}</td>
                    <td>{item.inventory_number}</td>
                    <td>{item.genre}</td>
                    <td><span className={`staff-tag ${TAG_CLASS[item.status]}`}>{ITEM_STATUS_LABELS[item.status]}</span></td>
                    <td>
                      <div className="staff-row-actions">
                        <button type="button" className="plain-btn" onClick={() => openEdit(item)}>Upravit</button>
                        <button
                          type="button"
                          className="plain-btn"
                          onClick={() => openForm({ preset: copyPreset(item), heading: 'Přidat další výtisk' })}
                        >
                          Další výtisk
                        </button>
                        <button
                          type="button"
                          className="plain-btn"
                          onClick={() => openForm({ preset: editionPreset(item), heading: 'Přidat jiné vydání' })}
                        >
                          Jiné vydání
                        </button>
                        {item.status === 'available' && (
                          <ConfirmButton disabled={action.busy} onConfirm={() => changeStatus(item, 'unavailable')}>Vyřadit</ConfirmButton>
                        )}
                        {item.status === 'unavailable' && (
                          <button type="button" className="plain-btn" disabled={action.busy} onClick={() => changeStatus(item, 'available')}>
                            Vrátit do oběhu
                          </button>
                        )}
                        <ConfirmButton disabled={action.busy} confirmLabel="Opravdu smazat?" onConfirm={() => removeItem(item)}>Smazat</ConfirmButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="staff-empty">{data?.length ? 'Hledání nic nenašlo.' : 'Katalog je prázdný. Přidej první výtisk.'}</p>
          )}
        </div>
      </LoadState>
    </>
  );
}
