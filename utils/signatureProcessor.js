/**
 * signatureProcessor.js
 *
 * Isolates a handwritten signature from a photographed/scanned page.
 *
 * NOTE ON TECHNIQUE: this deliberately does NOT use OCR. OCR reads
 * printed/handwritten *text into characters* — it has no concept of
 * "this group of pixels is ink, this group is paper," so it cannot
 * produce a cutout image. What actually solves this is per-pixel
 * luminance thresholding: pen ink is dark, paper is light, so any
 * pixel above a brightness threshold is treated as background and
 * made fully transparent; everything else is kept and its opacity is
 * scaled by how dark it is, so anti-aliased pen edges stay smooth
 * instead of getting a jagged cutout line. The result is then
 * auto-cropped to the bounding box of the remaining ink.
 *
 * This works well for the common case: a signature in dark ink on
 * plain white/light paper, reasonably well lit. Very low-contrast
 * photos (pencil, colored paper, heavy shadow) may need a higher
 * `threshold` — that's exposed as a parameter so the admin UI can
 * offer a "sensitivity" slider and let the user retry rather than
 * silently failing.
 */

const sharp = require('sharp');

/**
 * @param {Buffer} inputBuffer   Raw uploaded image bytes (jpg/png/webp).
 * @param {Object} options
 * @param {number} options.threshold  0-255. Pixels with luminance >= this
 *                                    are treated as background paper.
 *                                    Default 200 works for a typical phone
 *                                    photo of ink-on-white-paper.
 * @param {[number,number,number]|null} options.inkColor
 *                                    If provided (e.g. [15,23,42] for the
 *                                    brand ink color), recolors the kept
 *                                    ink to this RGB instead of leaving the
 *                                    original (often slightly blue/black-
 *                                    mixed) pen color.
 * @returns {Promise<{buffer: Buffer, width: number, height: number}>}
 *          A transparent PNG containing only the cropped signature.
 */
async function processSignature(inputBuffer, options = {}) {
  const inkColor = options.inkColor || null;

  const { data, info } = await sharp(inputBuffer)
    .rotate() // respect EXIF orientation from phone cameras
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels === 4 after ensureAlpha
  const out = Buffer.from(data); // mutable working copy

  // 1. Calculate luminance histogram for Otsu's method
  const histogram = new Array(256).fill(0);
  const totalPixels = width * height;
  
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    histogram[luminance]++;
  }

  // 2. Otsu's method to find optimal threshold
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  
  let sumB = 0, wB = 0, wF = 0, varMax = 0, otsuThreshold = 0;
  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) {
      varMax = varBetween;
      otsuThreshold = i;
    }
  }

  // Use a slightly more aggressive threshold to ensure background shadows are dropped
  const threshold = otsuThreshold * 0.9;

  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

      if (luminance >= threshold) {
        // Paper / background — drop it entirely.
        out[idx + 3] = 0;
        continue;
      }

      // Ink — keep, with opacity scaling linearly from the threshold.
      // This means a pixel just slightly darker than the threshold is almost transparent.
      const darkness = threshold - luminance;
      // We assume ink is at least ~40% darker than the threshold to be fully opaque.
      const alpha = Math.min(255, Math.round((darkness / (threshold * 0.4)) * 255));
      out[idx + 3] = alpha;

      // Force a dark ink color to completely eliminate grey/white paper fringing.
      const color = inkColor || [15, 23, 42]; // deep blue/black
      out[idx] = color[0];
      out[idx + 1] = color[1];
      out[idx + 2] = color[2];

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    const err = new Error(
      'No ink detected at this sensitivity. Try a higher-contrast photo, ' +
      'or lower the threshold and retry.'
    );
    err.code = 'NO_SIGNATURE_DETECTED';
    throw err;
  }

  const pad = 14;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width - cropX, maxX - minX + pad * 2);
  const cropH = Math.min(height - cropY, maxY - minY + pad * 2);

  const buffer = await sharp(out, { raw: { width, height, channels } })
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { buffer, width: cropW, height: cropH };
}

module.exports = { processSignature };
