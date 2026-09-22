import React from 'react';

export default function LoadingSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-3 border border-stone-200/60 flex items-center space-x-3.5">
          <div className="w-16 h-22 bg-stone-200 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-stone-200 rounded w-3/4" />
            <div className="h-3 bg-stone-200 rounded w-1/2" />
            <div className="h-3 bg-stone-200 rounded w-1/4 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
