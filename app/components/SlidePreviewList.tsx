'use client';

import { memo } from 'react';
import HtmlSlidePreview from './HtmlSlidePreview';
import type { SlideState } from '../lib/types';

interface SlidePreviewListProps {
  slides: SlideState[];
  selectedIndex: number;
  onSlideClick: (index: number) => void;
  onAddSlide?: () => void;
  showGrid?: boolean;
}

function SlidePreviewItem({ 
  slide, 
  index, 
  isSelected, 
  onClick,
  showGrid
}: { 
  slide: SlideState; 
  index: number; 
  isSelected: boolean; 
  onClick: () => void;
  showGrid?: boolean;
}) {
  // Scale for thumbnail: 200px / 1920px = 0.104167
  const thumbnailScale = 200 / 1920;

  return (
    <div
      onClick={onClick}
      className={`border-2 cursor-pointer mb-2 transition-all overflow-hidden ${
        isSelected ? 'border-gray-400' : 'border-gray-200'
      }`}
      style={{ width: '200px', height: '112.5px', position: 'relative' }}
    >
      <HtmlSlidePreview 
        slide={slide} 
        showGrid={showGrid} 
        scale={thumbnailScale}
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
  showGrid = false 
}: SlidePreviewListProps) {
  return (
    <div className="flex flex-col relative" style={{ height: '100%' }}>
      <div className="flex-1 overflow-y-auto">
        {slides.map((slide, index) => (
          <MemoizedSlidePreviewItem
            key={index}
            slide={slide}
            index={index}
            isSelected={index === selectedIndex}
            onClick={() => onSlideClick(index)}
            showGrid={showGrid}
          />
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
