'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PdfPreview from './components/PdfPreview';
import SlidePreviewList from './components/SlidePreviewList';
import DeckGrid from './components/DeckGrid';
import { generatePdf, generateMultiPagePdf } from './lib/generatePdf';
import type { SlideState, LayoutType, SavedDeck } from './lib/types';
import {
  saveDeckToStorage,
  getAllDecksFromStorage,
  getDeckFromStorage,
  deleteDeckFromStorage,
  createDeck,
  updateDeck,
  exportDeckToJSON,
  importDeckFromJSON,
} from './lib/deckStorage';

const dummyText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.`;

const initialState: SlideState = {
  header: 'Q4 Update — Draft',
  title: 'Roadmap Overview',
  bodyText: dummyText,
  layout: 'default',
};

export default function Home() {
  // Multi-slide state
  const [slides, setSlides] = useState<SlideState[]>([initialState]);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  
  // Current slide state (for editing)
  const currentSlide = slides[selectedSlideIndex] || initialState;
  const [state, setState] = useState<SlideState>(currentSlide);
  
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [isUnsaved, setIsUnsaved] = useState(false);
  const [showHomeScreen, setShowHomeScreen] = useState(true); // Start with home screen
  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isChangingSlide = useRef(false); // Track if we're switching slides (not editing)

  const updatePdf = useCallback(async (newState: SlideState) => {
    try {
      console.log('Generating PDF with state:', newState);
      const bytes = await generatePdf(newState);
      console.log('PDF generated, bytes length:', bytes.length);
      if (bytes && bytes.length > 0) {
        setPdfBytes(bytes);
      } else {
        console.error('PDF bytes is empty!');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfBytes(null);
    }
  }, []);

  // Load saved decks from storage on mount
  useEffect(() => {
    const decks = getAllDecksFromStorage();
    setSavedDecks(decks);
    // Always start with home screen
    setShowHomeScreen(true);
  }, []);

  // Initial PDF generation
  useEffect(() => {
    console.log('Initial mount, generating PDF...');
    updatePdf(state);
    isInitialMount.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update state when selected slide changes
  useEffect(() => {
    if (isChangingSlide.current) {
      isChangingSlide.current = false;
      return; // Skip if we're in the middle of changing slides
    }
    const slide = slides[selectedSlideIndex];
    if (slide) {
      setState(slide);
    }
  }, [selectedSlideIndex, slides]);

  // Update slides array when state changes (but not when just switching slides)
  useEffect(() => {
    if (isInitialMount.current) return;
    if (isChangingSlide.current) return; // Don't update slides array when switching slides
    
    setSlides(prev => {
      const updated = [...prev];
      updated[selectedSlideIndex] = state;
      return updated;
    });
  }, [state, selectedSlideIndex]);

  // Auto-save deck when slides change (if deck has a name)
  useEffect(() => {
    if (isInitialMount.current) return;
    if (!currentDeckId) {
      setIsUnsaved(true);
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Auto-save after 500ms of no changes
    autoSaveTimerRef.current = setTimeout(() => {
      const deck = getDeckFromStorage(currentDeckId);
      if (deck) {
        const updatedDeck = updateDeck(deck, slides);
        saveDeckToStorage(updatedDeck);
        setSavedDecks(getAllDecksFromStorage());
        setIsUnsaved(false);
      }
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [slides, currentDeckId]);

  // Debounced update when state changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) return;

    const timer = setTimeout(() => {
      updatePdf(state);
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [state, updatePdf]);

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, header: e.target.value });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, title: e.target.value });
  };

  const handleBodyTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState({ ...state, bodyText: e.target.value });
  };

  const handleLayoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setState({ ...state, layout: e.target.value as LayoutType });
  };

  const handleCreateNewDeck = () => {
    setShowCreateDialog(true);
  };

  const handleCreateFromScratch = () => {
    setSlides([initialState]);
    setSelectedSlideIndex(0);
    setState(initialState);
    setCurrentDeckId(null);
    setDeckName('');
    setIsUnsaved(false);
    setShowCreateDialog(false);
    setShowNameDialog(true);
    setShowHomeScreen(false); // Switch to editor view
  };

  const handleGenerateFromNotes = () => {
    setShowCreateDialog(false);
    setShowNotesDialog(true);
    setNotes('');
  };

  const handleGenerateSlides = async () => {
    if (!notes.trim()) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to generate slides';
        console.error('API error:', errorMessage);
        alert(`Failed to generate slides: ${errorMessage}. ${data.error?.includes('API_KEY') ? 'Please check your ANTHROPIC_API_KEY in .env.local' : ''}`);
        return;
      }

      if (!data.slides || !Array.isArray(data.slides) || data.slides.length === 0) {
        throw new Error('Invalid response from server: no slides returned');
      }

      setSlides(data.slides);
      setSelectedSlideIndex(0);
      setState(data.slides[0] || initialState);
      setCurrentDeckId(null);
      setDeckName('');
      setIsUnsaved(false);
      setShowNotesDialog(false);
      setNotes('');
      setShowNameDialog(true);
      setShowHomeScreen(false); // Switch to editor view
    } catch (error: any) {
      console.error('Error generating slides:', error);
      alert(`Failed to generate slides: ${error.message || 'Unknown error'}. Please check your console for details.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNameDeck = () => {
    if (!deckName.trim()) return;

    let deck: SavedDeck;
    if (currentDeckId) {
      // Rename existing deck
      const existingDeck = getDeckFromStorage(currentDeckId);
      if (existingDeck) {
        deck = {
          ...existingDeck,
          name: deckName.trim(),
          slides,
          selectedSlideIndex,
          updatedAt: Date.now(),
        };
      } else {
        deck = createDeck(deckName.trim(), slides);
        deck.selectedSlideIndex = selectedSlideIndex;
      }
    } else {
      // Create new named deck
      deck = createDeck(deckName.trim(), slides);
      deck.selectedSlideIndex = selectedSlideIndex;
    }

    saveDeckToStorage(deck);
    setSavedDecks(getAllDecksFromStorage());
    setCurrentDeckId(deck.id);
    setShowNameDialog(false);
    setIsUnsaved(false);
  };

  const handleLoadDeck = (deckId: string) => {
    const deck = getDeckFromStorage(deckId);
    if (deck) {
      setSlides(deck.slides || [deck.state || initialState]);
      const slideIndex = deck.selectedSlideIndex ?? 0;
      setSelectedSlideIndex(slideIndex);
      const currentSlide = deck.slides?.[slideIndex] || deck.state || initialState;
      setState(currentSlide);
      setCurrentDeckId(deck.id);
      setDeckName(deck.name);
      setIsUnsaved(false);
      setShowHomeScreen(false); // Switch to editor view
    }
  };

  const handleSlideClick = (index: number) => {
    if (index === selectedSlideIndex) return; // Already selected
    
    // Save current slide changes before switching
    setSlides(prev => {
      const updated = [...prev];
      updated[selectedSlideIndex] = state;
      return updated;
    });
    
    // Switch to new slide
    isChangingSlide.current = true;
    setSelectedSlideIndex(index);
    const newSlide = slides[index];
    if (newSlide) {
      setState(newSlide);
    }
  };

  const handleDeleteDeck = (deckId: string) => {
    deleteDeckFromStorage(deckId);
    setSavedDecks(getAllDecksFromStorage());
    if (currentDeckId === deckId) {
      setSlides([initialState]);
      setSelectedSlideIndex(0);
      setState(initialState);
      setCurrentDeckId(null);
      setDeckName('');
    }
  };

  const handleExportDeck = () => {
    const deck = currentDeckId ? getDeckFromStorage(currentDeckId) : null;
    if (!deck) {
      // Create temporary deck for export
      const tempDeck = createDeck(deckName.trim() || 'Untitled Deck', slides);
      tempDeck.selectedSlideIndex = selectedSlideIndex;
      const json = exportDeckToJSON(tempDeck);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tempDeck.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const json = exportDeckToJSON(deck);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportDeck = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const json = event.target?.result as string;
        const deck = importDeckFromJSON(json);
        if (deck) {
          // Generate new ID and save
          const newDeck = {
            ...deck,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };
          saveDeckToStorage(newDeck);
          setSavedDecks(getAllDecksFromStorage());
          setSlides(newDeck.slides || [newDeck.state || initialState]);
          const slideIndex = newDeck.selectedSlideIndex ?? 0;
          setSelectedSlideIndex(slideIndex);
          const currentSlide = newDeck.slides?.[slideIndex] || newDeck.state || initialState;
          setState(currentSlide);
          setCurrentDeckId(newDeck.id);
          setDeckName(newDeck.name);
          setShowHomeScreen(false); // Switch to editor view
          setSavedDecks(getAllDecksFromStorage()); // Refresh deck list
        } else {
          alert('Invalid deck file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExport = async () => {
    try {
      // Generate multi-page PDF with all slides
      const allPdfBytes = await generateMultiPagePdf(slides);
      
      const blob = new Blob([new Uint8Array(allPdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const deckName = currentDeckId ? getDeckFromStorage(currentDeckId)?.name : 'deck';
      link.download = `${deckName ? deckName.replace(/[^a-z0-9]/gi, '_') : 'deck'}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  // Home screen - show deck grid
  if (showHomeScreen) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <img 
            src="/images/logo-placeholder.svg" 
            alt="Logo" 
            className="h-[38px] object-contain"
          />
          <button
            onClick={handleCreateNewDeck}
            className="p-2 border-0 outline-none bg-transparent cursor-pointer"
            type="button"
          >
            Create new deck
          </button>
        </div>
        <DeckGrid 
          decks={savedDecks} 
          onDeckClick={(deck) => handleLoadDeck(deck.id)} 
        />
        
        {/* Create Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 border border-gray-200">
              <h2 className="text-lg mb-4">Create New Deck</h2>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleCreateFromScratch}
                  className="p-3 border border-gray-200 outline-none bg-transparent cursor-pointer text-left"
                  type="button"
                >
                  Create from scratch
                </button>
                <button
                  onClick={handleGenerateFromNotes}
                  className="p-3 border border-gray-200 outline-none bg-transparent cursor-pointer text-left"
                  type="button"
                >
                  Generate from notes
                </button>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer mt-2"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes Dialog */}
        {showNotesDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 border border-gray-200" style={{ width: '600px', maxHeight: '80vh' }}>
              <h2 className="text-lg mb-2">Generate Slides from Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your notes here..."
                className="w-full p-2 border border-gray-200 outline-none bg-transparent resize-none mb-2"
                style={{ minHeight: '300px' }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowNotesDialog(false);
                    setNotes('');
                  }}
                  className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer"
                  type="button"
                  disabled={isGenerating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateSlides}
                  disabled={!notes.trim() || isGenerating}
                  className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer disabled:opacity-50"
                  type="button"
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Name/Rename Deck Dialog */}
        {showNameDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 border border-gray-200">
              <h2 className="text-lg mb-2">{currentDeckId ? 'Rename Deck' : 'Name Deck'}</h2>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Deck name"
                className="w-full p-2 border border-gray-200 outline-none bg-transparent mb-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleNameDeck();
                  } else if (e.key === 'Escape') {
                    setShowNameDialog(false);
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowNameDialog(false)}
                  className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNameDeck}
                  disabled={!deckName.trim()}
                  className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer disabled:opacity-50"
                  type="button"
                >
                  {currentDeckId ? 'Rename' : 'Name & Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Editor screen - show slide editor
  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img 
            src="/images/logo-placeholder.svg" 
            alt="Logo" 
            className="h-[38px] object-contain cursor-pointer"
            onClick={() => {
              // Save current deck before going to home
              if (currentDeckId) {
                const deck = getDeckFromStorage(currentDeckId);
                if (deck) {
                  const updatedDeck = updateDeck(deck, slides);
                  updatedDeck.selectedSlideIndex = selectedSlideIndex;
                  saveDeckToStorage(updatedDeck);
                  setSavedDecks(getAllDecksFromStorage());
                }
              }
              setShowHomeScreen(true);
            }}
          />
          <button
            onClick={handleCreateNewDeck}
            className="p-2 border-0 outline-none bg-transparent cursor-pointer"
            type="button"
          >
            Create new deck
          </button>
          {currentDeckId && (
            <button
              onClick={() => {
                const deck = getDeckFromStorage(currentDeckId);
                setDeckName(deck?.name || '');
                setShowNameDialog(true);
              }}
              className="p-2 border-0 outline-none bg-transparent cursor-pointer"
              type="button"
              title="Rename deck"
            >
              Rename
            </button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className="p-2 border-0 outline-none bg-transparent cursor-pointer"
            type="button"
          >
            {showGrid ? 'Hide Grid' : 'Show Grid'}
          </button>
          <button
            onClick={handleExport}
            className="p-2 border-0 outline-none bg-transparent cursor-pointer"
            type="button"
          >
            Export PDF
          </button>
        </div>
      </div>
      
      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 border border-gray-200">
            <h2 className="text-lg mb-4">Create New Deck</h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCreateFromScratch}
                className="p-3 border border-gray-200 outline-none bg-transparent cursor-pointer text-left"
                type="button"
              >
                Create from scratch
              </button>
              <button
                onClick={handleGenerateFromNotes}
                className="p-3 border border-gray-200 outline-none bg-transparent cursor-pointer text-left"
                type="button"
              >
                Generate from notes
              </button>
              <button
                onClick={() => setShowCreateDialog(false)}
                className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer mt-2"
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Dialog */}
      {showNotesDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 border border-gray-200" style={{ width: '600px', maxHeight: '80vh' }}>
            <h2 className="text-lg mb-2">Generate Slides from Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste your notes here..."
              className="w-full p-2 border border-gray-200 outline-none bg-transparent resize-none mb-2"
              style={{ minHeight: '300px' }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNotesDialog(false);
                  setNotes('');
                }}
                className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateSlides}
                disabled={!notes.trim() || isGenerating}
                className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer disabled:opacity-50"
                type="button"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNameDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 border border-gray-200">
            <h2 className="text-lg mb-2">{currentDeckId ? 'Rename Deck' : 'Name Deck'}</h2>
            <input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="Deck name"
              className="w-full p-2 border border-gray-200 outline-none bg-transparent mb-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNameDeck();
                } else if (e.key === 'Escape') {
                  setShowNameDialog(false);
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNameDialog(false)}
                className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleNameDeck}
                disabled={!deckName.trim()}
                className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer disabled:opacity-50"
                type="button"
              >
                {currentDeckId ? 'Rename' : 'Name & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex gap-4 w-full max-w-[1800px] h-[calc(100vh-120px)]">
        {/* Left: Slide preview list */}
        <div className="flex flex-col gap-2 flex-shrink-0" style={{ width: '220px' }}>
          <div className="text-sm font-normal mb-2">Slides</div>
          <div className="flex-1 overflow-y-auto">
            {slides.length > 0 ? (
              <SlidePreviewList
                slides={slides}
                selectedIndex={selectedSlideIndex}
                onSlideClick={handleSlideClick}
                showGrid={showGrid}
              />
            ) : (
              <div className="text-sm text-gray-400">No slides</div>
            )}
          </div>
        </div>

        {/* Middle: Main PDF preview */}
        <div className="flex flex-col gap-2 flex-1">
          {pdfBytes ? (
            <PdfPreview pdfBytes={pdfBytes} showGrid={showGrid} />
          ) : (
            <div className="p-4">Generating PDF...</div>
          )}
        </div>

        {/* Right: Input fields and layout selector */}
        <div className="flex flex-col gap-2 flex-shrink-0" style={{ width: '300px' }}>
          <input
            type="text"
            value={state.header}
            onChange={handleHeaderChange}
            className="w-full p-2 border border-gray-200 outline-none bg-transparent"
            placeholder="Header"
          />
          <input
            type="text"
            value={state.title}
            onChange={handleTitleChange}
            className="w-full p-2 border border-gray-200 outline-none bg-transparent"
            placeholder="Title"
          />
          <textarea
            value={state.bodyText}
            onChange={handleBodyTextChange}
            className="w-full p-2 border border-gray-200 outline-none bg-transparent resize-none flex-1"
            placeholder="Body text"
          />
          <select
            value={state.layout}
            onChange={handleLayoutChange}
            className="p-2 border border-gray-200 outline-none bg-transparent cursor-pointer"
          >
            <option value="default">Default Layout</option>
            <option value="quadrant-1-2">Quadrant Layout (Bottom)</option>
            <option value="quadrant-1-2-top">Quadrant Layout (Top)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
