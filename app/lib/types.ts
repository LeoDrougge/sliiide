export type LayoutType = 'default' | 'quadrant-1-2' | 'quadrant-1-2-top' | 'centered' | 'quadrant-1-2-large';

export interface SlideState {
  header: string;
  title: string;
  bodyText: string;
  layout: LayoutType;
}

export interface SavedDeck {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  slides: SlideState[]; // Changed from state to slides array
  selectedSlideIndex?: number; // Track which slide is currently selected
  // Legacy support: keep state for backward compatibility during migration
  state?: SlideState;
}
