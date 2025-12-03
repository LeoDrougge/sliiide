'use client';

import { useState, useEffect, useRef } from 'react';
import { generatePdf } from '../lib/generatePdf';
import type { SavedDeck, SlideState } from '../lib/types';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface DeckGridItemProps {
  deck: SavedDeck;
  onClick: () => void;
}

function DeckGridItem({ deck, onClick }: DeckGridItemProps) {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get first slide for thumbnail
  const firstSlide: SlideState = deck.slides?.[0] || deck.state || {
    header: '',
    title: '',
    bodyText: '',
    layout: 'default',
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    generatePdf(firstSlide).then((bytes) => {
      if (!cancelled) {
        setPdfBytes(bytes);
        setIsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [firstSlide]);

  useEffect(() => {
    if (!pdfBytes || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let cancelled = false;

    const renderThumbnail = async () => {
      try {
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });

        // Scale to fit 300px width
        const scale = 300 / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        if (!context || cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error rendering deck thumbnail:', error);
      }
    };

    renderThumbnail();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer border border-gray-200 hover:border-gray-400 transition-colors"
      style={{ width: '300px' }}
    >
      {isLoading ? (
        <div className="w-full aspect-video flex items-center justify-center text-sm text-gray-400 border-b border-gray-200">
          Loading...
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full aspect-video border-b border-gray-200"
          style={{ display: 'block' }}
        />
      )}
      <div className="p-3 text-sm">{deck.name}</div>
    </div>
  );
}

interface DeckGridProps {
  decks: SavedDeck[];
  onDeckClick: (deck: SavedDeck) => void;
}

export default function DeckGrid({ decks, onDeckClick }: DeckGridProps) {
  if (decks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-400">
        No decks yet. Create your first deck to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
      {decks.map((deck) => (
        <DeckGridItem
          key={deck.id}
          deck={deck}
          onClick={() => onDeckClick(deck)}
        />
      ))}
    </div>
  );
}

