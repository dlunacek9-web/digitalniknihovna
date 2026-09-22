import React from 'react';
import { BookCoverPlaceholder } from './BookCoverPlaceholder';

export default function BookCard({ book, onClick }) {
  // Extract year if full date string provided
  const publicationYear = book.publication_date
    ? book.publication_date.substring(0, 4)
    : null;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-3 border border-stone-200/70 shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center space-x-3.5 group"
    >
      {/* Cover image or fallback placeholder */}
      <div className="w-16 h-22 flex-shrink-0 rounded-xl overflow-hidden bg-stone-100 shadow-sm border border-stone-100 relative">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 p-2 text-center text-stone-500 text-xs ${
            book.cover_url ? 'hidden' : 'flex'
          }`}
        >
          <BookCoverPlaceholder title={book.title} />
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 pr-1">
        <h3 className="font-bold text-stone-900 text-base leading-snug line-clamp-2 group-hover:text-burgundy-900 transition-colors">
          {book.title}
        </h3>
        <p className="text-stone-600 text-xs font-medium mt-1 line-clamp-1">
          {book.authors || 'Neznámý autor'}
        </p>

        <div className="flex items-center space-x-2 mt-2">
          {publicationYear && (
            <span className="inline-block px-2 py-0.5 bg-stone-100 text-stone-600 text-[11px] font-medium rounded-full">
              {publicationYear}
            </span>
          )}
          {book.page_count && (
            <span className="text-[11px] text-stone-400 font-medium">
              {book.page_count} stran
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
