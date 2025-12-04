import { PDFDocument, rgb, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { SlideState } from './types';

// Helper to calculate quadrant positions
// Rutor: 880px × 460px var, med 80px sidmarginaler på alla sidor
// Page: 1920×1080, margins: 80px all around
// Available area: 1760×920
// Each quadrant: 880×460
interface QuadrantBounds {
  x: number;
  y: number; // bottom in pdf-lib
  width: number;
  height: number;
}

function getQuadrantBounds(quadrant: 1 | 2 | 3 | 4): QuadrantBounds {
  const pageMargin = 80;
  const quadrantWidth = 880;
  const quadrantHeight = 460;
  
  // In pdf-lib, Y=0 is at bottom, Y=1080 is at top
  // Quadrants with page margins of 80px on all sides:
  // - Available area: 1760px × 920px (1920-160 × 1080-160)
  // - Each quadrant: 880px × 460px
  // - Top row (1,2): y from 540 to 1000 (540 = 80+460, 1000 = 80+460+460)
  // - Bottom row (3,4): y from 80 to 540 (80 = margin, 540 = 80+460)
  switch (quadrant) {
    case 1: // Övre vänster
      return { x: pageMargin, y: pageMargin + quadrantHeight, width: quadrantWidth, height: quadrantHeight };
    case 2: // Övre höger
      return { x: pageMargin + quadrantWidth, y: pageMargin + quadrantHeight, width: quadrantWidth, height: quadrantHeight };
    case 3: // Nedre vänster
      return { x: pageMargin, y: pageMargin, width: quadrantWidth, height: quadrantHeight };
    case 4: // Nedre höger
      return { x: pageMargin + quadrantWidth, y: pageMargin, width: quadrantWidth, height: quadrantHeight };
  }
}

// Grid size: 40×40 px (points in pdf-lib)
const GRID_SIZE = 40;

// Helper to snap to grid
function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

async function generateDefaultLayout(
  page: PDFPage,
  state: SlideState,
  martianMono: any,
  ttNorms: any,
  ttNormsBold: any
): Promise<void> {
  // Header - top area, aligned to grid
  // Using Martian Mono, 16px
  // Positioned on second grid row from top
  const headerY = snapToGrid(1080 - 80); // 2 grid units from top (2 * 40px = 80px)
  page.drawText(state.header, {
    x: snapToGrid(80), // 2 grid units from left
    y: headerY,
    size: 16,
    font: martianMono,
    color: rgb(0, 0, 0),
  });
  
  // Title - middle-upper area
  // 125px font size, 125px line-height, -5px letter-spacing
  // Max width: 50% of page = 960px
  const titleY = snapToGrid(1080 - 320); // ~8 grid units from top
  const titleX = snapToGrid(80) - 8; // Nudge 8px to the left to match grid
  const titleMaxWidth = 960; // 50% of 1920px
  const titleFontSize = 125;
  const titleLineHeight = 125;
  const letterSpacing = -5; // -5px letter-spacing (in points)
  
  // Split title into words and wrap lines
  const titleWords = state.title.split(' ');
  const titleLines: string[] = [];
  let currentLine = '';
  
  for (const word of titleWords) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ttNormsBold.widthOfTextAtSize(testLine, titleFontSize);
    
    // Account for letter-spacing: (length - 1) * letterSpacing
    const adjustedWidth = testWidth + (testLine.length - 1) * letterSpacing;
    
    if (adjustedWidth <= titleMaxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        titleLines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    titleLines.push(currentLine);
  }
  
  // Draw each line of title with letter-spacing
  titleLines.forEach((line, lineIndex) => {
    const lineY = titleY - (lineIndex * titleLineHeight);
    let currentX = titleX;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const charWidth = ttNormsBold.widthOfTextAtSize(char, titleFontSize);
      page.drawText(char, {
        x: currentX,
        y: lineY,
        size: titleFontSize,
        font: ttNormsBold,
        color: rgb(0, 0, 0),
      });
      currentX += charWidth + letterSpacing;
    }
  });
  
  // Body text - main content area
  // 22px font size, 27px line-height, -3% letter-spacing
  // Flows from bottom of page with harmonious margins
  // Max width: same as title (960px = 50% of 1920px)
  const bodyFontSize = 22;
  const bodyLineHeight = 27; // 27px line-height
  const bodyLetterSpacing = -(bodyFontSize * 0.03); // -3% letter-spacing (-0.66 points)
  const bodyMaxWidth = 960; // Same as title (50% of 1920px)
  const bodyMarginBottom = snapToGrid(80); // Harmonious bottom margin (2 grid units = 80px)
  const bodyX = snapToGrid(80); // Left margin (2 grid units = 80px)
  
  // Split text into paragraphs (respecting manual line breaks)
  const bodyParagraphs = state.bodyText.split('\n').filter(line => line.trim());
  
  // Build wrapped lines from all paragraphs
  const allWrappedLines: string[] = [];
  
  for (const paragraph of bodyParagraphs) {
    // Split paragraph into words and wrap lines
    const words = paragraph.trim().split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      // Calculate width with letter-spacing adjustment
      const textWidth = ttNorms.widthOfTextAtSize(testLine, bodyFontSize);
      const adjustedWidth = textWidth + ((testLine.length - 1) * bodyLetterSpacing);
      
      if (adjustedWidth <= bodyMaxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          allWrappedLines.push(currentLine);
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      allWrappedLines.push(currentLine);
    }
  }
  
  // Calculate starting Y position from bottom
  // In pdf-lib, Y=0 is at bottom, Y=1080 is at top
  // Start from bottom margin, then move up for each line
  let currentY = bodyMarginBottom; // Start from bottom margin
  
  // Draw lines from bottom up (reverse order: last line first)
  for (let i = allWrappedLines.length - 1; i >= 0; i--) {
    const line = allWrappedLines[i];
    
    // Draw each character with letter-spacing
    let currentX = bodyX;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const charWidth = ttNorms.widthOfTextAtSize(char, bodyFontSize);
      page.drawText(char, {
        x: currentX,
        y: currentY,
        size: bodyFontSize,
        font: ttNorms,
        color: rgb(0, 0, 0),
      });
      currentX += charWidth + bodyLetterSpacing;
    }
    
    // Move up for next line (increase Y since Y=0 is at bottom)
    currentY += bodyLineHeight;
  }
}

