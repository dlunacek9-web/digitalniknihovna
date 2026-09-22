import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, onClear }) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-stone-400" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Hledat podle názvu, autora nebo ISBN..."
        className="w-full pl-10 pr-10 py-2.5 bg-white border border-stone-200/90 rounded-2xl text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900 shadow-sm transition-all"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
