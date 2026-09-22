import React from 'react';
import { BookOpen, Camera } from 'lucide-react';

export default function EmptyState({ onScanClick, isFiltered, searchQuery, onClearSearch }) {
  if (isFiltered) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-stone-200/80 text-center shadow-sm my-6">
        <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
          <BookOpen className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-stone-900 mb-1">Žádné výsledky</h3>
        <p className="text-stone-500 text-xs max-w-xs mx-auto mb-5">
          Pro výraz „<span className="font-semibold text-stone-800">{searchQuery}</span>“ nebyly nalezeny žádné knihy.
        </p>
        <button
          onClick={onClearSearch}
          className="inline-flex items-center justify-center px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors"
        >
          Zrušit vyhledávání
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-8 border border-stone-200/80 text-center shadow-sm my-6">
      <div className="w-16 h-16 bg-burgundy-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-burgundy-900 shadow-sm">
        <BookOpen className="w-8 h-8" strokeWidth={1.8} />
      </div>
      <h3 className="text-lg font-bold text-stone-900 mb-1">Zatím tu nemáš žádné knihy</h3>
      <p className="text-stone-500 text-xs max-w-xs mx-auto mb-6 leading-relaxed">
        Začni budovat svou osobní digitální knihovnu naskenováním čárového kódu na obálce první knihy.
      </p>
      <button
        onClick={onScanClick}
        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 bg-burgundy-900 hover:bg-burgundy-800 active:scale-98 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-burgundy-900/20 transition-all duration-200 space-x-2"
      >
        <Camera className="w-5 h-5" />
        <span>Naskenovat první knihu</span>
      </button>
    </div>
  );
}
