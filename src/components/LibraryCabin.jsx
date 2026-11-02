import React, { useEffect, useRef } from 'react';
import { Library } from 'lucide-react';
import { createCabinScene } from '../cabin/cabinScene';

/**
 * 3D chata s knihovnou. Scéna žije mimo React; komponenta jí jen předává
 * knihy a otevřenou poličku.
 */
export default function LibraryCabin({ books, openGenre, onShelfClick, posterOpen, onPosterClick, posterContent, onCityClick, cityEntering, onCatPet, sceneApiRef }) {
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const cityRef = useRef(null);
  const posterRef = useRef(null);
  const sceneRef = useRef(null);
  const onShelfClickRef = useRef(onShelfClick);
  onShelfClickRef.current = onShelfClick;
  const onPosterClickRef = useRef(onPosterClick);
  onPosterClickRef.current = onPosterClick;

  const onCatPetRef = useRef(onCatPet);
  onCatPetRef.current = onCatPet;

  useEffect(() => {
    const scene = createCabinScene({
      canvas: canvasRef.current,
      labelsEl: labelsRef.current,
      cityEl: cityRef.current,
      onShelfClick: (genre) => onShelfClickRef.current?.(genre),
      onPosterClick: () => onPosterClickRef.current?.(),
      onCatPet: () => onCatPetRef.current?.()
    });
    sceneRef.current = scene;
    if (sceneApiRef) sceneApiRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setBooks(books);
  }, [books]);

  const wasOpen = useRef(false);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (posterOpen) {
      scene.focusPoster(posterRef.current);
      wasOpen.current = true;
    } else if (openGenre) {
      scene.focusShelf(openGenre);
      wasOpen.current = true;
    } else if (wasOpen.current) {
      scene.resetView();
      wasOpen.current = false;
    }
  }, [openGenre, posterOpen]);

  const wasEntering = useRef(false);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (cityEntering) {
      scene.flyToCity();
      wasEntering.current = true;
    } else if (wasEntering.current) {
      scene.resetView();
      wasEntering.current = false;
    }
  }, [cityEntering]);

  return (
    <div className="cabin">
      <div className="cabin-aurora" aria-hidden="true"><i /><i /><i /></div>
      <canvas ref={canvasRef} className="cabin-canvas" aria-label="3D chata s poličkami podle žánrů" />
      <div ref={labelsRef} className={`cabin-labels ${openGenre || posterOpen ? 'is-hidden' : ''}`} />
      <div className={`cabin-city ${openGenre || posterOpen ? 'is-hidden' : ''}`}>
        <button ref={cityRef} type="button" className="cabin-city__btn" onClick={onCityClick} aria-label="Do městské knihovny">
          <Library size={22} />
          <span>Městská knihovna</span>
        </button>
      </div>
      <div ref={posterRef} className="cabin-poster">
        {posterOpen && <div className="cabin-poster__paper">{posterContent}</div>}
      </div>
    </div>
  );
}
