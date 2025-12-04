'use client';

import HtmlSlidePreview from './HtmlSlidePreview';
import type { SlideState } from '../lib/types';

interface PdfPreviewProps {
  slide: SlideState;
  showGrid?: boolean;
  editable?: boolean;
  onHeaderChange?: (text: string) => void;
  onTitleChange?: (text: string) => void;
  onBodyTextChange?: (text: string) => void;
}

export default function PdfPreview({ 
  slide, 
  showGrid = false,
  editable = false,
  onHeaderChange,
  onTitleChange,
  onBodyTextChange
}: PdfPreviewProps) {
  return (
    <HtmlSlidePreview 
      slide={slide} 
      showGrid={showGrid}
      editable={editable}
      onHeaderChange={onHeaderChange}
      onTitleChange={onTitleChange}
      onBodyTextChange={onBodyTextChange}
    />
  );
}
