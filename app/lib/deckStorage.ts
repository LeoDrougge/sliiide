import type { SavedDeck, SlideState } from './types';

const STORAGE_KEY = 'slide-generator-decks';

export function saveDeckToStorage(deck: SavedDeck): void {
  const decks = getAllDecksFromStorage();
  const existingIndex = decks.findIndex(d => d.id === deck.id);
  
  if (existingIndex >= 0) {
    decks[existingIndex] = deck;
  } else {
    decks.push(deck);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

export function getAllDecksFromStorage(): SavedDeck[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const decks = data ? JSON.parse(data) : [];
    // Migrate old decks that have 'state' instead of 'slides'
    return decks.map((deck: SavedDeck) => {
      if (deck.state && !deck.slides) {
        return {
          ...deck,
          slides: [deck.state],
          selectedSlideIndex: 0,
        };
      }
      return deck;
    });
  } catch {
    return [];
  }
}

export function getDeckFromStorage(id: string): SavedDeck | null {
  const decks = getAllDecksFromStorage();
  return decks.find(d => d.id === id) || null;
}

export function deleteDeckFromStorage(id: string): void {
  const decks = getAllDecksFromStorage();
  const filtered = decks.filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function createDeck(name: string, slides: SlideState[] | SlideState): SavedDeck {
  const slidesArray = Array.isArray(slides) ? slides : [slides];
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    slides: slidesArray,
    selectedSlideIndex: 0,
  };
}

export function updateDeck(deck: SavedDeck, slides: SlideState[] | SlideState): SavedDeck {
  const slidesArray = Array.isArray(slides) ? slides : [slides];
  return {
    ...deck,
    slides: slidesArray,
    updatedAt: Date.now(),
  };
}

export function renameDeckInStorage(id: string, newName: string): void {
  const decks = getAllDecksFromStorage();
  const deck = decks.find(d => d.id === id);
  if (deck) {
    deck.name = newName;
    deck.updatedAt = Date.now();
    saveDeckToStorage(deck);
  }
}

export function exportDeckToJSON(deck: SavedDeck): string {
  return JSON.stringify(deck, null, 2);
}

export function importDeckFromJSON(json: string): SavedDeck | null {
  try {
    const deck = JSON.parse(json);
    // Validate deck structure - support both old (state) and new (slides) format
    if (deck.slides && Array.isArray(deck.slides)) {
      return deck;
    }
    if (deck.state && (deck.state.overline !== undefined || (deck.state as any).header !== undefined) && deck.state.title !== undefined) {
      // Migrate old format
      return {
        ...deck,
        slides: [deck.state],
        selectedSlideIndex: 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

