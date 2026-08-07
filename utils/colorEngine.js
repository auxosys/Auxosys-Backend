/**
 * colorEngine.js
 *
 * Turns a color_config JSON blob into a CSS background value.
 * This is intentionally framework-agnostic (no DB/HTTP here) so the
 * exact same function can be copy-pasted into the admin frontend for
 * a live preview that matches the server-rendered PDF pixel-for-pixel.
 *
 * Supported shapes:
 *
 *   { type: "solid", colors: ["#14B8A6"] }
 *
 *   { type: "gradient", mode: "linear", angle: 135,
 *     colors: ["#14B8A6", "#0C8074"] }            // 2-color
 *
 *   { type: "gradient", mode: "linear", angle: 120,
 *     colors: ["#14B8A6", "#0EA5E9", "#8B5CF6"] } // 3-color
 *
 *   { type: "gradient", mode: "radial",
 *     colors: ["#FDE68A", "#FB923C", "#EF4444", "#0F172A"] } // 4-color
 *
 * Any number of colors >= 1 is accepted; stops are spread evenly
 * unless explicit `stops` (0-100) are provided per color.
 */

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function isValidColor(c) {
  return typeof c === 'string' && (HEX_RE.test(c) || /^rgba?\(/i.test(c) || /^hsla?\(/i.test(c));
}

function sanitizeConfig(config) {
  if (!config || typeof config !== 'object') {
    return { type: 'solid', colors: ['#14B8A6'] };
  }

  const colors = Array.isArray(config.colors) ? config.colors.filter(isValidColor) : [];
  if (colors.length === 0) colors.push('#14B8A6');

  return {
    type: config.type === 'gradient' ? 'gradient' : 'solid',
    mode: config.mode === 'radial' ? 'radial' : 'linear',
    angle: Number.isFinite(config.angle) ? ((config.angle % 360) + 360) % 360 : 135,
    colors: colors.slice(0, 6), // hard cap — beyond ~4-6 stops a "certificate panel" stops reading as a color, just noise
    stops: Array.isArray(config.stops) ? config.stops : null,
    logoColor: ['auto', 'white', 'dark'].includes(config.logoColor) ? config.logoColor : 'auto',
  };
}

/** Returns a CSS `background` value string. */
function toCssBackground(config) {
  const c = sanitizeConfig(config);

  if (c.type === 'solid' || c.colors.length === 1) {
    return c.colors[0];
  }

  const stopList = c.colors
    .map((color, i) => {
      const pct = c.stops && c.stops[i] != null
        ? c.stops[i]
        : Math.round((i / (c.colors.length - 1)) * 100);
      return `${color} ${pct}%`;
    })
    .join(', ');

  return c.mode === 'radial'
    ? `radial-gradient(circle at 30% 20%, ${stopList})`
    : `linear-gradient(${c.angle}deg, ${stopList})`;
}

/**
 * Decide whether panel text/logo should render light or dark,
 * based on the perceived luminance of the *first* color in the
 * config. Good enough heuristic for a 1-6 color panel background —
 * avoids "white text on a pale yellow panel" type mistakes.
 */
function readableTextColor(config) {
  const c = sanitizeConfig(config);
  const hex = c.colors[0].replace('#', '');
  if (hex.length !== 6 && hex.length !== 3) return '#FFFFFF';
  const full = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0F172A' : '#FFFFFF';
}

const PRESETS = {
  auxosys_teal:  { type: 'solid', colors: ['#14B8A6'] },
  auxosys_ink:   { type: 'solid', colors: ['#0F172A'] },
  auxosys_soft:  { type: 'solid', colors: ['#EAFAF7'] },
  ocean:         { type: 'gradient', mode: 'linear', angle: 135, colors: ['#0EA5E9', '#14B8A6'] },
  sunset:        { type: 'gradient', mode: 'linear', angle: 120, colors: ['#F97316', '#EF4444', '#EC4899'] },
  royal:         { type: 'gradient', mode: 'linear', angle: 135, colors: ['#4C1D95', '#7C3AED', '#0EA5E9'] },
  gold:          { type: 'gradient', mode: 'linear', angle: 135, colors: ['#B8860B', '#F0C64C', '#B8860B'] },
  midnight:      { type: 'gradient', mode: 'radial', colors: ['#1E293B', '#0F172A', '#020617', '#14B8A6'] },
};

module.exports = { sanitizeConfig, toCssBackground, readableTextColor, PRESETS };
