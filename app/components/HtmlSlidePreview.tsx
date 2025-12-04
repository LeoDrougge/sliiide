'use client';

import { useEffect, useRef } from 'react';
import type { SlideState } from '../lib/types';
import { getLayoutStyles } from '../lib/htmlSlideLayouts';

interface HtmlSlidePreviewProps {
  slide: SlideState;
  showGrid?: boolean;
  scale?: number; // Optional fixed scale for thumbnails
  editable?: boolean; // Enable direct editing
  onHeaderChange?: (text: string) => void;
  onTitleChange?: (text: string) => void;
  onBodyTextChange?: (text: string) => void;
}

export default function HtmlSlidePreview({ 
  slide, 
  showGrid = false,
  scale,
  editable = false,
  onHeaderChange,
  onTitleChange,
  onBodyTextChange
}: HtmlSlidePreviewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Update scale factor for responsive preview
  useEffect(() => {
    if (scale !== undefined) {
      // Fixed scale (for thumbnails)
      if (frameRef.current) {
        frameRef.current.style.setProperty('--scale-factor', scale.toString());
      }
      return;
    }

    // Responsive scale based on wrapper width
    const wrapper = wrapperRef.current;
    const frame = frameRef.current;
    if (!wrapper || !frame) return;

    const updateScale = () => {
      const wrapperWidth = wrapper.clientWidth;
      const scaleFactor = wrapperWidth / 1920;
      frame.style.setProperty('--scale-factor', scaleFactor.toString());
    };

    updateScale();

    // Use ResizeObserver for accurate updates
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(updateScale);
      resizeObserver.observe(wrapper);
      return () => resizeObserver.disconnect();
    } else {
      // Fallback to window resize
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }
  }, [scale]);

  // Get layout styles using utility function
  const layoutStyles = getLayoutStyles(slide);

  return (
    <div ref={wrapperRef} className="slide-wrapper">
      <div ref={frameRef} className="slide-frame">
        <div className={`grid-overlay ${!showGrid ? 'hidden' : ''}`} />
        <div className="slide-content">
          {editable ? (
            <>
              {/* Editable mode - show raw text, browser handles wrapping */}
              <div 
                className="slide-header" 
                style={layoutStyles.header}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Header"
                onBlur={(e) => {
                  const text = e.currentTarget.textContent || '';
                  onHeaderChange?.(text);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              >
                {slide.header}
              </div>
              <div 
                className="slide-title" 
                style={layoutStyles.title}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Title"
                onBlur={(e) => {
                  const text = e.currentTarget.textContent || '';
                  onTitleChange?.(text);
                }}
                onKeyDown={(e) => {
                  // Allow Enter for multi-line titles
                  // Browser will handle wrapping with CSS
                }}
              >
                {slide.title}
              </div>
              <div 
                className="slide-body" 
                style={layoutStyles.body}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Body text"
                onBlur={(e) => {
                  const text = e.currentTarget.textContent || '';
                  onBodyTextChange?.(text);
                }}
              >
                {slide.bodyText}
              </div>
            </>
          ) : (
            <>
              {/* Read-only mode - use wrapped lines for display */}
              <div className="slide-header" style={layoutStyles.header}>
                {slide.header}
              </div>
              <div className="slide-title" style={layoutStyles.title}>
                {layoutStyles.titleLines ? (
                  layoutStyles.titleLines.map((line, i) => (
                    <div key={i} style={{ lineHeight: '125px' }}>{line}</div>
                  ))
                ) : (
                  slide.title
                )}
              </div>
              <div className="slide-body" style={layoutStyles.body}>
                {layoutStyles.bodyLines ? (
                  layoutStyles.bodyLines.map((paragraph, pIdx) => (
                    <div key={pIdx}>
                      {paragraph.map((line, lIdx) => (
                        <div key={lIdx} style={{ lineHeight: '27px' }}>{line}</div>
                      ))}
                    </div>
                  ))
                ) : (
                  slide.bodyText.split('\n').map((line, i) => (
                    <div key={i}>{line}</div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
