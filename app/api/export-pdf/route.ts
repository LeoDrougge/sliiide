import { NextRequest, NextResponse } from 'next/server';
import { generateMultiSlideHtml } from '../../lib/generateSlideHtml';
import type { SlideState } from '../../lib/types';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  console.log('API route called: /api/export-pdf');
  
  try {
    console.log('Parsing request body...');
    const body = await request.json();
    const { slides, showGrid = false } = body;
    console.log(`Received ${slides?.length || 0} slides`);

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { error: 'Invalid slides data' },
        { status: 400 }
      );
    }

    // Validate slides structure
    const validatedSlides: SlideState[] = slides.map((slide: any) => ({
      header: slide.header || '',
      title: slide.title || '',
      bodyText: slide.bodyText || '',
      layout: slide.layout || 'default',
    }));

    // Generate HTML for all slides
    console.log('Generating HTML...');
    let html = generateMultiSlideHtml(validatedSlides, showGrid);
    console.log(`HTML generated, length: ${html.length}`);

    // Replace font URLs with file system paths for Puppeteer
    // Puppeteer needs absolute paths or data URLs
    const publicFontsPath = path.join(process.cwd(), 'public', 'fonts');
    
    // Load fonts as base64 for embedding
    const loadFontAsBase64 = (fontName: string): string => {
      try {
        const fontPath = path.join(publicFontsPath, fontName);
        const fontBuffer = fs.readFileSync(fontPath);
        return `data:font/truetype;charset=utf-8;base64,${fontBuffer.toString('base64')}`;
      } catch (error) {
        console.error(`Error loading font ${fontName}:`, error);
        return '';
      }
    };

    const ttNormsRegular = loadFontAsBase64('TypeType - TT Norms Regular.ttf');
    const ttNormsBold = loadFontAsBase64('TypeType - TT Norms Bold.ttf');
    const martianMono = loadFontAsBase64('MartianMono-Regular.ttf');

    // Replace font URLs in HTML with base64 data URLs
    html = html.replace(
      /url\('\/fonts\/TypeType - TT Norms Regular\.ttf'\)/g,
      `url('${ttNormsRegular}')`
    );
    html = html.replace(
      /url\('\/fonts\/TypeType - TT Norms Bold\.ttf'\)/g,
      `url('${ttNormsBold}')`
    );
    html = html.replace(
      /url\('\/fonts\/MartianMono-Regular\.ttf'\)/g,
      `url('${martianMono}')`
    );

    // Launch Puppeteer - same config as working experiment
    // Use dynamic import to avoid SSR issues
    console.log('Loading Puppeteer...');
    const puppeteer = (await import('puppeteer')).default;
    console.log('Launching Puppeteer...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('Puppeteer launched');

    try {
      const page = await browser.newPage();

      // Set viewport to match slide dimensions
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });

      // Load HTML - same approach as experiment
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      // Emulate print media for CSS print styles
      await page.emulateMediaType('print');

      // Generate PDF with exact dimensions
      const pdfBuffer = await page.pdf({
        width: '1920px',
        height: '1080px',
        printBackground: true,
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
        // For multi-page, use page breaks
        preferCSSPageSize: true,
      });

      await browser.close();

      // Return PDF as response
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename=slides.pdf',
        },
      });
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error for debugging
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF', 
        details: errorMessage,
        ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {})
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}
