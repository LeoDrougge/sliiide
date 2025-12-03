'use client';

import { memo, useEffect, useState, useRef } from 'react';
import { generatePdf } from '../lib/generatePdf';
import type { SlideState } from '../lib/types';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface SlidePreviewListProps {
  slides: SlideState[];
  selectedIndex: number;
  onSlideClick: (index: number) => void;
  showGrid?: boolean;
}

function SlidePreviewItem({ 
  slide, 
  index, 
  isSelected, 
  onClick
}: { 
  slide: SlideState; 
  index: number; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    generatePdf(slide).then((bytes) => {
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
  }, [slide]);

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
        
        // Scale to fit 200px width while maintaining exact 16:9 aspect ratio
        const targetWidth = 200;
        const targetHeight = targetWidth * (1080 / 1920); // 112.5px for 16:9
        const scale = targetWidth / viewport.width;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext('2d');
        if (!context || cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        const scaledViewport = page.getViewport({ scale });
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error rendering thumbnail:', error);
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
      className={`border-2 cursor-pointer mb-2 transition-all ${
        isSelected ? 'border-gray-400' : 'border-gray-200'
      }`}
      style={{ width: '200px', height: '112.5px', position: 'relative', overflow: 'hidden' }}
    >
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
          Loading...
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '200px', height: '112.5px' }}
        />
      )}
    </div>
  );
}

const MemoizedSlidePreviewItem = memo(SlidePreviewItem);

export default function SlidePreviewList({ 
  slides, 
  selectedIndex, 
  onSlideClick,
  showGrid = false 
}: SlidePreviewListProps) {
  return (
    <div className="flex flex-col">
      {slides.map((slide, index) => (
        <MemoizedSlidePreviewItem
          key={index}
          slide={slide}
          index={index}
          isSelected={index === selectedIndex}
          onClick={() => onSlideClick(index)}
        />
      ))}
    </div>
  );
}
