// Dessin des formes géométriques des personnages et des cristaux
// (utilisé en jeu, dans le menu et sur l'écran de résultat).
import { TAU } from '../sim/mathx.js';

/** Points du polygone d'un personnage, orienté vers la droite (angle 0). */
export function characterPoints(shape, r) {
  switch (shape) {
    case 'triangle':
      return [
        [r * 1.28, 0],
        [-r * 0.85, -r],
        [-r * 0.85, r],
      ];
    case 'square': {
      const s = r * 0.9;
      return [
        [s, -s],
        [s, s],
        [-s, s],
        [-s, -s],
      ];
    }
    case 'diamond':
      return [
        [r * 1.3, 0],
        [0, -r * 0.9],
        [-r * 1.1, 0],
        [0, r * 0.9],
      ];
    case 'pentagon': {
      const pts = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        pts.push([Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12]);
      }
      return pts;
    }
    default:
      return null; // cercle
  }
}

function fillPoly(g, pts, scale = 1) {
  g.beginPath();
  g.moveTo(pts[0][0] * scale, pts[0][1] * scale);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * scale, pts[i][1] * scale);
  g.closePath();
  g.fillPath();
}

/**
 * Dessine un personnage centré en (0, 0) dans le Graphics `g`.
 * Le contour est un polygone légèrement plus grand (angles nets, sans trous).
 */
export function drawCharacter(g, shape, r, fill, outline, lineW = 3, light = 0xffffff) {
  const pts = characterPoints(shape, r);
  const k = (r + lineW * 1.25) / r;
  g.fillStyle(outline, 1);
  if (pts) fillPoly(g, pts, k);
  else g.fillCircle(0, 0, r + lineW);
  g.fillStyle(fill, 1);
  if (pts) fillPoly(g, pts, 1);
  else g.fillCircle(0, 0, r);
  // Reflet + « œil » à l'avant : indique la direction du regard
  g.fillStyle(light, 0.35);
  g.fillCircle(-r * 0.15, -r * 0.2, r * 0.38);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(r * 0.42, 0, r * 0.24);
  g.fillStyle(0x10131f, 1);
  g.fillCircle(r * 0.5, 0, r * 0.12);
}

/** Dessine un cristal (losange à facettes) centré en (0, 0). */
export function drawCrystal(g, size, color = 0x7df9ff, dark = 0x1aa6c4) {
  const w = size * 0.62;
  const h = size;
  g.fillStyle(0xffffff, 1);
  g.beginPath();
  g.moveTo(0, -h - 3);
  g.lineTo(w + 3, 0);
  g.lineTo(0, h + 3);
  g.lineTo(-w - 3, 0);
  g.closePath();
  g.fillPath();
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(0, -h);
  g.lineTo(w, 0);
  g.lineTo(0, h);
  g.lineTo(-w, 0);
  g.closePath();
  g.fillPath();
  g.fillStyle(dark, 1);
  g.beginPath();
  g.moveTo(0, -h);
  g.lineTo(w, 0);
  g.lineTo(0, h);
  g.closePath();
  g.fillPath();
  g.fillStyle(0xffffff, 0.7);
  g.beginPath();
  g.moveTo(0, -h * 0.8);
  g.lineTo(-w * 0.55, -h * 0.08);
  g.lineTo(0, -h * 0.2);
  g.closePath();
  g.fillPath();
}
