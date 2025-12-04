'use client';

import HtmlSlidePreview from './HtmlSlidePreview';
import type { SlideState } from '../lib/types';

interface PdfPreviewProps {
  slide: SlideState;
  showGrid?: boolean;
}

export default function PdfPreview({ slide, showGrid = false }: PdfPreviewProps) {
  return <HtmlSlidePreview slide={slide} showGrid={showGrid} />;
}
