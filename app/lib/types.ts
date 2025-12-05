export type LayoutType = 'title' | 'avdelare' | 'intro' | 'quadrant-1-2' | 'quadrant-1-2-top' | 'centered' | 'quadrant-1-2-large';

export interface SlideState {
  overline: string; // Always shows the main title from title slide (slide 0)
  title: string;
  bodyText: string;
  layout: LayoutType;
  useBullets?: boolean; // Toggle for bullet points on any layout
  colorTheme?: number; // Color theme: 0 (default), 1, or 2
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