async function generateQuadrantLayout(
  page: PDFPage,
  state: SlideState,
  martianMono: any,
  ttNorms: any,
  ttNormsBold: any
): Promise<void> {
  // Header - top area, aligned to grid (same as default)
  const headerY = snapToGrid(1080 - 80);
  page.drawText(state.header, {
    x: snapToGrid(80),
    y: headerY,
    size: 16,
    font: martianMono,
    color: rgb(0, 0, 0),
  });

  // Title in quadrant 3 (nedre vänster) - flödar uppåt från botten
  const quadrant3 = getQuadrantBounds(3);
  const titleFontSize = 125;
  const titleLineHeight = 125;
  const titleLetterSpacing = -5;
  const titleMaxWidth = 800; // 880px - 80px margins
  // Use same horizontal position as default layout (snapToGrid(80) - 8 to match grid)
  const titleX = snapToGrid(80) - 8; // Same nudge as default layout
  const titleBottomY = quadrant3.y; // Start from bottom of quadrant (no extra margin)

  // Split title into words and wrap lines
  const titleWords = state.title.split(' ');
  const titleLines: string[] = [];
  let currentLine = '';

  for (const word of titleWords) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ttNormsBold.widthOfTextAtSize(testLine, titleFontSize);
    const adjustedWidth = testWidth + (testLine.length - 1) * titleLetterSpacing;

    if (adjustedWidth <= titleMaxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        titleLines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    titleLines.push(currentLine);
  }

  // Draw title lines from bottom up (reverse order to draw first line at bottom)
  for (let i = titleLines.length - 1; i >= 0; i--) {
    const line = titleLines[i];
    const lineIndex = titleLines.length - 1 - i;
    const lineY = titleBottomY + (lineIndex * titleLineHeight);
    let currentX = titleX;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const charWidth = ttNormsBold.widthOfTextAtSize(char, titleFontSize);
      page.drawText(char, {
        x: currentX,
        y: lineY,
        size: titleFontSize,
        font: ttNormsBold,
        color: rgb(0, 0, 0),
      });
      currentX += charWidth + titleLetterSpacing;
    }
  }

  // Body text in quadrant 4 (nedre höger) - flödar uppåt från botten
  const quadrant4 = getQuadrantBounds(4);
  const bodyFontSize = 22;
  const bodyLineHeight = 27;
  const bodyLetterSpacing = -(bodyFontSize * 0.03);
  const bodyMaxWidth = 800; // 880px - 80px margins
  const bodyX = quadrant4.x + 40; // 40px margin inside quadrant
  const bodyBottomY = quadrant4.y; // Start from bottom of quadrant (no extra margin)

  // Split text into paragraphs
  const bodyParagraphs = state.bodyText.split('\n').filter(line => line.trim());
  const allWrappedLines: string[] = [];

  for (const paragraph of bodyParagraphs) {
    const words = paragraph.trim().split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = ttNorms.widthOfTextAtSize(testLine, bodyFontSize);
      const adjustedWidth = textWidth + ((testLine.length - 1) * bodyLetterSpacing);

      if (adjustedWidth <= bodyMaxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          allWrappedLines.push(currentLine);
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      allWrappedLines.push(currentLine);
    }
  }

  // Draw body lines from bottom up
  for (let i = allWrappedLines.length - 1; i >= 0; i--) {
    const line = allWrappedLines[i];
    const lineIndex = allWrappedLines.length - 1 - i;
    const lineY = bodyBottomY + (lineIndex * bodyLineHeight);
    let currentX = bodyX;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const charWidth = ttNorms.widthOfTextAtSize(char, bodyFontSize);
      page.drawText(char, {
        x: currentX,
        y: lineY,
        size: bodyFontSize,
        font: ttNorms,
        color: rgb(0, 0, 0),
      });
      currentX += charWidth + bodyLetterSpacing;
    }
  }
}

