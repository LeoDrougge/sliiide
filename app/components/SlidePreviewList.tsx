'use client';

import { memo, useState } from 'react';
import HtmlSlidePreview from './HtmlSlidePreview';
import type { SlideState } from '../lib/types';

interface SlidePreviewListProps {
  slides: SlideState[];
  selectedIndex: number;
  onSlideClick: (index: number) => void;
  onAddSlide?: () => void;
  onReorderSlides?: (fromIndex: number, toIndex: number) => void;
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
  titleSlideTitle
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
}) {
  const thumbnailScale = 200 / 1920;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      className={`border-2 cursor-move mb-2 transition-all overflow-hidden ${
        isSelected ? 'border-gray-400' : 'border-gray-200'
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{ width: '200px', height: '112.5px', position: 'relative' }}
    >
            <HtmlSlidePreview 
              slide={slide} 
              showGrid={showGrid} 
              scale={thumbnailScale}
              titleSlideTitle={titleSlideTitle}
            />
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
