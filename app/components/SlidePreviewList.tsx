'use client';

import { memo, useState, useRef, useEffect } from 'react';
import HtmlSlidePreview from './HtmlSlidePreview';
import type { SlideState } from '../lib/types';

interface SlidePreviewListProps {
  slides: SlideState[];
  selectedIndex: number;
  onSlideClick: (index: number) => void;
  onAddSlide?: () => void;
  onReorderSlides?: (fromIndex: number, toIndex: number) => void;
  onDeleteSlide?: (index: number) => void;
  showGrid?: boolean;
  titleSlideTitle?: string; // Title from slide 0 to use as overline
}

function SlidePreviewItem({ 
  slide, 
  index, 
  isSelected, 
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  showGrid,
  titleSlideTitle,
  onDelete
}: { 
  slide: SlideState; 
  index: number; 
  isSelected: boolean; 
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  showGrid?: boolean;
  titleSlideTitle?: string;
  onDelete?: (index: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const thumbnailScale = 200 / 1920;

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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onDelete) {
      onDelete(index);
    }
  };

  return (
    <div
      className={`border-2 mb-2 transition-all overflow-hidden relative group ${
        isSelected ? 'border-gray-400' : 'border-gray-200'
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{ width: '200px', height: '112.5px', position: 'relative' }}
    >
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={onClick}
        className="cursor-move h-full w-full"
      >
        <HtmlSlidePreview 
          slide={slide} 
          showGrid={showGrid} 
          scale={thumbnailScale}
          titleSlideTitle={titleSlideTitle}
        />
        {/* Dot menu icon - shows on hover */}
        <div 
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={handleMenuClick}
          style={{ 
            width: '28px', 
            height: '28px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            zIndex: 10,
          }}
        >
          <img 
            src="/images/icon-dotmenu.svg" 
            alt="Menu" 
            style={{ width: '16px', height: '16px' }}
          />
        </div>
      </div>
      
      {/* Menu dropdown */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute top-8 right-1 bg-white border border-gray-200 shadow-lg z-20"
          style={{ minWidth: '100px' }}
        >
          <button
            onClick={handleDelete}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            type="button"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

const MemoizedSlidePreviewItem = memo(SlidePreviewItem);

export default function SlidePreviewList({ 
  slides, 
  selectedIndex, 
  onSlideClick,
  onAddSlide,
  onReorderSlides,
  onDeleteSlide,
  showGrid = false,
  titleSlideTitle
}: SlidePreviewListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Store index in dataTransfer for cross-browser compatibility
    e.dataTransfer.setData('text/html', index.toString());
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = draggedIndex ?? parseInt(e.dataTransfer.getData('text/html'), 10);
    const toIndex = index;

    if (fromIndex !== toIndex && onReorderSlides) {
      onReorderSlides(fromIndex, toIndex);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="flex flex-col relative" style={{ height: '100%' }}>
      <div className="flex-1 overflow-y-auto">
        {slides.map((slide, index) => (
          <div
            key={index}
            onDragLeave={handleDragLeave}
            className={dragOverIndex === index ? 'border-t-2 border-blue-400' : ''}
          >
            <MemoizedSlidePreviewItem
              slide={slide}
              index={index}
              isSelected={index === selectedIndex}
              onClick={() => onSlideClick(index)}
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              isDragging={draggedIndex === index}
              showGrid={showGrid}
              titleSlideTitle={titleSlideTitle}
              onDelete={onDeleteSlide}
            />
          </div>
        ))}
      </div>
      {onAddSlide && (
        <button
          onClick={onAddSlide}
          className="sticky bottom-0 w-full p-2 border border-gray-200 outline-none bg-white cursor-pointer text-sm mt-2"
          type="button"
        >
          Add slide
        </button>
      )}
    </div>
  );
}
