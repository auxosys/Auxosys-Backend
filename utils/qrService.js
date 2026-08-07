/**
 * qrService.js
 *
 * Generates a unique QR code per certificate, pointing at
 * https://auxosys.com/verify/{certificate_id}?t={verification_token}
 *
 * The token (a random opaque string, not the row id alone) is
 * included so a certificate can't be "guessed" by iterating IDs —
 * the verify endpoint checks both the id AND the token match.
 */

const QRCode = require('qrcode');
const { uploadToStorage } = require('./supabaseClient');

const VERIFY_SITE_URL = process.env.VERIFY_SITE_URL || 'https://verify.auxosys.com';

function buildVerifyUrl(certificateId, verificationToken) {
  // If running locally, we fallback to the normal verify path, else use the clean subdomain
  if (VERIFY_SITE_URL.includes('localhost')) {
    return `${VERIFY_SITE_URL}/verify/${certificateId}?t=${verificationToken}`;
  }
  return `${VERIFY_SITE_URL}/${certificateId}?t=${verificationToken}`;
}

/**
 * @returns {Promise<{ url: string, publicVerifyUrl: string }>}
 *          url            — the hosted PNG of the QR code
 *          publicVerifyUrl — the URL the QR encodes (also stored on
 *                            the certificate row for display/copy)
 */
async function generateAndStoreQr(certificateId, verificationToken) {
  const publicVerifyUrl = buildVerifyUrl(certificateId, verificationToken);

  const pngBuffer = await QRCode.toBuffer(publicVerifyUrl, {
    type: 'png',
    errorCorrectionLevel: 'H', // high — still scannable if a logo is overlaid later or corner is damaged in print
    margin: 1,
    scale: 10,
    color: { dark: '#0F172A', light: '#FFFFFF00' }, // transparent background so it drops onto the certificate cleanly
  });

  const url = await uploadToStorage(
    `qr/${certificateId}.png`,
    pngBuffer,
    'image/png'
  );

  return { url, publicVerifyUrl };
}

module.exports = { generateAndStoreQr, buildVerifyUrl };
