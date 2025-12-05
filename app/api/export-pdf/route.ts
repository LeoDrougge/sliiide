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
      layout: slide.layout || 'title',
      useBullets: slide.useBullets ?? false,
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

    // Load logo as base64 for embedding
    const publicImagesPath = path.join(process.cwd(), 'public', 'images');
    const loadLogoAsBase64 = (): string => {
      try {
        const logoPath = path.join(publicImagesPath, 'antrop_logo.svg');
        console.log('Loading logo from:', logoPath);
        if (!fs.existsSync(logoPath)) {
          console.error('Logo file does not exist:', logoPath);
          return '';
        }
        const logoContent = fs.readFileSync(logoPath, 'utf-8');
        // For SVG, we can use base64 encoding
        const logoBase64 = Buffer.from(logoContent, 'utf-8').toString('base64');
        const dataUrl = `data:image/svg+xml;base64,${logoBase64}`;
        console.log('Logo loaded successfully, data URL length:', dataUrl.length);
        return dataUrl;
      } catch (error) {
        console.error('Error loading logo:', error);
        return '';
      }
    };

    const logoDataUrl = loadLogoAsBase64();
    
    // Load bullet as base64 for embedding
    const loadBulletAsBase64 = (): string => {
      try {
        const bulletPath = path.join(publicImagesPath, 'bullet.svg');
        console.log('Loading bullet from:', bulletPath);
        if (!fs.existsSync(bulletPath)) {
          console.error('Bullet file does not exist:', bulletPath);
          return '';
        }
        const bulletContent = fs.readFileSync(bulletPath, 'utf-8');
        const bulletBase64 = Buffer.from(bulletContent, 'utf-8').toString('base64');
        const dataUrl = `data:image/svg+xml;base64,${bulletBase64}`;
        console.log('Bullet loaded successfully');
        return dataUrl;
      } catch (error) {
        console.error('Error loading bullet:', error);
        return '';
      }
    };

    const bulletDataUrl = loadBulletAsBase64();
    
    // Replace logo URL in HTML with base64 data URL
    // Need to escape quotes properly in the replacement
    if (logoDataUrl) {
      const beforeReplace = html.includes('/images/antrop_logo.svg');
      // Escape quotes in data URL for HTML attribute
      const escapedDataUrl = logoDataUrl.replace(/"/g, '&quot;');
      html = html.replace(
        /src="\/images\/antrop_logo\.svg"/g,
        `src="${escapedDataUrl}"`
      );
      const afterReplace = html.includes('data:image/svg+xml');
      console.log(`Logo replacement: ${beforeReplace ? 'found' : 'not found'} before, ${afterReplace ? 'replaced' : 'not replaced'} after`);
    } else {
      console.warn('Logo data URL is empty, logo will not be included in PDF');
    }

    // Replace bullet URL in HTML with base64 data URL
    // Replace both img src attributes AND CSS background-image URLs
    if (bulletDataUrl) {
      const escapedBulletUrl = bulletDataUrl.replace(/"/g, '&quot;');
      // Replace img src attributes
      html = html.replace(
        /src="\/images\/bullet\.svg"/g,
        `src="${escapedBulletUrl}"`
      );
      // Replace CSS background-image URLs (need to escape quotes differently for CSS)
      const cssEscapedBulletUrl = bulletDataUrl.replace(/'/g, "\\'");
      html = html.replace(
        /background-image:\s*url\(['"]\/images\/bullet\.svg['"]\)/g,
        `background-image: url('${cssEscapedBulletUrl}')`
      );
      console.log('Bullet replacement completed (both src and background-image)');
    } else {
      console.warn('Bullet data URL is empty, bullet points will not be included in PDF');
    }

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

      // Load HTML - use 'load' instead of 'networkidle0' to avoid timeout with base64 images
      await page.setContent(html, {
        waitUntil: 'load',
      });
      
      // Wait a bit for images to load if needed
      await new Promise(resolve => setTimeout(resolve, 500));

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