async function generateQuadrantTopLayout(
  page: PDFPage,
  state: SlideState,
  martianMono: any,
  ttNorms: any,
  ttNormsBold: any
): Promise<void> {
  // Header - top area, aligned to grid (same as default)
  const headerY = snapToGrid(1080 - 80);
  page.drawText(state.header, {
    x: snapToGrid(80),
    y: headerY,
    size: 16,
    font: martianMono,
    color: rgb(0, 0, 0),
  });

  // Title in quadrant 1 (övre vänster) - flödar uppåt från botten av kvadranten
  const quadrant1 = getQuadrantBounds(1);
  const titleFontSize = 125;
  const titleLineHeight = 125;
  const titleLetterSpacing = -5;
  const titleMaxWidth = 800; // 880px - 80px margins
  // Use same horizontal position as default layout (snapToGrid(80) - 8 to match grid)
  const titleX = snapToGrid(80) - 8; // Same nudge as default layout
  const titleBottomY = quadrant1.y; // Start from bottom of quadrant (no extra margin)

  // Split title into words and wrap lines
  const titleWords = state.title.split(' ');
  const titleLines: string[] = [];
  let currentLine = '';

  for (const word of titleWords) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ttNormsBold.widthOfTextAtSize(testLine, titleFontSize);
    const adjustedWidth = testWidth + (testLine.length - 1) * titleLetterSpacing;

    if (adjustedWidth <= titleMaxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        titleLines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    titleLines.push(currentLine);
  }

  // Draw title lines from bottom up (reverse order to draw first line at bottom)
  for (let i = titleLines.length - 1; i >= 0; i--) {
    const line = titleLines[i];
    const lineIndex = titleLines.length - 1 - i;
    const lineY = titleBottomY + (lineIndex * titleLineHeight);
    let currentX = titleX;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const charWidth = ttNormsBold.widthOfTextAtSize(char, titleFontSize);
      page.drawText(char, {
        x: currentX,
        y: lineY,
        size: titleFontSize,
        font: ttNormsBold,
        color: rgb(0, 0, 0),
      });
      currentX += charWidth + titleLetterSpacing;
    }
  }

  // Body text in quadrant 2 (övre höger) - flödar uppåt från botten av kvadranten
  const quadrant2 = getQuadrantBounds(2);
  const bodyFontSize = 22;
  const bodyLineHeight = 27;
  const bodyLetterSpacing = -(bodyFontSize * 0.03);
  const bodyMaxWidth = 800; // 880px - 80px margins
  const bodyX = quadrant2.x + 40; // 40px margin inside quadrant
  const bodyBottomY = quadrant2.y; // Start from bottom of quadrant (no extra margin)

  // Split text into paragraphs
  const bodyParagraphs = state.bodyText.split('\n').filter(line => line.trim());
  const allWrappedLines: string[] = [];

  for (const paragraph of bodyParagraphs) {
    const words = paragraph.trim().split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = ttNorms.widthOfTextAtSize(testLine, bodyFontSize);
      const adjustedWidth = textWidth + ((testLine.length - 1) * bodyLetterSpacing);

      if (adjustedWidth <= bodyMaxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          allWrappedLines.push(currentLine);
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      allWrappedLines.push(currentLine);
    }
  }

  // Draw body lines from bottom up
  for (let i = allWrappedLines.length - 1; i >= 0; i--) {
    const line = allWrappedLines[i];
    const lineIndex = allWrappedLines.length - 1 - i;
    const lineY = bodyBottomY + (lineIndex * bodyLineHeight);
    let currentX = bodyX;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const charWidth = ttNorms.widthOfTextAtSize(char, bodyFontSize);
      page.drawText(char, {
        x: currentX,
        y: lineY,
        size: bodyFontSize,
        font: ttNorms,
        color: rgb(0, 0, 0),
      });
      currentX += charWidth + bodyLetterSpacing;
    }
  }
}

