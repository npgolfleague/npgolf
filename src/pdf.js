// PDF generation utility using Puppeteer
const puppeteer = require('puppeteer-core');
const fs = require('fs');

function resolveChromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;

  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome'
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found || '/usr/bin/chromium-browser';
}

/**
 * Generate a PDF from HTML content
 * @param {string} html - HTML content to convert to PDF
 * @param {object} options - PDF generation options
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePDF(html, options = {}) {
  // Use explicit path from env or common system Chromium locations.
  const executablePath = resolveChromiumPath();
  
  console.log(`Using Chromium at: ${executablePath}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  } catch (launchError) {
    console.error('Failed to launch Chromium:', launchError);
    throw new Error(`Chromium launch failed: ${launchError.message}`);
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfOptions = {
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.25in',
        right: '0.25in',
        bottom: '0.25in',
        left: '0.25in'
      },
      ...options
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    console.log(`PDF generated successfully: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (pdfError) {
    console.error('Error generating PDF:', pdfError);
    throw pdfError;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generatePDF };
