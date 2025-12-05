'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import HtmlSlidePreview from './components/HtmlSlidePreview';
import SlidePreviewList from './components/SlidePreviewList';
import DeckGrid from './components/DeckGrid';
// Removed generatePdf imports - now using HTML/CSS preview and Puppeteer export
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
  
  const [showGrid, setShowGrid] = useState(false);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [slideAmountMode, setSlideAmountMode] = useState<'auto' | 'edit'>('auto');
  const [slideAmountMin, setSlideAmountMin] = useState<number>(5);
  const [slideAmountMax, setSlideAmountMax] = useState<number>(15);
  const [deckName, setDeckName] = useState('');
  const [isUnsaved, setIsUnsaved] = useState(false);
  const [showHomeScreen, setShowHomeScreen] = useState(true); // Start with home screen
  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isChangingSlide = useRef(false); // Track if we're switching slides (not editing)

  // Load saved decks from storage on mount
  useEffect(() => {
    const decks = getAllDecksFromStorage();
    setSavedDecks(decks);
    // Always start with home screen
    setShowHomeScreen(true);
    isInitialMount.current = false;
  }, []);

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

  // No need for PDF generation anymore - preview is HTML/CSS based

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
    setSlideAmountMode('auto');
    setSlideAmountMin(5);
    setSlideAmountMax(15);
  };

  const handleGenerateSlides = async () => {
    if (!notes.trim()) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notes,
          slideAmountMode,
          slideAmountMin: slideAmountMode === 'edit' ? slideAmountMin : undefined,
          slideAmountMax: slideAmountMode === 'edit' ? slideAmountMax : undefined,
        }),
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

  const handleAddSlide = () => {
    // Save current slide changes before adding new one
    setSlides(prev => {
      const updated = [...prev];
      updated[selectedSlideIndex] = state;
      // Add new slide at the end
      const newSlide: SlideState = {
        header: '',
        title: '',
        bodyText: '',
        layout: 'default',
      };
      updated.push(newSlide);
      return updated;
    });
    
    // Select the newly added slide
    isChangingSlide.current = true;
    const newIndex = slides.length;
    setSelectedSlideIndex(newIndex);
    setState({
      header: '',
      title: '',
      bodyText: '',
      layout: 'default',
    });
  };

  const handleReorderSlides = (fromIndex: number, toIndex: number) => {
    // Save current slide changes before reordering
    setSlides(prev => {
      const updated = [...prev];
      updated[selectedSlideIndex] = state;
      
      // Reorder slides
      const [movedSlide] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedSlide);
      
      // Update selected index if needed
      if (selectedSlideIndex === fromIndex) {
        // Selected slide was moved
        setSelectedSlideIndex(toIndex);
      } else if (selectedSlideIndex > fromIndex && selectedSlideIndex <= toIndex) {
        // Selected slide is after the moved slide, shift it left
        setSelectedSlideIndex(selectedSlideIndex - 1);
      } else if (selectedSlideIndex < fromIndex && selectedSlideIndex >= toIndex) {
        // Selected slide is before the moved slide, shift it right
        setSelectedSlideIndex(selectedSlideIndex + 1);
      }
      // If selected slide is outside the range, no change needed
      
      return updated;
    });
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
      // Save current slide changes before exporting
      const currentSlides = [...slides];
      currentSlides[selectedSlideIndex] = state;
      
      // Call Puppeteer API to generate PDF
      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: currentSlides,
          showGrid,
        }),
      });

      // Check content-type first to handle errors properly
      const contentType = response.headers.get('content-type') || '';
      
      if (!response.ok) {
        let errorMessage = `Failed to generate PDF (${response.status})`;
        
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch (e) {
            console.error('Failed to parse error JSON:', e);
          }
        } else if (contentType.includes('text/html')) {
          // Response is HTML (error page from Next.js)
          const text = await response.text();
          console.error('API returned HTML error page (likely route crashed):', text.substring(0, 500));
          errorMessage = 'Server error occurred. Check browser console for details.';
        } else {
          // Unknown content type
          const text = await response.text();
          console.error('API returned unexpected content type:', contentType, text.substring(0, 500));
        }
        
        throw new Error(errorMessage);
      }
      
      // Check if response is actually a PDF
      if (!contentType.includes('application/pdf')) {
        // Not a PDF - likely an error
        const text = await response.text();
        console.error('API returned non-PDF response:', contentType, text.substring(0, 500));
        throw new Error('Server did not return a PDF. Check console for details.');
      }

      const blob = await response.blob();
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
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to export PDF: ${errorMsg}\n\nCheck the browser console for more details.`);
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
                className="w-full p-2 border border-gray-200 outline-none bg-transparent resize-none mb-4"
                style={{ minHeight: '300px' }}
              />
              
              {/* Amount of slides section */}
              <div className="mb-4">
                <div className="text-sm mb-2">Amount of slides</div>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setSlideAmountMode('auto')}
                    className={`p-2 border border-gray-200 outline-none bg-transparent cursor-pointer ${
                      slideAmountMode === 'auto' ? 'bg-gray-100' : ''
                    }`}
                    type="button"
                  >
                    Auto (Claude gör minimala anpassningar)
                  </button>
                  <button
                    onClick={() => setSlideAmountMode('edit')}
                    className={`p-2 border border-gray-200 outline-none bg-transparent cursor-pointer ${
                      slideAmountMode === 'edit' ? 'bg-gray-100' : ''
                    }`}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
                
                {/* Sliders - only show when Edit is selected */}
                {slideAmountMode === 'edit' && (
                  <div className="mt-3 space-y-3">
                    {/* Min slider */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">Min:</span>
                        <span className="text-sm font-mono">{slideAmountMin}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs">3</span>
                        <input
                          type="range"
                          min="3"
                          max="32"
                          value={slideAmountMin}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setSlideAmountMin(val);
                            if (val > slideAmountMax) {
                              setSlideAmountMax(val);
                            }
                          }}
                          className="flex-1"
                        />
                        <span className="text-xs">32</span>
                      </div>
                    </div>
                    
                    {/* Max slider */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">Max:</span>
                        <span className="text-sm font-mono">{slideAmountMax}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs">3</span>
                        <input
                          type="range"
                          min="3"
                          max="32"
                          value={slideAmountMax}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setSlideAmountMax(val);
                            if (val < slideAmountMin) {
                              setSlideAmountMin(val);
                            }
                          }}
                          className="flex-1"
                        />
                        <span className="text-xs">32</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
              className="w-full p-2 border border-gray-200 outline-none bg-transparent resize-none mb-4"
              style={{ minHeight: '300px' }}
            />
            
            {/* Amount of slides section */}
            <div className="mb-4">
              <div className="text-sm mb-2">Amount of slides</div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setSlideAmountMode('auto')}
                  className={`p-2 border border-gray-200 outline-none bg-transparent cursor-pointer ${
                    slideAmountMode === 'auto' ? 'bg-gray-100' : ''
                  }`}
                  type="button"
                >
                  Auto (Claude gör minimala anpassningar)
                </button>
                <button
                  onClick={() => setSlideAmountMode('edit')}
                  className={`p-2 border border-gray-200 outline-none bg-transparent cursor-pointer ${
                    slideAmountMode === 'edit' ? 'bg-gray-100' : ''
                  }`}
                  type="button"
                >
                  Edit
                </button>
              </div>
              
              {/* Sliders - only show when Edit is selected */}
              {slideAmountMode === 'edit' && (
                <div className="mt-3 space-y-3">
                  {/* Min slider */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">Min:</span>
                      <span className="text-sm font-mono">{slideAmountMin}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs">3</span>
                      <input
                        type="range"
                        min="3"
                        max="32"
                        value={slideAmountMin}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setSlideAmountMin(val);
                          if (val > slideAmountMax) {
                            setSlideAmountMax(val);
                          }
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs">32</span>
                    </div>
                  </div>
                  
                  {/* Max slider */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">Max:</span>
                      <span className="text-sm font-mono">{slideAmountMax}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs">3</span>
                      <input
                        type="range"
                        min="3"
                        max="32"
                        value={slideAmountMax}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setSlideAmountMax(val);
                          if (val < slideAmountMin) {
                            setSlideAmountMin(val);
                          }
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs">32</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
      
      <div className="flex gap-4 w-full h-[calc(100vh-120px)] overflow-x-auto">
        {/* Left: Slide preview list */}
        <div className="flex flex-col gap-2 flex-shrink-0" style={{ width: '220px', height: '100%' }}>
          <div className="text-sm font-normal mb-2">Slides</div>
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {slides.length > 0 ? (
              <SlidePreviewList
                slides={slides}
                selectedIndex={selectedSlideIndex}
                onSlideClick={handleSlideClick}
                onAddSlide={handleAddSlide}
                onReorderSlides={handleReorderSlides}
                showGrid={showGrid}
              />
            ) : (
              <div className="text-sm text-gray-400">No slides</div>
            )}
          </div>
        </div>

        {/* Middle: Main PDF preview with direct editing */}
        <div className="flex flex-col gap-2 flex-1">
          <HtmlSlidePreview 
            slide={state} 
            showGrid={showGrid}
            editable={true}
            onHeaderChange={(text) => setState({ ...state, header: text })}
            onTitleChange={(text) => setState({ ...state, title: text })}
            onBodyTextChange={(text) => setState({ ...state, bodyText: text })}
          />
        </div>

        {/* Right: Layout selector list */}
        <div className="flex flex-col gap-2 flex-shrink-0" style={{ width: '200px' }}>
          <div className="text-sm font-normal mb-2">Layout</div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setState({ ...state, layout: 'default' })}
              className={`p-2 border border-gray-200 outline-none bg-transparent cursor-pointer text-left ${
                state.layout === 'default' ? 'bg-gray-100' : ''
              }`}
              type="button"
            >
              Default Layout
            </button>
            <button
              onClick={() => setState({ ...state, layout: 'quadrant-1-2' })}
              className={`p-2 border border-gray-200 outline-none bg-transparent cursor-pointer text-left ${
                state.layout === 'quadrant-1-2' ? 'bg-gray-100' : ''
              }`}
              type="button"
            >
              Quadrant (Bottom)
            </button>
            <button
              onClick={() => setState({ ...state, layout: 'quadrant-1-2-top' })}
              className={`p-2 border border-gray-200 outline-none bg-transparent cursor-pointer text-left ${
                state.layout === 'quadrant-1-2-top' ? 'bg-gray-100' : ''
              }`}
              type="button"
            >
              Quadrant (Top)
            </button>
            <button
              onClick={() => setState({ ...state, layout: 'centered' })}
              className={`p-2 border border-gray-200 outline-none bg-transparent cursor-pointer text-left ${
                state.layout === 'centered' ? 'bg-gray-100' : ''
              }`}
              type="button"
            >
              Centered Layout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
