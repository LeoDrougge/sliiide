'use client';

import { useState, useRef, useEffect } from 'react';
import HtmlSlidePreview from './HtmlSlidePreview';
import type { SavedDeck, SlideState } from '../lib/types';

interface DeckGridItemProps {
  deck: SavedDeck;
  onClick: () => void;
  onRename: (deck: SavedDeck) => void;
  onDelete: (deck: SavedDeck) => void;
}

function DeckGridItem({ deck, onClick, onRename, onDelete }: DeckGridItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get first slide for thumbnail
  const firstSlide: SlideState = deck.slides?.[0] || deck.state || {
    overline: '',
    title: '',
    bodyText: '',
    layout: 'title',
    useBullets: false,
  };

  // Scale for thumbnail: 300px / 1920px = 0.15625
  const thumbnailScale = 300 / 1920;
  const thumbnailHeight = 300 * (1080 / 1920); // ~168.75px

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMenu]);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onRename(deck);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (confirm(`Are you sure you want to delete "${deck.name}"?`)) {
      onDelete(deck);
    }
  };

  return (
    <div
      className="border border-gray-200 hover:border-gray-400 transition-colors relative group"
      style={{ width: '300px' }}
    >
      <div
        onClick={onClick}
        className="cursor-pointer"
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
          {/* Dot menu icon - shows on hover */}
          <div 
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={handleMenuClick}
            style={{ 
              width: '32px', 
              height: '32px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '4px',
            }}
          >
            <img 
              src="/images/icon-dotmenu.svg" 
              alt="Menu" 
              style={{ width: '20px', height: '20px' }}
            />
          </div>
        </div>
        <div className="p-3 text-sm">{deck.name}</div>
      </div>
      
      {/* Menu dropdown */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute top-10 right-2 bg-white border border-gray-200 shadow-lg z-10"
          style={{ minWidth: '120px' }}
        >
          <button
            onClick={handleRename}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            type="button"
          >
            Rename
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors border-t border-gray-200"
            type="button"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

interface DeckGridProps {
  decks: SavedDeck[];
  onDeckClick: (deck: SavedDeck) => void;
  onRename?: (deck: SavedDeck) => void;
  onDelete?: (deck: SavedDeck) => void;
}

export default function DeckGrid({ decks, onDeckClick, onRename, onDelete }: DeckGridProps) {
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
          onRename={onRename || (() => {})}
          onDelete={onDelete || (() => {})}
        />
      ))}
    </div>
  );
}