async function generateCenteredLayout(
  page: PDFPage,
  state: SlideState,
  martianMono: any,
  ttNorms: any,
  ttNormsBold: any
): Promise<void> {
  // Header - top area, aligned to grid (same as default)
  const headerY = snapToGrid(1080 - 80);
  page.drawText(state.header, {
    x: snapToGrid(80),
    y: headerY,
    size: 16,
    font: martianMono,
    color: rgb(0, 0, 0),
  });

  // Title - centered vertically and horizontally
  // 125px font size, 125px line-height, -5px letter-spacing
  // Max width: 50% of page = 960px
  const titleFontSize = 125;
  const titleLineHeight = 125;
  const titleLetterSpacing = -5;
  const titleMaxWidth = 960;

  // Split title into words and wrap lines
  const titleWords = state.title.split(' ');
  const titleLines: string[] = [];
  let currentLine = '';

  for (const word of titleWords) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ttNormsBold.widthOfTextAtSize(testLine, titleFontSize);
    const adjustedWidth = testWidth + (testLine.length - 1) * titleLetterSpacing;

    if (adjustedWidth <= titleMaxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        titleLines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    titleLines.push(currentLine);
  }

  // Body text - 40px below title, centered horizontally, flows downward
  // 22px font size, 27px line-height, -3% letter-spacing
  const bodyFontSize = 22;
  const bodyLineHeight = 27;
  const bodyLetterSpacing = -(bodyFontSize * 0.03);
  const bodyMaxWidth = 960;

  // Split text into paragraphs
  const bodyParagraphs = state.bodyText.split('\n').filter(line => line.trim());
  const allWrappedLines: string[] = [];

  for (const paragraph of bodyParagraphs) {
    const words = paragraph.trim().split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = ttNorms.widthOfTextAtSize(testLine, bodyFontSize);
      const adjustedWidth = textWidth + ((testLine.length - 1) * bodyLetterSpacing);

      if (adjustedWidth <= bodyMaxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          allWrappedLines.push(currentLine);
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      allWrappedLines.push(currentLine);
    }
  }

  // Calculate total heights
  const titleHeight = titleLines.length * titleLineHeight;
  const bodyHeight = allWrappedLines.length * bodyLineHeight;
  const gapHeight = 80; // 80px gap (doubled from 40px)
  const totalContentHeight = titleHeight + gapHeight + bodyHeight;

  // Center vertically on page
  // pageCenterY is at 540 (middle of 1080)
  // We want to center the entire content block (title + gap + body) vertically
  const pageCenterY = 540;
  
  // Calculate where title bottom should be to center everything
  // Title bottom is at: centerY + (totalHeight / 2) - titleHeight
  const titleBottomY = pageCenterY + (totalContentHeight / 2) - titleHeight;
  
  // Body starts 40px below title bottom (lower Y value = further down on page)
  const bodyStartY = titleBottomY - gapHeight;

  // Draw title lines from bottom up (grows upward from titleBottomY)
  for (let i = titleLines.length - 1; i >= 0; i--) {
    const line = titleLines[i];
    const lineIndex = titleLines.length - 1 - i;
    const lineY = titleBottomY + (lineIndex * titleLineHeight);

    // Calculate line width for centering
    let lineWidth = 0;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const charWidth = ttNormsBold.widthOfTextAtSize(char, titleFontSize);
      lineWidth += charWidth;
      if (j < line.length - 1) {
        lineWidth += titleLetterSpacing;
      }
    }

    // Center horizontally
    const lineX = (1920 - lineWidth) / 2;

    // Draw each character with letter-spacing
    let currentX = lineX;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const charWidth = ttNormsBold.widthOfTextAtSize(char, titleFontSize);
      page.drawText(char, {
        x: currentX,
        y: lineY,
        size: titleFontSize,
        font: ttNormsBold,
        color: rgb(0, 0, 0),
      });
      currentX += charWidth + titleLetterSpacing;
    }
  }

  // Draw body lines flowing downward from bodyStartY
  // bodyStartY is above titleBottomY, so to flow downward we subtract from Y
  for (let i = 0; i < allWrappedLines.length; i++) {
    const line = allWrappedLines[i];
    const lineY = bodyStartY - (i * bodyLineHeight); // Subtract to go downward (Y increases upward in pdf-lib)

    // Calculate line width for centering
    let lineWidth = 0;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const charWidth = ttNorms.widthOfTextAtSize(char, bodyFontSize);
      lineWidth += charWidth;
      if (j < line.length - 1) {
        lineWidth += bodyLetterSpacing;
      }
    }

    // Center horizontally
    const lineX = (1920 - lineWidth) / 2;

    // Draw each character with letter-spacing
    let currentX = lineX;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const charWidth = ttNorms.widthOfTextAtSize(char, bodyFontSize);
      page.drawText(char, {
        x: currentX,
        y: lineY,
        size: bodyFontSize,
        font: ttNorms,
        color: rgb(0, 0, 0),
      });
      currentX += charWidth + bodyLetterSpacing;
    }
  }
}

