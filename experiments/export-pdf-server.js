const http = require('http');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set viewport to match slide dimensions
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1
  });
  
  // Load HTML
  await page.setContent(html, {
    waitUntil: 'networkidle0'
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
      left: '0'
    }
  });
  
  await browser.close();
  return pdfBuffer;
}

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve the HTML file
  if (req.method === 'GET' && req.url === '/') {
    const htmlPath = path.join(__dirname, 'test-slide.html');
    try {
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(htmlContent);
      return;
    } catch (error) {
      res.writeHead(404);
      res.end('HTML file not found');
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/export-pdf') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const { html } = JSON.parse(body);
        const pdfBuffer = await generatePdf(html);
        
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename=slide.pdf',
          'Content-Length': pdfBuffer.length
        });
        
        res.end(pdfBuffer);
      } catch (error) {
        console.error('Error generating PDF:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`PDF export server running on http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to view the test page`);
});

