import React, { useRef } from 'react';
import { User, Sparkles, Download, Upload, FileSpreadsheet, Bookmark, Award, ShieldCheck } from 'lucide-react';
import LibraryStats from './LibraryStats';
import { exportLibraryData, importLibraryData } from '../services/libraryStore';
import { buildJsonBackup, buildCsv, parseJsonBackup, backupFileName, downloadFile } from '../services/libraryBackup';

export default function ProfileView({ books, onDataImported, showNotification }) {
  const fileInputRef = useRef(null);

  const handleExportJson = () => {
    downloadFile(backupFileName('json'), buildJsonBackup(exportLibraryData()), 'application/json');
    showNotification('Záloha knihovny byla stažena.');
  };

  const handleExportCsv = () => {
    downloadFile(backupFileName('csv'), buildCsv(exportLibraryData()), 'text/csv;charset=utf-8');
    showNotification('Seznam knih byl stažen jako CSV.');
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const result = importLibraryData(parseJsonBackup(await file.text()));
      onDataImported();
      const skipped = result.booksSkipped ? `, ${result.booksSkipped} už v knihovně bylo` : '';
      showNotification(`Importováno ${result.booksAdded} knih${skipped}.`);
    } catch (err) {
      showNotification(err.message || 'Import se nezdařil.', 'error');
    }
  };

  const backupButtonClass =
    'flex flex-col items-center justify-center text-center p-3 rounded-2xl border border-stone-200/80 bg-stone-50 hover:bg-burgundy-50 hover:border-burgundy-900/20 active:scale-95 transition-all';

  return (
    <div className="space-y-5 pb-20 animate-fade-in">
      {/* Profile Card */}
      <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-sm flex items-center space-x-4">
        <div className="w-14 h-14 rounded-2xl bg-burgundy-900 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-burgundy-900/20">
          U
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1.5">
            <h2 className="font-bold text-stone-900 text-base">Uživatel (Demo)</h2>
            <ShieldCheck className="w-4 h-4 text-burgundy-900" />
          </div>
          <p className="text-stone-500 text-xs">Osobní účet knihovny</p>
          <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-semibold rounded-full">
            Lokální synchronizace
          </span>
        </div>
      </div>

      <LibraryStats books={books} />

      {/* Backup: export & import */}
      <div>
        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2.5 px-1">
          Záloha dat
        </h3>
        <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm">
          <p className="text-[11px] text-stone-500 mb-3">
            Knihy jsou uložené jen v tomto prohlížeči. Stáhni si zálohu a nahraj ji na jiném zařízení.
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            <button type="button" onClick={handleExportJson} className={backupButtonClass}>
              <Download className="w-5 h-5 text-burgundy-900 mb-1.5" />
              <span className="text-xs font-bold text-stone-800">Záloha</span>
              <span className="text-[10px] text-stone-400">JSON</span>
            </button>
            <button type="button" onClick={handleExportCsv} className={backupButtonClass}>
              <FileSpreadsheet className="w-5 h-5 text-burgundy-900 mb-1.5" />
              <span className="text-xs font-bold text-stone-800">Tabulka</span>
              <span className="text-[10px] text-stone-400">CSV / Excel</span>
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className={backupButtonClass}>
              <Upload className="w-5 h-5 text-burgundy-900 mb-1.5" />
              <span className="text-xs font-bold text-stone-800">Obnovit</span>
              <span className="text-[10px] text-stone-400">ze zálohy</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* Future Features / Prepared Modular Cards */}
      <div>
        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2.5 px-1">
          Připravované funkce
        </h3>
        <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm space-y-3.5">
          <div className="flex items-center space-x-3 text-stone-500 opacity-75">
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 flex-shrink-0">
              <Bookmark className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-800">Stav čtení & Wishlist</h4>
                <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">Právě v vývoji</span>
              </div>
              <p className="text-[11px] text-stone-400 truncate">Přečteno / Rozečteno / Chci si přečíst</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-stone-500 opacity-75 pt-2 border-t border-stone-100">
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-800">AI Doporučování knih</h4>
                <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">Plánováno</span>
              </div>
              <p className="text-[11px] text-stone-400 truncate">Personalizované tipy podle tvé knihovny</p>
            </div>
          </div>

        </div>
      </div>

      {/* App Version Info */}
      <div className="text-center pt-2">
        <p className="text-xs font-bold text-burgundy-900">Moje Knihovna</p>
        <p className="text-[11px] text-stone-400">Verze 1.0.0 MVP • Mobilní PWA</p>
      </div>
    </div>
  );
}
