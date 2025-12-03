'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker - use local worker file
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PdfPreviewProps {
  pdfBytes: Uint8Array | null;
  showGrid?: boolean;
}

export default function PdfPreview({ pdfBytes, showGrid = false }: PdfPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Create a unique key for canvas based on pdfBytes to force recreation
  const canvasKey = useMemo(() => {
    if (!pdfBytes) return null;
    // Use first few bytes as hash for key
    const hash = Array.from(pdfBytes.slice(0, 10))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hash;
  }, [pdfBytes]);

  useEffect(() => {
    if (!pdfBytes) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }
      setError(null);
      return;
    }

    try {
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);
      setError(null);
    } catch (err) {
      console.error('Error creating blob URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to create preview');
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [pdfBytes]);

  // Render PDF to canvas using object URL (avoids canvas reuse issues)
  useEffect(() => {
    if (!objectUrl || !canvasKey) return;

    const canvas = document.getElementById(`pdf-canvas-${canvasKey}`) as HTMLCanvasElement;
    if (!canvas) return;

    let cancelled = false;
    let renderTask: any = null;

    const renderPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(objectUrl);
        const pdf = await loadingTask.promise;
        
        if (cancelled) return;
        
        const page = await pdf.getPage(1);

        const maxWidth = 1600;
        const viewport = page.getViewport({ scale: 1 });
        const scale = maxWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        if (!context || cancelled) return;

        renderTask = page.render({
          canvasContext: context,
          viewport: scaledViewport,
        });

        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error('Error rendering PDF:', err);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [objectUrl, canvasKey]);

  // Render grid overlay
  useEffect(() => {
    if (!showGrid || !canvasKey) {
      if (gridCanvasRef.current) {
        const gridContext = gridCanvasRef.current.getContext('2d');
        if (gridContext) {
          gridContext.clearRect(0, 0, gridCanvasRef.current.width, gridCanvasRef.current.height);
        }
      }
      return;
    }

    const pdfCanvas = document.getElementById(`pdf-canvas-${canvasKey}`) as HTMLCanvasElement;
    const gridCanvas = gridCanvasRef.current;
    if (!pdfCanvas || !gridCanvas) return;

    // Match grid canvas size to PDF canvas size
    gridCanvas.width = pdfCanvas.width;
    gridCanvas.height = pdfCanvas.height;

    const context = gridCanvas.getContext('2d');
    if (!context) return;

    // Clear grid canvas
    context.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    // PDF size: 1920x1080 points
    // Grid size: 40x40 points
    // Calculate grid size in pixels based on canvas scale
    const pdfWidth = 1920;
    const pdfHeight = 1080;
    const gridSizePoints = 40;
    
    // Calculate scale factor
    const scaleX = gridCanvas.width / pdfWidth;
    const scaleY = gridCanvas.height / pdfHeight;
    const gridSizePx = gridSizePoints * scaleX;

    // Draw gray grid lines
    context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    context.lineWidth = 0.5;

    // Draw vertical grid lines
    for (let x = 0; x <= pdfWidth; x += gridSizePoints) {
      const px = x * scaleX;
      context.beginPath();
      context.moveTo(px, 0);
      context.lineTo(px, gridCanvas.height);
      context.stroke();
    }

    // Draw horizontal grid lines
    for (let y = 0; y <= pdfHeight; y += gridSizePoints) {
      const py = y * scaleY;
      context.beginPath();
      context.moveTo(0, py);
      context.lineTo(gridCanvas.width, py);
      context.stroke();
    }

    // Draw blue quadrant divider lines
    // Vertical divider at x = 960 (middle of page)
    // Horizontal divider at y = 540 (middle of page, accounting for 80px margins on all sides)
    context.strokeStyle = 'rgba(0, 0, 255, 0.3)';
    context.lineWidth = 1;

    // Vertical line at x = 960 (divides left and right quadrants)
    const verticalDividerX = 960 * scaleX;
    context.beginPath();
    context.moveTo(verticalDividerX, 0);
    context.lineTo(verticalDividerX, gridCanvas.height);
    context.stroke();

    // Horizontal line at y = 540 (divides top and bottom quadrants)
    // In PDF coordinates: y = 540 is at 540 points from bottom
    // Need to convert to canvas coordinates (which has Y=0 at top)
    const horizontalDividerYPdf = 540; // 540 points from bottom in PDF
    const horizontalDividerYCanvas = pdfHeight - horizontalDividerYPdf; // Convert to canvas coords
    const horizontalDividerY = horizontalDividerYCanvas * scaleY;
    context.beginPath();
    context.moveTo(0, horizontalDividerY);
    context.lineTo(gridCanvas.width, horizontalDividerY);
    context.stroke();
  }, [showGrid, canvasKey]);

  if (error) {
    return <div className="p-4">Error: {error}</div>;
  }

  if (!pdfBytes || !canvasKey) {
    return <div className="p-4">No PDF data</div>;
  }

  return (
    <div className="relative inline-block">
      <canvas
        id={`pdf-canvas-${canvasKey}`}
        key={canvasKey}
        className="w-full max-w-[1600px] h-auto border border-gray-200"
      />
      {showGrid && (
        <canvas
          ref={gridCanvasRef}
          className="absolute top-0 left-0 w-full max-w-[1600px] h-auto pointer-events-none"
          style={{ mixBlendMode: 'multiply' }}
        />
      )}
    </div>
  );
}
