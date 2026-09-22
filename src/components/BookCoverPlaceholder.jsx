import React from 'react';
import { Book } from 'lucide-react';

export function BookCoverPlaceholder({ title }) {
  return (
    <div className="w-full h-full bg-stone-100 flex flex-col items-center justify-center p-2 text-stone-400 select-none">
      <Book className="w-6 h-6 mb-1 text-stone-300" strokeWidth={1.5} />
      <span className="text-[10px] font-medium leading-tight text-center text-stone-500 line-clamp-2">
        {title || 'Bez obálky'}
      </span>
    </div>
  );
}
