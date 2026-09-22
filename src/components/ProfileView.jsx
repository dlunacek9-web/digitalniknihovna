import React from 'react';
import { User, BookOpen, Layers, Sparkles, Download, Bookmark, Award, ShieldCheck } from 'lucide-react';

export default function ProfileView({ totalBooks, totalPages }) {
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

      {/* Reading Statistics */}
      <div>
        <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2.5 px-1">
          Statistiky čtení
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-xl bg-burgundy-50 text-burgundy-900 flex items-center justify-center mb-2">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-2xl font-extrabold text-stone-900">{totalBooks}</span>
            <span className="text-stone-500 text-xs font-medium">Knih v knihovně</span>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center mb-2">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-2xl font-extrabold text-stone-900">{totalPages}</span>
            <span className="text-stone-500 text-xs font-medium">Celkem stran</span>
          </div>
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

          <div className="flex items-center space-x-3 text-stone-500 opacity-75 pt-2 border-t border-stone-100">
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 flex-shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-800">Export & Import knihovny</h4>
                <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">Plánováno</span>
              </div>
              <p className="text-[11px] text-stone-400 truncate">Záloha knih ve formátu JSON / CSV</p>
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
