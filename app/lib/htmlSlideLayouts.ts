import type { SlideState } from './types';

// Helper to estimate text width (approximate, since we don't have exact font metrics in browser)
// These are approximations based on average character widths
const ESTIMATED_CHAR_WIDTH_TITLE = 70; // Approx width of 'M' at 125px font size
const ESTIMATED_CHAR_WIDTH_BODY = 13; // Approx width of 'M' at 22px font size

export interface LayoutStyles {
  header: Record<string, string | number>;
  title: Record<string, string | number>;
  body: Record<string, string | number>;
  titleLines?: string[]; // Pre-wrapped title lines
  bodyLines?: string[][]; // Pre-wrapped body lines per paragraph
  bodyUseBullets?: boolean; // Flag to use custom bullet points
  bodyLineHeight?: number; // Line height for body (if different from default)
  bodyClassName?: string; // CSS class name for body (e.g., 'slide-body-large')
}

// Helper function to wrap text (approximate width calculation)
function wrapText(text: string, maxWidth: number, fontSize: number, letterSpacing: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    // Approximate width calculation
    const charWidth = fontSize === 125 ? ESTIMATED_CHAR_WIDTH_TITLE : ESTIMATED_CHAR_WIDTH_BODY;
    const testWidth = testLine.length * charWidth + (testLine.length - 1) * letterSpacing;

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export function getDefaultLayoutStyles(state: SlideState): LayoutStyles {
  const headerY = 80; // 2 grid rows from top
  const headerX = 80;
  
  const titleY = 320; // ~8 grid units from top
  const titleX = 72; // 80px - 8px nudge
  const titleMaxWidth = 960; // 50% of 1920px
  const titleFontSize = 125;
  const titleLetterSpacing = -5;
  const titleLines = wrapText(state.title, titleMaxWidth, titleFontSize, titleLetterSpacing);

  const bodyBottom = 80; // Bottom margin
  const bodyX = 80;
  const bodyMaxWidth = 960;
  const bodyFontSize = 22;
  const bodyLetterSpacing = -0.66; // -3% of 22px
  const bodyParagraphs = state.bodyText.split('\n').filter(line => line.trim());
  const bodyLines = bodyParagraphs.map(p => wrapText(p, bodyMaxWidth, bodyFontSize, bodyLetterSpacing));

  return {
    header: {
      position: 'absolute' as const,
      top: `${headerY}px`,
      left: `${headerX}px`,
    },
    title: {
      position: 'absolute' as const,
      top: `${titleY}px`,
      left: `${titleX}px`,
      maxWidth: `${titleMaxWidth}px`,
    },
    body: {
      position: 'absolute' as const,
      bottom: `${bodyBottom}px`,
      left: `${bodyX}px`,
      maxWidth: `${bodyMaxWidth}px`,
    },
    titleLines,
    bodyLines,
  };
}

export function getQuadrantLayoutStyles(state: SlideState): LayoutStyles {
  const headerY = 80;
  const headerX = 80;

  // Title in quadrant 3 (bottom-left): x=80, bottom of quadrant is at y=540
  // Quadrant 3: x=80-960, y=80-540 (bottom-left)
  const titleX = 72; // Same nudge as default
  const titleMaxWidth = 800; // 880px - 80px margins
  const titleFontSize = 125;
  const titleLetterSpacing = -5;
  const titleLines = wrapText(state.title, titleMaxWidth, titleFontSize, titleLetterSpacing);
  const titleBottom = 460; // Distance from bottom of frame

  // Body in quadrant 4 (bottom-right): x=960+, y=80-540
  const bodyX = 960 + 40; // 40px margin inside quadrant
  const bodyMaxWidth = 800;
  const bodyFontSize = 22;
  const bodyLetterSpacing = -0.66;
  const bodyParagraphs = state.bodyText.split('\n').filter(line => line.trim());
  const bodyLines = bodyParagraphs.map(p => wrapText(p, bodyMaxWidth, bodyFontSize, bodyLetterSpacing));
  const bodyBottom = 460; // Distance from bottom

  return {
    header: {
      position: 'absolute' as const,
      top: `${headerY}px`,
      left: `${headerX}px`,
    },
    title: {
      position: 'absolute' as const,
      bottom: `${titleBottom}px`,
      left: `${titleX}px`,
      maxWidth: `${titleMaxWidth}px`,
    },
    body: {
      position: 'absolute' as const,
      bottom: `${bodyBottom}px`,
      left: `${bodyX}px`,
      maxWidth: `${bodyMaxWidth}px`,
    },
    titleLines,
    bodyLines,
  };
}

export function getQuadrantTopLayoutStyles(state: SlideState): LayoutStyles {
  const headerY = 80;
  const headerX = 80;

  // Title in quadrant 1 (top-left): x=80-960, y=540-1080
  const titleX = 72;
  const titleMaxWidth = 800;
  const titleFontSize = 125;
  const titleLetterSpacing = -5;
  const titleLines = wrapText(state.title, titleMaxWidth, titleFontSize, titleLetterSpacing);
  const titleBottom = 100; // Distance from bottom of frame (top quadrant)

  // Body in quadrant 2 (top-right)
  const bodyX = 960 + 40;
  const bodyMaxWidth = 800;
  const bodyFontSize = 22;
  const bodyLetterSpacing = -0.66;
  const bodyParagraphs = state.bodyText.split('\n').filter(line => line.trim());
  const bodyLines = bodyParagraphs.map(p => wrapText(p, bodyMaxWidth, bodyFontSize, bodyLetterSpacing));
  const bodyBottom = 100; // Distance from bottom

  return {
    header: {
      position: 'absolute' as const,
      top: `${headerY}px`,
      left: `${headerX}px`,
    },
    title: {
      position: 'absolute' as const,
      bottom: `${titleBottom}px`,
      left: `${titleX}px`,
      maxWidth: `${titleMaxWidth}px`,
    },
    body: {
      position: 'absolute' as const,
      bottom: `${bodyBottom}px`,
      left: `${bodyX}px`,
      maxWidth: `${bodyMaxWidth}px`,
    },
    titleLines,
    bodyLines,
  };
}

export function getCenteredLayoutStyles(state: SlideState): LayoutStyles {
  const headerY = 80;
  const headerX = 80;

  const titleMaxWidth = 960;
  const titleFontSize = 125;
  const titleLetterSpacing = -5;
  const titleLines = wrapText(state.title, titleMaxWidth, titleFontSize, titleLetterSpacing);
  const titleLineHeight = 125;
  const titleHeight = titleLines.length * titleLineHeight;

  const bodyMaxWidth = 960;
  const bodyFontSize = 22;
  const bodyLetterSpacing = -0.66;
  const bodyLineHeight = 27;
  const bodyParagraphs = state.bodyText.split('\n').filter(line => line.trim());
  const bodyLines = bodyParagraphs.map(p => wrapText(p, bodyMaxWidth, bodyFontSize, bodyLetterSpacing));

  const gapHeight = 80; // Gap between title and body (doubled from original 40px)
  const pageCenterY = 540; // Middle of 1080px page (540px from top)

  // Title: centered around midline, grows upward from its bottom
  // Title bottom should be at midline (540px from top = 540px from bottom in 1080px container)
  const titleBottomFromBottom = pageCenterY;

  // Body: 80px below title bottom (midline), flows downward
  const bodyTopFromTop = pageCenterY + gapHeight;

  return {
    header: {
      position: 'absolute' as const,
      top: `${headerY}px`,
      left: `${headerX}px`,
    },
    title: {
      position: 'absolute' as const,
      bottom: `${titleBottomFromBottom}px`, // Title bottom at midline (540px from bottom)
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: `${titleMaxWidth}px`,
      textAlign: 'center' as const,
    },
    body: {
      position: 'absolute' as const,
      top: `${bodyTopFromTop}px`, // Body starts 80px below midline (620px from top)
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: `${bodyMaxWidth}px`,
      textAlign: 'center' as const,
    },
    titleLines,
    bodyLines,
  };
}

export function getQuadrantLargeLayoutStyles(state: SlideState): LayoutStyles {
  const headerY = 80;
  const headerX = 80;

  // Title in quadrant 3 (bottom-left): same as quadrant-1-2
  const titleX = 72;
  const titleMaxWidth = 800;
  const titleFontSize = 125;
  const titleLetterSpacing = -5;
  const titleLines = wrapText(state.title, titleMaxWidth, titleFontSize, titleLetterSpacing);
  const titleBottom = 460;

  // Body in quadrant 4 (bottom-right): using body-large style (30px font, 42px line-height)
  const bodyX = 960 + 40;
  const bodyMaxWidth = 800;
  const bodyFontSize = 30; // body-large
  const bodyLetterSpacing = -0.6; // -2% of 30px
  const bodyLineHeight = 42;
  // Parse body text as bullet points (each line is a bullet point)
  const bodyParagraphs = state.bodyText.split('\n').filter(line => line.trim());
  const bodyLines = bodyParagraphs.map(p => wrapText(p, bodyMaxWidth, bodyFontSize, bodyLetterSpacing));
  const bodyBottom = 460;

  return {
    header: {
      position: 'absolute' as const,
      top: `${headerY}px`,
      left: `${headerX}px`,
    },
    title: {
      position: 'absolute' as const,
      bottom: `${titleBottom}px`,
      left: `${titleX}px`,
      maxWidth: `${titleMaxWidth}px`,
    },
    body: {
      position: 'absolute' as const,
      bottom: `${bodyBottom}px`,
      left: `${bodyX}px`,
      maxWidth: `${bodyMaxWidth}px`,
    },
    titleLines,
    bodyLines,
    bodyUseBullets: true, // Flag to indicate we should use custom bullet points
    bodyLineHeight: bodyLineHeight,
    bodyClassName: 'slide-body-large', // Use body-large style
  };
}

export function getLayoutStyles(state: SlideState): LayoutStyles {
  switch (state.layout) {
    case 'title':
      return getDefaultLayoutStyles(state);
    case 'quadrant-1-2':
      return getQuadrantLayoutStyles(state);
    case 'quadrant-1-2-top':
      return getQuadrantTopLayoutStyles(state);
    case 'centered':
      return getCenteredLayoutStyles(state);
    case 'quadrant-1-2-large':
      return getQuadrantLargeLayoutStyles(state);
    default:
      return getDefaultLayoutStyles(state);
  }
}
