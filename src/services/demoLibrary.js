/**
 * Ukázková chata pro první spuštění: plné poličky známých knih,
 * ať je hned vidět, jak appka vypadá a co umí.
 */

export const DEMO_LIBRARY_ID = 'lib_demo_tutorial';
export const DEMO_LIBRARY_NAME = 'Ukázka (tutoriál)';

// [název, autor, počet stran, rok]
const DEMO_SHELVES = {
  Fantasy: [
    ['Hobit', 'J. R. R. Tolkien', 310, 1937],
    ['Pán prstenů: Společenstvo prstenu', 'J. R. R. Tolkien', 423, 1954],
    ['Pán prstenů: Dvě věže', 'J. R. R. Tolkien', 352, 1954],
    ['Pán prstenů: Návrat krále', 'J. R. R. Tolkien', 416, 1955],
    ['Silmarillion', 'J. R. R. Tolkien', 365, 1977],
    ['Harry Potter a Kámen mudrců', 'J. K. Rowling', 336, 1997],
    ['Harry Potter a Tajemná komnata', 'J. K. Rowling', 368, 1998],
    ['Harry Potter a vězeň z Azkabanu', 'J. K. Rowling', 448, 1999],
    ['Harry Potter a Ohnivý pohár', 'J. K. Rowling', 640, 2000],
    ['Zaklínač: Poslední přání', 'Andrzej Sapkowski', 288, 1993],
    ['Zaklínač: Meč osudu', 'Andrzej Sapkowski', 336, 1992],
    ['Hra o trůny', 'George R. R. Martin', 704, 1996],
    ['Střet králů', 'George R. R. Martin', 768, 1998],
    ['Jméno větru', 'Patrick Rothfuss', 672, 2007],
    ['Čaroděj Země', 'Ursula K. Le Guinová', 224, 1968],
    ['Letopisy Narnie: Lev, čarodějnice a skříň', 'C. S. Lewis', 208, 1950],
    ['Mistr a Markétka', 'Michail Bulgakov', 432, 1967],
    ['Malý princ', 'Antoine de Saint-Exupéry', 96, 1943]
  ],
  'Sci-fi': [
    ['Duna', 'Frank Herbert', 688, 1965],
    ['Základna', 'Isaac Asimov', 256, 1951],
    ['Já, robot', 'Isaac Asimov', 256, 1950],
    ['Stopařův průvodce po Galaxii', 'Douglas Adams', 224, 1979],
    ['Restaurace na konci vesmíru', 'Douglas Adams', 208, 1980],
    ['1984', 'George Orwell', 328, 1949],
    ['Konec civilizace', 'Aldous Huxley', 272, 1932],
    ['451 stupňů Fahrenheita', 'Ray Bradbury', 176, 1953],
    ['Marťan', 'Andy Weir', 384, 2011],
    ['Problém tří těles', 'Liou Cch’-sin', 408, 2008],
    ['Neuromancer', 'William Gibson', 320, 1984],
    ['Solaris', 'Stanisław Lem', 224, 1961],
    ['Enderova hra', 'Orson Scott Card', 352, 1985],
    ['Hyperion', 'Dan Simmons', 482, 1989],
    ['Válka světů', 'H. G. Wells', 192, 1898],
    ['R.U.R.', 'Karel Čapek', 120, 1920],
    ['Válka s mloky', 'Karel Čapek', 264, 1936]
  ],
  'Krimi a thrillery': [
    ['Vražda v Orient expresu', 'Agatha Christie', 256, 1934],
    ['Deset malých černoušků', 'Agatha Christie', 240, 1939],
    ['Vražda Rogera Ackroyda', 'Agatha Christie', 288, 1926],
    ['Sherlock Holmes: Studie v šarlatové', 'Arthur Conan Doyle', 176, 1887],
    ['Pes baskervillský', 'Arthur Conan Doyle', 224, 1902],
    ['Muži, kteří nenávidí ženy', 'Stieg Larsson', 568, 2005],
    ['Dívka ve vlaku', 'Paula Hawkins', 336, 2015],
    ['Šifra mistra Leonarda', 'Dan Brown', 520, 2003],
    ['Andělé a démoni', 'Dan Brown', 544, 2000],
    ['Mlčení jehňátek', 'Thomas Harris', 400, 1988],
    ['Sněhulák', 'Jo Nesbø', 480, 2007],
    ['Zmizelá', 'Gillian Flynn', 464, 2012],
    ['Zločin a trest', 'Fjodor Dostojevskij', 544, 1866]
  ],
  Horor: [
    ['Zelená míle', 'Stephen King', 400, 1996],
    ['Zářící', 'Stephen King', 464, 1977],
    ['To', 'Stephen King', 1138, 1986],
    ['Hřbitov zvířátek', 'Stephen King', 448, 1983],
    ['Misery', 'Stephen King', 320, 1987],
    ['Drákula', 'Bram Stoker', 448, 1897],
    ['Frankenstein', 'Mary Shelleyová', 280, 1818]
  ],
  Romány: [
    ['Pýcha a předsudek', 'Jane Austenová', 432, 1813],
    ['Stařec a moře', 'Ernest Hemingway', 128, 1952],
    ['Na Západní frontě klid', 'Erich Maria Remarque', 240, 1929],
    ['Velký Gatsby', 'F. Scott Fitzgerald', 208, 1925],
    ['Zabít ptáčka', 'Harper Lee', 376, 1960],
    ['Sto roků samoty', 'Gabriel García Márquez', 440, 1967],
    ['Lolita', 'Vladimir Nabokov', 368, 1955],
    ['Hrdý Budžes', 'Irena Dousková', 272, 1998],
    ['Zbabělci', 'Josef Škvorecký', 440, 1958],
    ['Obsluhoval jsem anglického krále', 'Bohumil Hrabal', 168, 1971],
    ['Ostře sledované vlaky', 'Bohumil Hrabal', 120, 1965],
    ['Saturnin', 'Zdeněk Jirotka', 232, 1942],
    ['Nesnesitelná lehkost bytí', 'Milan Kundera', 336, 1984],
    ['Žert', 'Milan Kundera', 328, 1967],
    ['Proces', 'Franz Kafka', 280, 1925],
    ['Proměna', 'Franz Kafka', 96, 1915],
    ['Cizinec', 'Albert Camus', 144, 1942],
    ['Alchymista', 'Paulo Coelho', 208, 1988],
    ['Stín větru', 'Carlos Ruiz Zafón', 488, 2001],
    ['Kniha o džungli', 'Rudyard Kipling', 272, 1894],
    ['Dobrý voják Švejk', 'Jaroslav Hašek', 752, 1923],
    ['Babička', 'Božena Němcová', 232, 1855],
    ['Tři mušketýři', 'Alexandre Dumas', 704, 1844]
  ],
  Historie: [
    ['Sapiens: Stručné dějiny lidstva', 'Yuval Noah Harari', 512, 2011],
    ['Homo Deus', 'Yuval Noah Harari', 496, 2015],
    ['Zbraně, bakterie a ocel', 'Jared Diamond', 528, 1997],
    ['Dějiny Evropy', 'Norman Davies', 1136, 1996],
    ['Dějiny zemí Koruny české', 'Petr Čornej', 672, 1992],
    ['Stručné dějiny času', 'Stephen Hawking', 232, 1988],
    ['Tajný deník Anny Frankové', 'Anne Franková', 304, 1947],
    ['Černobyl', 'Serhii Plokhy', 432, 2018]
  ],
  'Věda a příroda': [
    ['Kosmos', 'Carl Sagan', 396, 1980],
    ['Sobecký gen', 'Richard Dawkins', 384, 1976],
    ['O původu druhů', 'Charles Darwin', 512, 1859],
    ['Vesmír v kostce', 'Stephen Hawking', 216, 2001],
    ['Elegantní vesmír', 'Brian Greene', 448, 1999],
    ['Astrofyzika ve zkratce', 'Neil deGrasse Tyson', 224, 2017],
    ['Tajný život stromů', 'Peter Wohlleben', 232, 2015],
    ['Nahá opice', 'Desmond Morris', 272, 1967],
    ['Mozek: Návod k obsluze', 'Rita Carterová', 224, 1998]
  ],
  Psychologie: [
    ['Myšlení, rychlé a pomalé', 'Daniel Kahneman', 499, 2011],
    ['Atomové návyky', 'James Clear', 320, 2018],
    ['Hledání smyslu života', 'Viktor E. Frankl', 160, 1946],
    ['Sedm návyků skutečně efektivních lidí', 'Stephen R. Covey', 384, 1989],
    ['Umění lásky', 'Erich Fromm', 144, 1956],
    ['Síla přítomného okamžiku', 'Eckhart Tolle', 224, 1997],
    ['Flow', 'Mihaly Csikszentmihalyi', 336, 1990],
    ['Jak získávat přátele a působit na lidi', 'Dale Carnegie', 288, 1936],
    ['Deep Work', 'Cal Newport', 304, 2016]
  ],
  Filozofie: [
    ['Tak pravil Zarathustra', 'Friedrich Nietzsche', 352, 1883],
    ['Sofiin svět', 'Jostein Gaarder', 520, 1991],
    ['Meditace', 'Marcus Aurelius', 192, 180],
    ['Stát', 'Platón', 384, -375],
    ['Etika Nikomachova', 'Aristotelés', 368, -340],
    ['Malá kniha o stoicismu', 'Massimo Pigliucci', 256, 2017],
    ['Bytí a čas', 'Martin Heidegger', 480, 1927]
  ],
  Biografie: [
    ['Steve Jobs', 'Walter Isaacson', 656, 2011],
    ['Nelson Mandela: Dlouhá cesta za svobodou', 'Nelson Mandela', 656, 1994],
    ['Elon Musk', 'Walter Isaacson', 688, 2023],
    ['Albert Einstein: Jeho život a vesmír', 'Walter Isaacson', 704, 2007],
    ['Becoming: Můj příběh', 'Michelle Obamová', 448, 2018],
    ['Vzdělaná', 'Tara Westoverová', 400, 2018],
    ['Leonardo da Vinci', 'Walter Isaacson', 600, 2017]
  ],
  Cestopisy: [
    ['Do divočiny', 'Jon Krakauer', 224, 1996],
    ['V Patagonii', 'Bruce Chatwin', 256, 1977],
    ['Afrika snů a skutečnosti', 'Jiří Hanzelka', 288, 1952],
    ['Kon-Tiki', 'Thor Heyerdahl', 256, 1948],
    ['Cesta kolem světa za 80 dní', 'Jules Verne', 256, 1873]
  ],
  Kuchařky: [
    ['Domácí kuchařka', 'Magdalena Dobromila Rettigová', 400, 1826],
    ['Jamie Oliver: 5 ingrediencí', 'Jamie Oliver', 288, 2017],
    ['Plenty', 'Yotam Ottolenghi', 288, 2010],
    ['Salt Fat Acid Heat', 'Samin Nosrat', 480, 2017]
  ],
  Poezie: [
    ['Máj', 'Karel Hynek Mácha', 96, 1836],
    ['Kytice', 'Karel Jaromír Erben', 144, 1853],
    ['Smuténka', 'Jan Skácel', 96, 1965],
    ['Morový sloup', 'Jaroslav Seifert', 80, 1977],
    ['Host do domu', 'Jiří Wolker', 96, 1921]
  ],
  Komiks: [
    ['Maus', 'Art Spiegelman', 296, 1991],
    ['Watchmen', 'Alan Moore', 416, 1987],
    ['Persepolis', 'Marjane Satrapi', 160, 2000],
    ['Alois Nebel', 'Jaroslav Rudiš, Jaromír 99', 224, 2003],
    ['Batman: Rok první', 'Frank Miller', 144, 1987],
    ['Asterix a Galové', 'René Goscinny', 48, 1961]
  ],
  'Pro děti': [
    ['Pipi Dlouhá punčocha', 'Astrid Lindgrenová', 160, 1945],
    ['Alenka v říši divů', 'Lewis Carroll', 176, 1865],
    ['Medvídek Pú', 'A. A. Milne', 160, 1926],
    ['Ferda Mravenec', 'Ondřej Sekora', 96, 1936],
    ['Karlík a továrna na čokoládu', 'Roald Dahl', 176, 1964],
    ['Matylda', 'Roald Dahl', 240, 1988],
    ['Čtyřlístek 1', 'Jaroslav Němeček', 48, 1969],
    ['Záhada hlavolamu', 'Jaroslav Foglar', 240, 1941]
  ]
};

/** Vrátí { library, books } připravené k uložení. */
export function buildDemoLibrary(now = Date.now()) {
  const library = {
    id: DEMO_LIBRARY_ID,
    name: DEMO_LIBRARY_NAME,
    demo: true,
    created_at: new Date(now).toISOString()
  };

  const books = [];
  let i = 0;
  for (const [genre, items] of Object.entries(DEMO_SHELVES)) {
    for (const [title, authors, page_count, year] of items) {
      books.push({
        id: `b_demo_${i}`,
        library_id: DEMO_LIBRARY_ID,
        title,
        authors,
        isbn: '',
        page_count,
        publication_date: year > 0 ? String(year) : '',
        genre,
        genre_locked: true,
        demo: true,
        // poličky vznikají v pořadí žánrů, uvnitř v pořadí knih
        created_at: new Date(now - (1000 - i) * 1000).toISOString()
      });
      i += 1;
    }
  }
  return { library, books };
}
