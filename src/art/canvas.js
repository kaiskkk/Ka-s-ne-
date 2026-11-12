// ─────────────────────────────────────────────────────────────
//  Outils de dessin : tous les visuels d'ÉLÉMENTA sont DESSINÉS PAR LE CODE
//  (Canvas 2D) au démarrage, puis rangés dans des « atlas » de textures.
//  Aucun fichier image : tout est original et le jeu reste très léger.
// ─────────────────────────────────────────────────────────────

export const TAU = Math.PI * 2;

/** 0xRRGGBB → 'rgba(r,g,b,a)' */
export function rgba(hex, a = 1) {
  return `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
}

/** Éclaircit (t > 0) ou assombrit (t < 0) une couleur 0xRRGGBB ; renvoie une chaîne CSS. */
export function tone(hex, t, a = 1) {
  const target = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  const r = Math.round(((hex >> 16) & 255) * (1 - k) + target * k);
  const g = Math.round(((hex >> 8) & 255) * (1 - k) + target * k);
  const b = Math.round((hex & 255) * (1 - k) + target * k);
  return `rgba(${r},${g},${b},${a})`;
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Polygone fermé à partir de [[x, y], …]. */
export function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Forme fermée lissée passant près des points (courbes quadratiques). */
export function blob(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

/** Étoile à n branches centrée en (0, 0). */
export function star(ctx, n, rOuter, rInner, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rInner : rOuter;
    const a = rot + (i / (n * 2)) * TAU;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Remplit puis trace le chemin courant (contour arrondi façon dessin animé). */
export function paint(ctx, fill, stroke, lineWidth = 2) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

export function line(ctx, x0, y0, x1, y1, color, width = 2) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

export function radial(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

/** Générateur pseudo-aléatoire déterministe (détails décoratifs toujours identiques). */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Atlas : une grande texture découpée en images nommées.
 * `scale` = pixels de texture par pixel « monde » (netteté sur écran Retina).
 */
export class Atlas {
  constructor(scene, key, width, height, scale) {
    this.key = key;
    this.scale = scale;
    this.tex = scene.textures.createCanvas(key, width, height);
    this.ctx = this.tex.getContext();
    this.x = 2;
    this.y = 2;
    this.rowH = 0;
  }

  /**
   * Ajoute une image de w × h (unités monde). `draw(ctx)` dessine avec
   * l'origine au CENTRE de l'image, 1 unité = 1 pixel monde.
   */
  add(name, w, h, draw) {
    const pw = Math.ceil(w * this.scale);
    const ph = Math.ceil(h * this.scale);
    const pad = 3;
    if (this.x + pw + pad > this.tex.width) {
      this.x = 2;
      this.y += this.rowH + pad;
      this.rowH = 0;
    }
    if (this.y + ph > this.tex.height) throw new Error(`Atlas « ${this.key} » trop petit pour « ${name} »`);
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x, this.y, pw, ph);
    ctx.clip(); // rien ne déborde sur l'image voisine
    ctx.translate(this.x + pw / 2, this.y + ph / 2);
    ctx.scale(this.scale, this.scale);
    draw(ctx, w, h);
    ctx.restore();
    this.tex.add(name, 0, this.x, this.y, pw, ph);
    this.x += pw + pad;
    this.rowH = Math.max(this.rowH, ph);
    return this;
  }

  done() {
    this.tex.refresh();
  }
}
