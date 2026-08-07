/**
 * certificateRenderer.js
 *
 * Fills the HTML certificate template with real data + resolved
 * colors, then uses a single shared Puppeteer browser instance to
 * rasterize it to a print-ready landscape PDF.
 *
 * Reuses one browser across requests (launching Chromium per-request
 * is the #1 cause of slow/expensive certificate generation) — call
 * `closeBrowser()` on graceful shutdown if your process manager needs it.
 */

const fs = require('fs/promises');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { sanitizeConfig, toCssBackground, readableTextColor } = require('./colorEngine');

const TEMPLATE_PATH = path.join(__dirname, '../templates/certificate.hbs');

let templateSource = null;
let compiledTemplate = null;
let browserPromise = null;

async function getTemplate() {
  if (!compiledTemplate) {
    templateSource = await fs.readFile(TEMPLATE_PATH, 'utf8');
    compiledTemplate = Handlebars.compile(templateSource);
  }
  return compiledTemplate;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // needed in most container/CI environments
    });
  }
  return browserPromise;
}

async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

/**
 * @param {Object} certificate  A row from the `certificates` table
 *   (or the in-memory object right before insert, for a live preview).
 * @param {string} certificate.certificate_number
 * @param {string} certificate.recipient_name
 * @param {string} certificate.cert_type
 * @param {Object} certificate.fields         { eyebrow, title, presentedLine, bodyHtml, ... }
 * @param {Object} certificate.color_config    see colorEngine.js
 * @param {Array}  certificate.signatures      [{ name, designation, imageUrl }]
 * @param {string} certificate.qr_code_url
 * @param {string} certificate.issue_date      ISO date string
 * @returns {Promise<Buffer>} PDF bytes
 */
async function renderCertificatePdf(certificate) {
  const template = await getTemplate();
  const colorConfig = sanitizeConfig(certificate.color_config);
  const isGradient = colorConfig.type === 'gradient' && colorConfig.colors.length > 1;

  const gradientStops = colorConfig.colors.map((color, i) => ({
    color,
    offset: colorConfig.stops && colorConfig.stops[i] != null
      ? colorConfig.stops[i]
      : Math.round((i / Math.max(colorConfig.colors.length - 1, 1)) * 100),
  }));

  const html = template({
    isGradient,
    solidColor: colorConfig.colors[0],
    gradientStops,
    textColor: readableTextColor(colorConfig),
    logoTextColor: colorConfig.logoColor === 'white' ? '#FFFFFF' : colorConfig.logoColor === 'dark' ? '#0F172A' : readableTextColor(colorConfig),
    typeLabel: certificate.cert_type
      ? certificate.cert_type.charAt(0).toUpperCase() + certificate.cert_type.slice(1)
      : 'Certificate',
    recipientName: certificate.recipient_name,
    certificateNumber: certificate.certificate_number,
    issueDateFormatted: new Date(certificate.issue_date || Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
    qrCodeUrl: certificate.qr_code_url || '',
    qrCodeUrl: certificate.qr_code_url || '',
    signatures: certificate.signatures || [],
    fields: certificate.fields || {},
  });

  console.log('Got browser... setting content');
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1122, height: 793 });
    console.log('Waiting for networkidle0...');
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('Generating PDF buffer...');
    const pdfBuffer = await page.pdf({
      width: '1122px',
      height: '793px',
      printBackground: true,
      pageRanges: '1',
    });
    console.log('PDF generated successfully');
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

/** Same as above but returns a PNG (for the admin live-preview thumbnail). */
async function renderCertificatePng(certificate) {
  const template = await getTemplate();
  const colorConfig = sanitizeConfig(certificate.color_config);
  const isGradient = colorConfig.type === 'gradient' && colorConfig.colors.length > 1;
  const gradientStops = colorConfig.colors.map((color, i) => ({
    color,
    offset: Math.round((i / Math.max(colorConfig.colors.length - 1, 1)) * 100),
  }));

  const html = template({
    isGradient,
    solidColor: colorConfig.colors[0],
    gradientStops,
    textColor: readableTextColor(colorConfig),
    logoTextColor: colorConfig.logoColor === 'white' ? '#FFFFFF' : colorConfig.logoColor === 'dark' ? '#0F172A' : readableTextColor(colorConfig),
    typeLabel: certificate.cert_type || 'Certificate',
    recipientName: certificate.recipient_name || 'Recipient Name',
    certificateNumber: certificate.certificate_number || 'PREVIEW',
    issueDateFormatted: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    qrCodeUrl: certificate.qr_code_url || '',
    signatures: certificate.signatures || [],
    fields: certificate.fields || {},
  });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1122, height: 793 });
    await page.setContent(html, { waitUntil: 'networkidle2' });
    return await page.screenshot({ type: 'png' });
  } finally {
    await page.close();
  }
}

module.exports = { renderCertificatePdf, renderCertificatePng, closeBrowser };
