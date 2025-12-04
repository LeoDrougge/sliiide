'use client';

import HtmlSlidePreview from './HtmlSlidePreview';
import type { SavedDeck, SlideState } from '../lib/types';

interface DeckGridItemProps {
  deck: SavedDeck;
  onClick: () => void;
}

function DeckGridItem({ deck, onClick }: DeckGridItemProps) {
  // Get first slide for thumbnail
  const firstSlide: SlideState = deck.slides?.[0] || deck.state || {
    header: '',
    title: '',
    bodyText: '',
    layout: 'default',
  };

  // Scale for thumbnail: 300px / 1920px = 0.15625
  const thumbnailScale = 300 / 1920;
  const thumbnailHeight = 300 * (1080 / 1920); // ~168.75px

  return (
    <div
      onClick={onClick}
      className="cursor-pointer border border-gray-200 hover:border-gray-400 transition-colors"
      style={{ width: '300px' }}
    >
      <div 
        className="border-b border-gray-200 overflow-hidden"
        style={{ height: `${thumbnailHeight}px`, position: 'relative' }}
      >
        <HtmlSlidePreview 
          slide={firstSlide} 
          showGrid={false} 
          scale={thumbnailScale}
        />
      </div>
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

