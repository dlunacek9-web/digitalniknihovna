import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Úvodní tutoriál: bublinky u tlačítek, na která je potřeba kliknout.
 * Další krok naskočí sám, jakmile uživatel splní úkol (`done`). Ručně se
 * přeskakovat nedá, jen celý tutoriál ukončit křížkem.
 *
 * anchor: CSS selektor, nebo 'cat' / 'poster' (poloha ve 3D scéně).
 */
export const TUTORIAL_STEPS = [
  {
    id: 'scan',
    anchor: '.cabin-dock .btn-ember',
    title: 'Přidání knihy',
    text: 'Knihy se do chaty přidávají skenerem. Klikni na tlačítko a ukážu ti ho. Nic skenovat nemusíš.',
    done: (c) => c.tab === 'scan'
  },
  {
    id: 'scanner',
    anchor: '[aria-label="Zavřít skener"]',
    title: 'Tohle je skener',
    text: 'Namiř kameru na čárový kód na zadní straně knihy a ona se přidá sama. Nejde to? Dole je políčko na ISBN. Teď skener zavři křížkem.',
    side: 'below-left',
    done: (c) => c.tab !== 'scan'
  },
  {
    id: 'cat',
    anchor: 'cat',
    title: 'Chatová kočka',
    text: 'V chatě bydlí kočka. Klikni na ni a pohlaď ji.',
    done: (c) => c.catPets > 0
  },
  {
    id: 'shelf',
    anchor: '.cabin-label',
    title: 'Poličky podle žánrů',
    text: 'Každý žánr má vlastní poličku. Klikni na jednu z nich.',
    skip: (c) => c.shelfCount === 0,
    done: (c) => Boolean(c.openGenre)
  },
  {
    id: 'book',
    anchor: '.shelf-sheet.is-open .shelf-book',
    title: 'Knihy na poličce',
    text: 'Klikni na knihu a otevře se její detail.',
    skip: (c) => c.shelfCount === 0,
    done: (c) => Boolean(c.selectedBookId)
  },
  {
    id: 'detail',
    anchor: '.book-detail__close',
    title: 'Detail knihy',
    text: 'Tady se kniha označí jako přečtená, přesune na jinou poličku nebo půjčí kamarádovi. Teď detail zavři.',
    side: 'below-left',
    skip: (c) => c.shelfCount === 0,
    done: (c) => !c.selectedBookId
  },
  {
    id: 'closeShelf',
    anchor: '.shelf-sheet.is-open [aria-label="Zavřít poličku"]',
    title: 'Zpátky do chaty',
    text: 'Zavři poličku.',
    side: 'below-left',
    skip: (c) => c.shelfCount === 0,
    done: (c) => !c.openGenre
  },
  {
    id: 'poster',
    anchor: 'poster',
    title: 'Nástěnka',
    text: 'Na zdi visí nástěnka se statistikami, zálohou a půjčenými knihami. Klikni na ni.',
    done: (c) => c.tab === 'profile'
  },
  {
    id: 'posterBack',
    anchor: '.page-wood__back',
    title: 'Zpátky do chaty',
    text: 'Tady najdeš přehled svého čtenářství. Vrať se do chaty.',
    done: (c) => c.tab === 'library'
  },
  {
    id: 'city',
    anchor: '.cabin-city__btn',
    title: 'Městská knihovna',
    text: 'Za dveřmi je městská knihovna, ve které se hledá v knihách celého světa. Klikni a vejdi.',
    done: (c) => c.cityOpen
  },
  {
    id: 'citySearch',
    anchor: '.tome__field input',
    title: 'Hledání',
    text: 'Napiš název, autora nebo ISBN. Stačí dvě písmena.',
    done: (c) => c.cityQueryLen >= 2
  },
  {
    id: 'cityPick',
    anchor: '.tome__results li button',
    title: 'Vyber knihu',
    text: 'Klikni na kteroukoli knihu a přiletí z regálu na pultík.',
    done: (c) => c.cityPhase === 'flying' || c.cityPhase === 'lectern'
  },
  {
    id: 'cityBack',
    anchor: '.city-card__close',
    title: 'Kniha na pultíku',
    text: 'Tlačítkem „Přidat do knihovny“ ji vložíš do chaty. My ji teď jen vrátíme zpátky do regálu.',
    side: 'below-left',
    done: (c) => c.cityPhase === 'leaving' || c.cityPhase === 'search'
  },
  {
    id: 'cityLeave',
    anchor: '.city-top .chip-glass',
    title: 'Hotovo v knihovně',
    text: 'Vrať se zpátky do chaty.',
    side: 'below-right',
    done: (c) => !c.cityOpen
  },
  {
    id: 'libSwitch',
    anchor: '.cabin-library-btn',
    title: 'Vlastní chata',
    text: 'Každá knihovna je samostatná chata. Tahle je ukázková, tak si pojďme přepnout do vlastní. Klikni na název knihovny.',
    side: 'below-left',
    done: (c) => c.librariesOpen || c.librarySwitches > 0
  },
  {
    id: 'libCreate',
    anchor: '.search-sheet[aria-label="Moje knihovny"] .search-sheet__panel > .library-sheet__form',
    title: 'Postav si chatu',
    text: 'Pojmenuj svou chatu (třeba „Doma“) a klikni na „Postavit chatu“. Už máš vlastní? Klidně ji vyber v seznamu.',
    side: 'below-left',
    done: (c) => c.librarySwitches > 0
  },
  {
    id: 'finish',
    anchor: null,
    title: 'Máš hotovo!',
    text: 'Jsi ve své chatě. Knihy do ní přidáš skenerem nebo z městské knihovny a poličky přibydou samy. Užij si ji.',
    final: true
  }
];

