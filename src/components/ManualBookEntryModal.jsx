import React, { useState } from 'react';
import { X, BookPlus, Sparkles } from 'lucide-react';

export default function ManualBookEntryModal({ initialIsbn, onConfirm, onCancel }) {
  const [isbn, setIsbn] = useState(initialIsbn || '');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [publisher, setPublisher] = useState('');
  const [publicationDate, setPublicationDate] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vyplňte prosím název knihy.');
      return;
    }

    onConfirm({
      isbn: isbn.trim() || initialIsbn,
      title: title.trim(),
      authors: authors.trim() || 'Neznámý autor',
      publisher: publisher.trim() || null,
      publication_date: publicationDate.trim() || null,
      page_count: pageCount ? parseInt(pageCount, 10) : null,
      description: description.trim() || null,
      cover_url: coverUrl.trim() || null
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200">

        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-stone-100 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-burgundy-900/10 text-burgundy-900 flex items-center justify-center">
              <BookPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Přidat knihu ručně</h3>
              <p className="text-[11px] text-stone-500">Kniha nebyla nalezena v databázi</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200/60 rounded-2xl text-xs text-amber-900 flex items-start space-x-2">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>Kniha s kódem <strong>{initialIsbn}</strong> nebyla nalezena. Můžete její údaje vyplnit ručně níže.</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
              ISBN / Čárový kód
            </label>
            <input
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="ISBN"
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
              Název knihy <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Např. Babička"
              required
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
              Autor / Autoři
            </label>
            <input
              type="text"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="Např. Božena Němcová"
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Nakladatelství
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="Např. Albatros"
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Rok vydání
              </label>
              <input
                type="text"
                value={publicationDate}
                onChange={(e) => setPublicationDate(e.target.value)}
                placeholder="Např. 2020"
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Počet stran
              </label>
              <input
                type="number"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                placeholder="Např. 250"
                min="1"
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                URL obálky (volitelné)
              </label>
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
              Popis knihy
            </label>
            <textarea
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Stručný popis nebo anotace..."
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900 resize-none"
            />
          </div>

          <div className="pt-2 flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-burgundy-900 hover:bg-burgundy-800 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
            >
              Uložit do knihovny
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
