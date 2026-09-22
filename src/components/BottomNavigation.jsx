import React from 'react';
import { BookOpen, Camera, User } from 'lucide-react';

export default function BottomNavigation({ activeTab, setActiveTab }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
      <div className="max-w-md mx-auto px-4 pb-3 pt-1">
        <nav className="bg-white/90 backdrop-blur-xl border border-stone-200/80 rounded-3xl shadow-xl shadow-stone-200/50 px-3 py-2 flex items-center justify-around">
          {/* 1. Knihovna */}
          <button
            onClick={() => setActiveTab('library')}
            className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all duration-200 ${
              activeTab === 'library'
                ? 'text-burgundy-900 font-semibold scale-105'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <BookOpen className="w-5 h-5 mb-1" strokeWidth={activeTab === 'library' ? 2.5 : 1.8} />
            <span className="text-[11px] tracking-tight">Knihovna</span>
          </button>

          {/* 2. Skenovat (Highlight) */}
          <button
            onClick={() => setActiveTab('scan')}
            className="flex flex-col items-center justify-center -mt-5"
          >
            <div className="w-14 h-14 bg-burgundy-900 hover:bg-burgundy-800 text-white rounded-full flex items-center justify-center shadow-lg shadow-burgundy-900/30 border-4 border-stone-50 active:scale-95 transition-transform duration-200">
              <Camera className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-medium text-stone-700 mt-1 tracking-tight">Skenovat</span>
          </button>

          {/* 3. Profil / Nastavení */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all duration-200 ${
              activeTab === 'profile'
                ? 'text-burgundy-900 font-semibold scale-105'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <User className="w-5 h-5 mb-1" strokeWidth={activeTab === 'profile' ? 2.5 : 1.8} />
            <span className="text-[11px] tracking-tight">Profil</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
