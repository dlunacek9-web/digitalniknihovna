import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Layers, Ruler, Users, Trophy, Feather, Hourglass, Tags, CalendarRange } from 'lucide-react';
import { computeLibraryStats } from '../services/libraryStats';

const GENRE_COLORS = ['#18382d', '#587b66', '#9fbaa6', '#c08a3e', '#e2c48f', '#b9b5a8'];

function StatTile({ icon: Icon, value, label }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-xl bg-burgundy-50 text-burgundy-900 flex items-center justify-center mb-2">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-2xl font-extrabold text-stone-900">{value}</span>
      <span className="text-stone-500 text-xs font-medium">{label}</span>
    </div>
  );
}

function ChartCard({ icon: Icon, title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm ${className}`}>
      <div className="flex items-center space-x-2 mb-3.5">
        <Icon className="w-4 h-4 text-burgundy-900" />
        <h4 className="text-xs font-bold text-stone-800">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ text }) {
  return <p className="text-[11px] text-stone-400 py-4 text-center">{text}</p>;
}

// Bars start at 0 and grow after mount, so the charts animate in.
function useGrowIn() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return grown;
}

function HorizontalBars({ items, grown }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item, index) => (
        <div key={item.name}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-semibold text-stone-700 truncate pr-2">
              {index === 0 && <span className="mr-1">👑</span>}
              {item.name}
            </span>
            <span className="text-stone-400 font-medium flex-shrink-0">{item.count}×</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-burgundy-900 transition-all duration-700 ease-out"
              style={{ width: grown ? `${(item.count / max) * 100}%` : '0%', opacity: 1 - index * 0.13 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function GenreDonut({ genres, total, genreCount }) {
  let start = 0;
  const segments = genres.map((genre, index) => {
    const end = start + (genre.count / total) * 360;
    const segment = `${GENRE_COLORS[index % GENRE_COLORS.length]} ${start}deg ${end}deg`;
    start = end;
    return segment;
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative w-28 h-28 rounded-full flex-shrink-0"
        style={{ background: `conic-gradient(${segments.join(', ')})` }}
      >
        {/* inline styl: papírek na nástěnce by z třídy bg-white udělal čárkovaný rámeček */}
        <div
          className="absolute inset-[18%] rounded-full flex flex-col items-center justify-center"
          style={{ background: '#fff' }}
        >
          <span className="text-lg font-extrabold text-stone-900 leading-none">{genreCount}</span>
          <span className="text-[9px] text-stone-400 font-medium">žánrů</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5">
        {genres.map((genre, index) => (
          <li key={genre.name} className="flex items-center text-[11px]">
            <span
              className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
              style={{ background: GENRE_COLORS[index % GENRE_COLORS.length] }}
            />
            <span className="text-stone-700 font-medium truncate flex-1">{genre.name}</span>
            <span className="text-stone-400 ml-2">{Math.round((genre.count / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DecadeColumns({ decades, grown }) {
  const max = Math.max(...decades.map((decade) => decade.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-36 pt-4">
      {decades.map((decade) => (
        <div key={decade.name} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end">
          <span className="text-[10px] font-bold text-stone-700 mb-1">{decade.count}</span>
          <div
            className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-burgundy-900 to-burgundy-500 transition-all duration-700 ease-out"
            style={{ height: grown ? `${Math.max((decade.count / max) * 100, 6)}%` : '0%' }}
          />
          <span className="text-[9px] text-stone-400 mt-1.5 truncate w-full text-center">{decade.name}</span>
        </div>
      ))}
    </div>
  );
}

function RecordRow({ icon: Icon, label, book, detail }) {
  if (!book) return null;
  return (
    <div className="flex items-center space-x-3 pt-2.5 first:pt-0 border-t first:border-t-0 border-stone-100">
      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
        <p className="text-xs font-bold text-stone-800 truncate">{book.title}</p>
        <p className="text-[11px] text-stone-500 truncate">{book.authors}</p>
      </div>
      <span className="text-sm font-extrabold text-burgundy-900 flex-shrink-0">{detail}</span>
    </div>
  );
}

export default function LibraryStats({ books }) {
  const stats = useMemo(() => computeLibraryStats(books), [books]);
  const grown = useGrowIn();
  const genreTotal = stats.genres.reduce((sum, genre) => sum + genre.count, 0);

  return (
    <div>
      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2.5 px-1">
        Statistiky knihovny
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <StatTile icon={BookOpen} value={stats.totalBooks} label="Knih v knihovně" />
        <StatTile icon={Layers} value={stats.totalPages.toLocaleString('cs')} label="Celkem stran" />
        <StatTile icon={Ruler} value={stats.averagePages} label="Průměrně stran" />
        <StatTile icon={Users} value={stats.authorCount} label="Různých autorů" />
      </div>

      {stats.totalBooks === 0 ? (
        <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm">
          <EmptyChart text="Přidej první knihy a tady se objeví grafy tvé knihovny." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChartCard icon={Trophy} title="Top autoři">
            {stats.topAuthors.length ? (
              <HorizontalBars items={stats.topAuthors} grown={grown} />
            ) : (
              <EmptyChart text="U knih zatím chybí autoři." />
            )}
          </ChartCard>

          <ChartCard icon={Tags} title="Žánry">
            {genreTotal ? (
              <>
                <GenreDonut genres={stats.genres} total={genreTotal} genreCount={stats.genreCount} />
                {stats.booksWithoutGenre > 0 && (
                  <p className="text-[10px] text-stone-400 mt-3">
                    {stats.booksWithoutGenre} knih bez uvedeného žánru
                  </p>
                )}
              </>
            ) : (
              <EmptyChart text="Žánr se ukládá u nově naskenovaných knih." />
            )}
          </ChartCard>

          <ChartCard icon={CalendarRange} title="Rok vydání">
            {stats.decades.length ? (
              <DecadeColumns decades={stats.decades} grown={grown} />
            ) : (
              <EmptyChart text="U knih zatím chybí rok vydání." />
            )}
          </ChartCard>

          <ChartCard icon={Feather} title="Rekordy">
            {stats.longestBook || stats.oldestBook ? (
              <div className="space-y-2.5">
                <RecordRow icon={Trophy} label="Nejdelší kniha" book={stats.longestBook} detail={`${stats.longestBook?.page_count} s.`} />
                <RecordRow icon={Feather} label="Nejkratší kniha" book={stats.shortestBook} detail={`${stats.shortestBook?.page_count} s.`} />
                <RecordRow icon={Hourglass} label="Nejstarší vydání" book={stats.oldestBook} detail={stats.oldestBook?.publication_date} />
              </div>
            ) : (
              <EmptyChart text="Rekordy se ukážou, až budou knihy mít stránky nebo rok." />
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
