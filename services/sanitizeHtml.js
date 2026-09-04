/**
 * sanitizeHtml.js
 *
 * Incoming email HTML is untrusted content from the open internet —
 * rendering it unsanitized in the admin panel would let any sender
 * run JavaScript in your admin's browser session. This strips:
 *   - <script> tags and inline event handlers (onclick, onerror, etc.)
 *   - <iframe>, <object>, <embed> (arbitrary content injection)
 *   - javascript: and data: URLs in href/src
 *   - <meta http-equiv="refresh"> (redirect tricks)
 *
 * Tracking pixels (1x1 images) are left alone by default — blocking
 * all remote images is a legitimate privacy choice too, toggle
 * BLOCK_REMOTE_IMAGES below if you want that instead.
 */

const sanitizeHtml = require('sanitize-html');

const BLOCK_REMOTE_IMAGES = false; // set true to strip all <img src="http...">

function sanitizeEmailHtml(rawHtml) {
  if (!rawHtml) return '';

  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'style', 'span', 'font', 'center', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'u',
    ]),
    allowedAttributes: {
      '*': ['style', 'class', 'align', 'width', 'height', 'colspan', 'rowspan'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      table: ['border', 'cellpadding', 'cellspacing'],
      font: ['color', 'face', 'size'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'cid'],
    allowedSchemesByTag: {
      img: BLOCK_REMOTE_IMAGES ? ['cid'] : ['http', 'https', 'cid'],
    },
    disallowedTagsMode: 'discard',
    exclusiveFilter: (frame) => frame.tag === 'meta' && frame.attribs['http-equiv'] === 'refresh',
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
      }),
    },
  });
}

module.exports = { sanitizeEmailHtml };