export async function generatePdf(state: SlideState): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Register fontkit for custom fonts
  pdfDoc.registerFontkit(fontkit);
  
  // 16:9 aspect ratio: 1920×1080 points (pdf-lib uses points, 1 point = 1/72 inch)
  const page = pdfDoc.addPage([1920, 1080]);
  
  // Load fonts: Martian Mono for header, TT Norms for title and body
  let martianMono: any, ttNorms: any, ttNormsBold: any;
  try {
    const martianMonoUrl = '/fonts/MartianMono-Regular.ttf';
    const ttNormsRegularUrl = '/fonts/TypeType - TT Norms Regular.ttf';
    const ttNormsBoldUrl = '/fonts/TypeType - TT Norms Bold.ttf';
    
    console.log('Loading fonts from:', martianMonoUrl, ttNormsRegularUrl, ttNormsBoldUrl);
    const [martianMonoResponse, ttNormsRegularResponse, ttNormsBoldResponse] = await Promise.all([
      fetch(martianMonoUrl),
      fetch(ttNormsRegularUrl),
      fetch(ttNormsBoldUrl),
    ]);
    
    if (!martianMonoResponse.ok || !ttNormsRegularResponse.ok || !ttNormsBoldResponse.ok) {
      throw new Error(`Failed to load fonts: ${martianMonoResponse.status} / ${ttNormsRegularResponse.status} / ${ttNormsBoldResponse.status}`);
    }
    
    const martianMonoBytes = new Uint8Array(await martianMonoResponse.arrayBuffer());
    const ttNormsRegularBytes = new Uint8Array(await ttNormsRegularResponse.arrayBuffer());
    const ttNormsBoldBytes = new Uint8Array(await ttNormsBoldResponse.arrayBuffer());
    
    console.log('Font bytes loaded, embedding...');
    martianMono = await pdfDoc.embedFont(martianMonoBytes);
    ttNorms = await pdfDoc.embedFont(ttNormsRegularBytes);
    ttNormsBold = await pdfDoc.embedFont(ttNormsBoldBytes);
    console.log('Fonts embedded successfully');
  } catch (error) {
    console.error('Error loading fonts:', error);
    throw error;
  }
  
  // Choose layout based on state.layout
  if (state.layout === 'quadrant-1-2') {
    await generateQuadrantLayout(page, state, martianMono, ttNorms, ttNormsBold);
  } else if (state.layout === 'quadrant-1-2-top') {
    await generateQuadrantTopLayout(page, state, martianMono, ttNorms, ttNormsBold);
  } else if (state.layout === 'centered') {
    await generateCenteredLayout(page, state, martianMono, ttNorms, ttNormsBold);
  } else {
    await generateDefaultLayout(page, state, martianMono, ttNorms, ttNormsBold);
  }
  
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function generateMultiPagePdf(slides: SlideState[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // Register fontkit for custom fonts
  pdfDoc.registerFontkit(fontkit);
  
  // Load fonts once for all pages
  let martianMono: any, ttNorms: any, ttNormsBold: any;
  try {
    const martianMonoUrl = '/fonts/MartianMono-Regular.ttf';
    const ttNormsRegularUrl = '/fonts/TypeType - TT Norms Regular.ttf';
    const ttNormsBoldUrl = '/fonts/TypeType - TT Norms Bold.ttf';
    
    const [martianMonoResponse, ttNormsRegularResponse, ttNormsBoldResponse] = await Promise.all([
      fetch(martianMonoUrl),
      fetch(ttNormsRegularUrl),
      fetch(ttNormsBoldUrl),
    ]);
    
    if (!martianMonoResponse.ok || !ttNormsRegularResponse.ok || !ttNormsBoldResponse.ok) {
      throw new Error(`Failed to load fonts: ${martianMonoResponse.status} / ${ttNormsRegularResponse.status} / ${ttNormsBoldResponse.status}`);
    }
    
    const martianMonoBytes = new Uint8Array(await martianMonoResponse.arrayBuffer());
    const ttNormsRegularBytes = new Uint8Array(await ttNormsRegularResponse.arrayBuffer());
    const ttNormsBoldBytes = new Uint8Array(await ttNormsBoldResponse.arrayBuffer());
    
    martianMono = await pdfDoc.embedFont(martianMonoBytes);
    ttNorms = await pdfDoc.embedFont(ttNormsRegularBytes);
    ttNormsBold = await pdfDoc.embedFont(ttNormsBoldBytes);
  } catch (error) {
    console.error('Error loading fonts:', error);
    throw error;
  }
  
  // Generate a page for each slide
  for (const slide of slides) {
    const page = pdfDoc.addPage([1920, 1080]);
    
    // Choose layout based on slide.layout
    if (slide.layout === 'quadrant-1-2') {
      await generateQuadrantLayout(page, slide, martianMono, ttNorms, ttNormsBold);
    } else if (slide.layout === 'quadrant-1-2-top') {
      await generateQuadrantTopLayout(page, slide, martianMono, ttNorms, ttNormsBold);
    } else if (slide.layout === 'centered') {
      await generateCenteredLayout(page, slide, martianMono, ttNorms, ttNormsBold);
    } else {
      await generateDefaultLayout(page, slide, martianMono, ttNorms, ttNormsBold);
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
