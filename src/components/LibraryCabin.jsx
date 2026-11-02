import React, { useEffect, useRef } from 'react';
import { createCabinScene } from '../cabin/cabinScene';

/**
 * 3D chata s knihovnou. Scéna žije mimo React; komponenta jí jen předává
 * knihy a otevřenou poličku.
 */
export default function LibraryCabin({ books, openGenre, onShelfClick, posterOpen, onPosterClick, posterContent }) {
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const posterRef = useRef(null);
  const sceneRef = useRef(null);
  const onShelfClickRef = useRef(onShelfClick);
  onShelfClickRef.current = onShelfClick;
  const onPosterClickRef = useRef(onPosterClick);
  onPosterClickRef.current = onPosterClick;

  useEffect(() => {
    const scene = createCabinScene({
      canvas: canvasRef.current,
      labelsEl: labelsRef.current,
      onShelfClick: (genre) => onShelfClickRef.current?.(genre),
      onPosterClick: () => onPosterClickRef.current?.()
    });
    sceneRef.current = scene;
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

  return (
    <div className="cabin">
      <div className="cabin-aurora" aria-hidden="true"><i /><i /><i /></div>
      <canvas ref={canvasRef} className="cabin-canvas" aria-label="3D chata s poličkami podle žánrů" />
      <div ref={labelsRef} className={`cabin-labels ${openGenre || posterOpen ? 'is-hidden' : ''}`} />
      <div ref={posterRef} className="cabin-poster">
        {posterOpen && <div className="cabin-poster__paper">{posterContent}</div>}
      </div>
    </div>
  );
}
