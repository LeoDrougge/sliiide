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
  const bulletListRef = useRef<HTMLUListElement>(null);
  const isEditingRef = useRef(false);
  const lastSyncedBodyTextRef = useRef<string>(slide.bodyText);
  const lastLayoutRef = useRef<string>(slide.layout);

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

  // Initialize/sync bullet list content when slide changes from outside (not from user editing)
  // This includes changes to bodyText OR layout (switching to/from bullet layout)
  useEffect(() => {
    const layoutChanged = slide.layout !== lastLayoutRef.current;
    const bodyTextChanged = slide.bodyText !== lastSyncedBodyTextRef.current;
    
    if (editable && layoutStyles.bodyUseBullets && bulletListRef.current && !isEditingRef.current) {
      // Update if bodyText changed from outside OR layout changed to bullet layout
      if (bodyTextChanged || layoutChanged) {
        lastSyncedBodyTextRef.current = slide.bodyText;
        lastLayoutRef.current = slide.layout;
        
        // Update DOM to match React state
        const lines = slide.bodyText.split('\n').filter(line => line.trim());
        bulletListRef.current.innerHTML = lines
          .map(line => `<li>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`)
          .join('');
      }
    } else if (layoutChanged) {
      // Layout changed but not to bullet layout - update refs
      lastLayoutRef.current = slide.layout;
    }
  }, [slide.bodyText, slide.layout, editable, layoutStyles.bodyUseBullets]);

  return (
    <div ref={wrapperRef} className="slide-wrapper">
      <div ref={frameRef} className="slide-frame">
        <div className={`grid-overlay ${!showGrid ? 'hidden' : ''}`} />
        <div className="slide-content">
          {/* Antrop logo in bottom right corner */}
          <img 
            src="/images/antrop_logo.svg" 
            alt="Antrop" 
            className="slide-logo"
          />
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
              {layoutStyles.bodyUseBullets ? (
                // Editable mode with bullet points using CSS ::marker
                editable ? (
                  <ul 
                    ref={bulletListRef}
                    className={`slide-bullet-list ${layoutStyles.bodyClassName || 'slide-body'}`}
                    style={layoutStyles.body}
                    contentEditable
                    suppressContentEditableWarning
                    onFocus={() => {
                      isEditingRef.current = true;
                    }}
                    onBlur={(e) => {
                      isEditingRef.current = false;
                      // Extract text from all list items, filtering out empty ones
                      const items = Array.from(e.currentTarget.querySelectorAll('li'));
                      const lines = items
                        .map(li => li.textContent?.trim() || '')
                        .filter(line => line.length > 0);
                      const newText = lines.join('\n');
                      lastSyncedBodyTextRef.current = newText; // Update ref to prevent unnecessary re-sync
                      lastLayoutRef.current = slide.layout; // Update layout ref
                      onBodyTextChange?.(newText);
                    }}
                    onInput={() => {
                      // Mark as editing to prevent React from interfering
                      isEditingRef.current = true;
                    }}
                    suppressHydrationWarning
                  >
                    {/* Content managed by useEffect and contentEditable, not React children */}
                  </ul>
                ) : (
                  // Read-only mode
                  <ul 
                    className={`slide-bullet-list ${layoutStyles.bodyClassName || 'slide-body'}`}
                    style={layoutStyles.body}
                  >
                    {slide.bodyText.split('\n').filter(line => line.trim()).map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                )
              ) : (
                // Editable mode without bullet points
                <div 
                  className={layoutStyles.bodyClassName || 'slide-body'} 
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
              )}
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
              <div className={layoutStyles.bodyClassName || 'slide-body'} style={layoutStyles.body}>
                {layoutStyles.bodyUseBullets && layoutStyles.bodyLines ? (
                  // Render with custom bullet points
                  layoutStyles.bodyLines.map((paragraph, pIdx) => {
                    const lineHeight = layoutStyles.bodyLineHeight || 42;
                    // Center bullet vertically with first line: (lineHeight / 2) - (bulletHeight / 2)
                    const bulletMarginTop = (lineHeight / 2) - (14 / 2); // 14px is bullet height
                    return (
                      <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: `${lineHeight}px` }}>
                        <img 
                          src="/images/bullet.svg" 
                          alt="•" 
                          style={{ 
                            width: '14px', 
                            height: '14px',
                            marginRight: '16px',
                            flexShrink: 0,
                            marginTop: `${bulletMarginTop}px`
                          }} 
                        />
                      <div style={{ flex: 1 }}>
                        {paragraph.map((line, lIdx) => (
                          <div key={lIdx} style={{ lineHeight: `${lineHeight}px` }}>{line}</div>
                        ))}
                      </div>
                    </div>
                    );
                  })
                ) : layoutStyles.bodyLines ? (
                  layoutStyles.bodyLines.map((paragraph, pIdx) => (
                    <div key={pIdx}>
                      {paragraph.map((line, lIdx) => (
                        <div key={lIdx} style={{ lineHeight: layoutStyles.bodyLineHeight ? `${layoutStyles.bodyLineHeight}px` : '27px' }}>{line}</div>
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