const PAD = 8;
const BUBBLE_W = 300;

function findRect(anchor, sceneApi) {
  if (anchor === 'cat' || anchor === 'poster') {
    const p = sceneApi?.current?.screenAnchor(anchor);
    if (!p) return null;
    const r = 34;
    return { left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, round: true };
  }
  const el = document.querySelector(anchor);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const style = getComputedStyle(el);
  const hidden = style.visibility === 'hidden' || Number(style.opacity) === 0;
  if (hidden) return null;
  if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, round: false };
}

export default function Tutorial({ context, sceneApiRef, onExit }) {
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [rect, setRect] = useState(null);
  const step = TUTORIAL_STEPS[index];

  // Další krok naskočí sám, jakmile je úkol splněný.
  useEffect(() => {
    if (!step || step.final) return undefined;
    const advance = () => setIndex((i) => i + 1);
    if (step.skip?.(context)) {
      advance();
      return undefined;
    }
    if (!step.done(context)) return undefined;
    const timer = setTimeout(advance, 550);
    return () => clearTimeout(timer);
  }, [step, context]);

  // Cíl se může hýbat (kamera, animace), proto ho sledujeme každý snímek.
  useEffect(() => {
    if (!step?.anchor) {
      setRect(null);
      return undefined;
    }
    let raf;
    const tick = () => {
      const next = findRect(step.anchor, sceneApiRef);
      setRect((prev) => {
        if (!next) return prev ? null : prev;
        if (prev && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.top - next.top) < 0.5 && prev.width === next.width) return prev;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    setRect(null);
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step, sceneApiRef]);

  if (!step) return null;
  const total = TUTORIAL_STEPS.length;
  const stepNo = Math.min(index + 1, total);

  let bubbleStyle;
  let arrowStyle;
  let place = 'center';
  if (step.anchor && rect) {
    const cx = rect.left + rect.width / 2;
    const vw = window.innerWidth;
    const width = Math.min(BUBBLE_W, vw - 24);
    const left = Math.max(12, Math.min(vw - width - 12, cx - width / 2));
    const above = !step.side?.startsWith('below') && rect.top + rect.height / 2 > window.innerHeight / 2;
    place = above ? 'above' : 'below';
    bubbleStyle = above
      ? { left, width, bottom: window.innerHeight - rect.top + PAD + 12 }
      : { left, width, top: rect.top + rect.height + PAD + 12 };
    arrowStyle = { left: Math.max(18, Math.min(width - 18, cx - left)) };
  }

  const showBubble = step.final || (step.anchor && rect);

  return (
    <div className="tour" role="presentation">
      {rect && !step.final && (
        <i
          className={`tour-ring ${rect.round ? 'is-round' : ''}`}
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2
          }}
        />
      )}

      {showBubble && (
        <div
          key={step.id}
          className={`tour-bubble ${step.final ? 'is-final' : `is-${place}`}`}
          style={step.final ? undefined : bubbleStyle}
          role="dialog"
          aria-label={`Tutoriál: ${step.title}`}
        >
          {!step.final && <span className="tour-bubble__arrow" style={arrowStyle} />}
          <button type="button" className="tour-bubble__close" onClick={() => setConfirming(true)} aria-label="Ukončit tutoriál">
            <X size={16} />
          </button>
          <small>Krok {stepNo} z {total}</small>
          <h4>{step.title}</h4>
          <p>{step.text}</p>
          {step.final && (
            <button type="button" className="dock-btn btn-ember tour-bubble__done" onClick={() => onExit('done')}>
              Začít číst
            </button>
          )}
        </div>
      )}

      {confirming && (
        <div className="tour-confirm" role="alertdialog" aria-modal="true" aria-label="Ukončit tutoriál?">
          <div className="tour-confirm__card">
            <h4>Opravdu vypnout tutoriál?</h4>
            <p>Už se ti znovu nezobrazí.</p>
            <div>
              <button type="button" className="tour-confirm__stay" onClick={() => setConfirming(false)}>
                Pokračovat
              </button>
              <button type="button" className="tour-confirm__quit" onClick={() => onExit('dismissed')}>
                Vypnout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
