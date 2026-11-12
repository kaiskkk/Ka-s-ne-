// Thème visuel partagé par toutes les scènes (couleurs, police, textes nets).
// Fredoka est embarquée dans le jeu (voir main.js) : le rendu des textes est
// donc identique sur tous les appareils, iPhone compris, même hors ligne.
export const FONT = 'Fredoka, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

export const COLORS = {
  bg: 0x0b1020,
  panel: 0x151c33,
  panelLight: 0x202a4a,
  panelLine: 0x34406b,
  gold: 0xffd24a,
  white: 0xffffff,
  green: 0x5df27a,
  crystal: 0x7df9ff,
  crystalDark: 0x1aa6c4,
  super: 0xffd24a,
  fusion: 0xff7bf0,
};

/** 0xRRGGBB → '#rrggbb' */
export function hex(n) {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** Mélange deux couleurs 0xRRGGBB (t = 0 → a, t = 1 → b). */
export function mix(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/**
 * Crée un texte net quel que soit le zoom de la caméra.
 * opts : size, color, bold, align, wrap, stroke, strokeW, ox, oy, res, depth, alpha
 */
export function addText(scene, x, y, str, opts = {}) {
  const style = {
    fontFamily: FONT,
    fontSize: `${opts.size || 14}px`,
    fontStyle: opts.bold === false ? '500' : '700',
    color: opts.color || '#ffffff',
    align: opts.align || 'left',
    padding: { x: 2, y: 2 },
  };
  if (opts.wrap) style.wordWrap = { width: opts.wrap, useAdvancedWrap: true };
  if (opts.stroke) {
    style.stroke = opts.stroke;
    style.strokeThickness = opts.strokeW || 3;
  }
  if (opts.lineSpacing) style.lineSpacing = opts.lineSpacing;
  const t = scene.add.text(x, y, str, style);
  t.setResolution(opts.res || scene.textRes || 2);
  t.setOrigin(opts.ox ?? 0, opts.oy ?? 0);
  if (opts.depth != null) t.setDepth(opts.depth);
  if (opts.alpha != null) t.setAlpha(opts.alpha);
  return t;
}

/**
 * Rétrécit un texte s'il dépasse `maxWidth` (aucun chevauchement possible,
 * quelle que soit la langue ou la police).
 */
export function fitWidth(text, maxWidth) {
  text.setScale(1);
  if (text.width > maxWidth) text.setScale(maxWidth / text.width);
  return text;
}

/** Résolution de texte adaptée à un zoom de caméra (plafonnée pour la mémoire). */
export function textResFor(zoom) {
  return Math.min(4, Math.max(1, Math.ceil(zoom)));
}

/** « 1:07 » à partir d'un nombre de secondes. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
