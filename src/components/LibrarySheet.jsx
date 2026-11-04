import React, { useState } from 'react';
import { Check, Edit2, Library, Trash2, X } from 'lucide-react';
import { plural } from '../services/genres';

/** Přepínač knihoven (každá knihovna = vlastní chata) + založení, přejmenování, smazání. */
export default function LibrarySheet({ libraries, counts, activeId, onSelect, onCreate, onRename, onDelete, onClose }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const submitCreate = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
  };

  const submitRename = (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    onRename(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="search-sheet" role="dialog" aria-modal="true" aria-label="Moje knihovny" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-sheet__panel">
        <div className="search-sheet__field">
          <Library size={20} />
          <span className="library-sheet__title">Moje knihovny</span>
          <button type="button" className="round-btn" onClick={onClose} aria-label="Zavřít">
            <X size={18} />
          </button>
        </div>

        <ul className="library-sheet__list">
          {libraries.map((lib) => {
            const count = counts[lib.id] || 0;
            if (editingId === lib.id) {
              return (
                <li key={lib.id}>
                  {libraries.length <= 1 && (
          <p className="library-sheet__warning">Poslední knihovnu nelze smazat. Nejdřív postav novou.</p>
        )}

        <form className="library-sheet__form" onSubmit={submitRename}>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Nový název" autoFocus />
                    <button type="submit" disabled={!editName.trim()}>Uložit</button>
                  </form>
                </li>
              );
            }
            return (
              <li key={lib.id} className={`library-sheet__row ${lib.id === activeId ? 'is-active' : ''}`}>
                <button type="button" onClick={() => onSelect(lib.id)}>
                  <span style={{ minWidth: 0 }}>
                    <b>{lib.name}</b>
                    <small>{count} {plural(count, 'kniha', 'knihy', 'knih')}</small>
                  </span>
                  {lib.id === activeId && <Check size={18} style={{ marginLeft: 'auto', flex: 'none' }} />}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Přejmenovat ${lib.name}`}
                  onClick={() => {
                    setEditingId(lib.id);
                    setEditName(lib.name);
                  }}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  className={`icon-btn is-danger`}
                  disabled={libraries.length <= 1}
                  aria-label={confirmDeleteId === lib.id ? `Opravdu smazat ${lib.name}` : `Smazat ${lib.name}`}
                  title={libraries.length <= 1 ? 'Poslední knihovnu nelze smazat, nejdřív vytvoř novou' : confirmDeleteId === lib.id ? 'Klikni znovu: smaže knihovnu i všechny knihy v ní' : 'Smazat'}
                  onClick={() => {
                    if (confirmDeleteId === lib.id) {
                      onDelete(lib.id);
                      setConfirmDeleteId(null);
                    } else {
                      setConfirmDeleteId(lib.id);
                    }
                  }}
                  style={confirmDeleteId === lib.id ? { color: '#a8443a', background: '#f3d2cd' } : undefined}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
        {confirmDeleteId && (
          <p className="library-sheet__warning">Druhým klepnutím na koš smažeš knihovnu i všechny knihy v ní.</p>
        )}

        <form className="library-sheet__form" onSubmit={submitCreate}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nová knihovna, např. Chalupa" aria-label="Název nové knihovny" />
          <button type="submit" disabled={!newName.trim()}>Postavit chatu</button>
        </form>
      </div>
    </div>
  );
}
