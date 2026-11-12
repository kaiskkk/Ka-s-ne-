// ─────────────────────────────────────────────────────────────
//  Dessin de l'arène : le sol (herbe, dallage, décorations), les murs de
//  pierre et les buissons sont peints UNE FOIS dans de grandes textures.
//  En match, le décor n'est donc plus qu'une image à afficher : c'est à la
//  fois plus beau et plus léger pour le téléphone.
// ─────────────────────────────────────────────────────────────
import { TILE } from '../config/constants.js';
import { TEAM_COLORS } from '../config/elements.js';
import { T_BUSH, T_FLOOR, T_WALL } from '../sim/Arena.js';
import { TAU, blob, circle, ellipse, line, linear, paint, radial, rgba, roundRect, seeded } from './canvas.js';

/** Pixels de texture par pixel monde pour le sol. */
export const GROUND_SCALE = 1.5;
const BUSH_SCALE = 2;
const BUSH_MARGIN = 14;

const P = {
  grassA: '#a6d06a',
  grassB: '#9bc85f',
  plaza: '#e0d3b6',
  plazaLine: 'rgba(120,98,66,0.38)',
  wallTop: '#dacfb9',
  wallTop2: '#c3b79e',
  wallFront: '#8f8470',
  wallLine: '#4d4538',
  rimTop: '#a39a87',
  rimTop2: '#8f8674',
  rimFront: '#5f574a',
  rimLine: '#3a342b',
  bushLine: '#1b5a31',
  bush: '#2f9f58',
  bushLight: '#5ccb7a',
  bushPale: '#93e6a5',
};

/**
 * Regroupe les cases d'un type en blocs rectangulaires (composantes connexes).
 * Renvoie [{ c, r, w, h, rect }] ; `rect` est faux si le groupe n'est pas un rectangle plein.
 */
function clusters(arena, type, skipBorder = true) {
  const { cols, rows } = arena;
  const seen = new Uint8Array(cols * rows);
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const border = c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
      if (seen[r * cols + c] || arena.tileType(c, r) !== type || (skipBorder && border)) continue;
      let c0 = c;
      let c1 = c;
      let r0 = r;
      let r1 = r;
      let count = 0;
      const stack = [[c, r]];
      seen[r * cols + c] = 1;
      while (stack.length) {
        const [x, y] = stack.pop();
        count += 1;
        c0 = Math.min(c0, x);
        c1 = Math.max(c1, x);
        r0 = Math.min(r0, y);
        r1 = Math.max(r1, y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 1 || ny < 1 || nx > cols - 2 || ny > rows - 2) continue;
          if (seen[ny * cols + nx] || arena.tileType(nx, ny) !== type) continue;
          seen[ny * cols + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      const w = c1 - c0 + 1;
      const h = r1 - r0 + 1;
      out.push({ c: c0, r: r0, w, h, rect: count === w * h });
    }
  }
  return out;
}

/** Bloc de pierre vu de trois quarts : face du dessus claire, face avant sombre. */
export function stoneBlock(ctx, x, y, w, h, colors, rnd, opts = {}) {
  const front = opts.front ?? 15;
  const rad = opts.radius ?? 12;
  // Corps (la face avant dépasse en bas)
  roundRect(ctx, x, y, w, h, rad);
  paint(ctx, colors.front, colors.line, 3);
  // Dessus
  roundRect(ctx, x, y, w, h - front, rad);
  paint(ctx, linear(ctx, 0, y, 0, y + h - front, [[0, colors.top], [1, colors.top2]]), colors.line, 2.6);
  // Joints entre les pierres
  ctx.save();
  roundRect(ctx, x + 2, y + 2, w - 4, h - front - 4, rad - 2);
  ctx.clip();
  for (let cx = x + TILE; cx < x + w - 4; cx += TILE) line(ctx, cx + (rnd() - 0.5) * 6, y, cx + (rnd() - 0.5) * 6, y + h, rgba(0x4d4538, 0.28), 2);
  for (let cy = y + TILE; cy < y + h - front - 4; cy += TILE) line(ctx, x, cy + (rnd() - 0.5) * 5, x + w, cy + (rnd() - 0.5) * 5, rgba(0x4d4538, 0.28), 2);
  // Mouchetures et fissures
  for (let i = 0; i < (w * h) / 900; i++) {
    circle(ctx, x + rnd() * w, y + rnd() * (h - front), 1 + rnd() * 1.8);
    paint(ctx, rgba(0x4d4538, 0.16 + rnd() * 0.12));
  }
  for (let i = 0; i < (w * h) / 5200; i++) {
    const px = x + 10 + rnd() * (w - 20);
    const py = y + 8 + rnd() * (h - front - 20);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 5 + rnd() * 5, py + 4 + rnd() * 4);
    ctx.lineTo(px + 3 + rnd() * 4, py + 10 + rnd() * 5);
    paint(ctx, null, rgba(0x4d4538, 0.45), 1.5);
  }
  // Reflet le long de l'arête du haut
  roundRect(ctx, x + 4, y + 4, w - 8, 7, 4);
  paint(ctx, 'rgba(255,255,255,0.33)');
  ctx.restore();
  // Touffes de mousse
  if (opts.moss !== false) {
    const n = Math.round((w / TILE) * 0.9);
    for (let i = 0; i < n; i++) {
      if (rnd() < 0.45) continue;
      const mx = x + 12 + rnd() * (w - 24);
      const my = rnd() < 0.5 ? y + 3 : y + h - front - 2;
      blob(ctx, [[mx - 9, my], [mx - 5, my - 6], [mx, my - 3], [mx + 5, my - 7], [mx + 10, my], [mx + 4, my + 4], [mx - 4, my + 4]]);
      paint(ctx, '#7cc04e', '#3f7a2a', 1.4);
    }
  }
}

function flower(ctx, x, y, color, rnd) {
  const n = 5;
  const rot = rnd() * TAU;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    circle(ctx, x + Math.cos(a) * 3.1, y + Math.sin(a) * 3.1, 2.3);
    paint(ctx, color);
  }
  circle(ctx, x, y, 1.9);
  paint(ctx, '#ffd24a');
}

/**
 * Peint le sol et les murs de l'arène dans la texture « ground ».
 */
export function buildGroundTexture(scene, arena) {
  if (scene.textures.exists('ground')) return;
  const S = GROUND_SCALE;
  const tex = scene.textures.createCanvas('ground', Math.ceil(arena.width * S), Math.ceil(arena.height * S));
  const ctx = tex.getContext();
  const rnd = seeded(20241);
  const { cols, rows, width, height } = arena;
  ctx.save();
  ctx.scale(S, S);

  // ── Herbe : damier doux ──
  ctx.fillStyle = P.grassA;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = P.grassB;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if ((c + r) % 2) ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
  }
  // Taches claires et sombres (l'herbe n'est jamais uniforme)
  for (let i = 0; i < 170; i++) {
    const x = rnd() * width;
    const y = rnd() * height;
    const rad = 40 + rnd() * 90;
    const dark = rnd() < 0.5;
    circle(ctx, x, y, rad);
    paint(ctx, radial(ctx, x, y, 0, rad, [[0, dark ? 'rgba(70,130,50,0.16)' : 'rgba(225,245,150,0.17)'], [1, 'rgba(0,0,0,0)']]));
  }
  // Brins d'herbe
  for (let i = 0; i < 900; i++) {
    const x = TILE + rnd() * (width - 2 * TILE);
    const y = TILE + rnd() * (height - 2 * TILE);
    const hgt = 4 + rnd() * 4;
    const col = rnd() < 0.5 ? 'rgba(70,140,60,0.5)' : 'rgba(215,240,140,0.55)';
    line(ctx, x, y, x - 2, y - hgt, col, 1.5);
    line(ctx, x, y, x + 2.5, y - hgt * 0.8, col, 1.5);
  }
  // Fleurs et cailloux (uniquement sur l'herbe)
  const onGrass = (x, y) => arena.tileType(Math.floor(x / TILE), Math.floor(y / TILE)) === T_FLOOR;
  for (let i = 0; i < 150; i++) {
    const x = TILE + rnd() * (width - 2 * TILE);
    const y = TILE + rnd() * (height - 2 * TILE);
    if (!onGrass(x, y)) continue;
    if (rnd() < 0.62) flower(ctx, x, y, ['#ffffff', '#ffe98a', '#ffb7d5', '#c9b6ff'][Math.floor(rnd() * 4)], rnd);
    else {
      ellipse(ctx, x, y, 4 + rnd() * 3, 3 + rnd() * 2, rnd());
      paint(ctx, '#b9b3a4', 'rgba(77,69,56,0.6)', 1.2);
    }
  }

  // ── Bases : dalles teintées aux couleurs des équipes ──
  for (let team = 0; team < 2; team++) {
    const col = TEAM_COLORS[team].main;
    const x = team === 0 ? TILE + 10 : width - 4 * TILE + 22;
    roundRect(ctx, x, 5 * TILE - 14, 3 * TILE - 32, 9 * TILE + 28, 26);
    paint(ctx, '#d5d2c6', 'rgba(77,69,56,0.45)', 3);
    roundRect(ctx, x, 5 * TILE - 14, 3 * TILE - 32, 9 * TILE + 28, 26);
    paint(ctx, rgba(col, 0.3));
    for (const s of arena.spawns[team]) {
      circle(ctx, s.x, s.y, 33);
      paint(ctx, rgba(col, 0.35), rgba(col, 0.95), 4);
      circle(ctx, s.x, s.y, 22);
      paint(ctx, null, 'rgba(255,255,255,0.55)', 2);
    }
  }

  // ── Place centrale dallée, avec son cercle de runes ──
  const cx = width / 2;
  const cy = height / 2;
  const R = TILE * 2.75;
  circle(ctx, cx, cy, R + 7);
  paint(ctx, 'rgba(60,100,45,0.35)');
  circle(ctx, cx, cy, R);
  paint(ctx, P.plaza, 'rgba(96,78,52,0.75)', 3.5);
  for (const k of [0.36, 0.68]) {
    circle(ctx, cx, cy, R * k);
    paint(ctx, null, P.plazaLine, 2);
  }
  // Dalles rayonnantes
  [[0.36, 0.68, 10], [0.68, 1, 16], [0.02, 0.36, 6]].forEach(([k0, k1, n], ring) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.2;
      line(ctx, cx + Math.cos(a) * R * k0, cy + Math.sin(a) * R * k0, cx + Math.cos(a) * R * k1, cy + Math.sin(a) * R * k1, P.plazaLine, 2);
    }
  });
  for (let i = 0; i < 60; i++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * R * 0.96;
    circle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + rnd() * 2.2);
    paint(ctx, 'rgba(120,98,66,0.22)');
  }
  // Cinq runes aux couleurs des éléments, gravées autour de la place
  ['feu', 'foudre', 'vent', 'eau', 'terre'].forEach((el, i) => {
    const a = -Math.PI / 2 + (i / 5) * TAU;
    const x = cx + Math.cos(a) * R * 0.84;
    const y = cy + Math.sin(a) * R * 0.84;
    const color = { feu: 0xff5533, foudre: 0xf0b400, vent: 0x2fbf98, eau: 0x2f9bff, terre: 0xb07a45 }[el];
    circle(ctx, x, y, 12);
    paint(ctx, rgba(color, 0.5), rgba(color, 0.95), 2.4);
    circle(ctx, x, y, 4.5);
    paint(ctx, 'rgba(255,255,255,0.8)');
  });

  // ── Rails des murs mobiles ──
  for (const m of arena.movers) {
    const horizontal = m.ay === m.by;
    const x0 = Math.min(m.ax, m.bx);
    const y0 = Math.min(m.ay, m.by);
    const w = Math.abs(m.bx - m.ax) + m.w;
    const h = Math.abs(m.by - m.ay) + m.h;
    const inset = horizontal ? (m.h - 30) / 2 : (m.w - 30) / 2;
    const rx = horizontal ? x0 + 6 : x0 + inset;
    const ry = horizontal ? y0 + inset : y0 + 6;
    const rw = horizontal ? w - 12 : 30;
    const rh = horizontal ? 30 : h - 12;
    roundRect(ctx, rx, ry, rw, rh, 12);
    paint(ctx, 'rgba(95,100,120,0.28)', 'rgba(60,62,80,0.35)', 2);
    const len = horizontal ? rw : rh;
    for (let d = 14; d < len - 8; d += 20) {
      if (horizontal) line(ctx, rx + d, ry + 6, rx + d, ry + rh - 6, 'rgba(230,235,250,0.4)', 3);
      else line(ctx, rx + 6, ry + d, rx + rw - 6, ry + d, 'rgba(230,235,250,0.4)', 3);
    }
  }

  // ── Socles des cristaux ──
  for (const p of arena.crystalSpawns) {
    circle(ctx, p.x, p.y + 3, 27);
    paint(ctx, 'rgba(40,50,60,0.3)');
    circle(ctx, p.x, p.y, 25);
    paint(ctx, linear(ctx, 0, p.y - 25, 0, p.y + 25, [[0, '#8f9aa8'], [1, '#5d6673']]), '#3b424d', 2.6);
    circle(ctx, p.x, p.y, 17);
    paint(ctx, 'rgba(125,249,255,0.3)', '#7df9ff', 2.4);
  }

  // ── Terre sombre sous les buissons (visible quand le feuillage s'estompe) ──
  for (const b of clusters(arena, T_BUSH)) {
    roundRect(ctx, b.c * TILE + 3, b.r * TILE + 6, b.w * TILE - 6, b.h * TILE - 6, 18);
    paint(ctx, 'rgba(50,105,45,0.6)');
  }

  // ── Murs : ombres portées, puis blocs de pierre ──
  const walls = clusters(arena, T_WALL);
  for (const b of walls) {
    roundRect(ctx, b.c * TILE + 7, b.r * TILE + 11, b.w * TILE, b.h * TILE, 14);
    paint(ctx, 'rgba(25,60,25,0.3)');
  }
  const wallColors = { top: P.wallTop, top2: P.wallTop2, front: P.wallFront, line: P.wallLine };
  for (const b of walls) {
    if (b.rect) stoneBlock(ctx, b.c * TILE, b.r * TILE, b.w * TILE, b.h * TILE, wallColors, rnd);
    else {
      // Forme non rectangulaire : une pierre par case
      for (let r = b.r; r < b.r + b.h; r++) {
        for (let c = b.c; c < b.c + b.w; c++) {
          if (arena.tileType(c, r) === T_WALL) stoneBlock(ctx, c * TILE, r * TILE, TILE, TILE, wallColors, rnd, { radius: 8 });
        }
      }
    }
  }

  // ── Mur d'enceinte ──
  const rim = { top: P.rimTop, top2: P.rimTop2, front: P.rimFront, line: P.rimLine };
  ctx.fillStyle = 'rgba(25,60,25,0.3)';
  ctx.fillRect(TILE, TILE, width - 2 * TILE, 12); // ombre du mur du haut
  ctx.fillRect(TILE, TILE, 8, height - 2 * TILE);
  stoneBlock(ctx, -20, -20, width + 40, TILE + 20, rim, rnd, { radius: 2, front: 16, moss: false }); // haut
  stoneBlock(ctx, -20, TILE - 2, TILE + 20, height - 2 * TILE + 4, rim, rnd, { radius: 2, front: 0, moss: false }); // gauche
  stoneBlock(ctx, width - TILE, TILE - 2, TILE + 20, height - 2 * TILE + 4, rim, rnd, { radius: 2, front: 0, moss: false }); // droite
  stoneBlock(ctx, -20, height - TILE, width + 40, TILE + 40, rim, rnd, { radius: 2, front: 0, moss: false }); // bas
  // Lierre sur le mur d'enceinte
  for (let i = 0; i < 46; i++) {
    const top = rnd() < 0.5;
    const x = TILE + rnd() * (width - 2 * TILE);
    const y = top ? TILE - 16 - rnd() * 10 : height - TILE + 4 + rnd() * 8;
    blob(ctx, [[x - 11, y], [x - 5, y - 7], [x, y - 3], [x + 6, y - 8], [x + 12, y], [x + 4, y + 5], [x - 5, y + 5]]);
    paint(ctx, '#6fb24a', '#3a6f28', 1.4);
  }

  ctx.restore();
  tex.refresh();
}

/**
 * Peint un massif de buissons par groupe de cases. Renvoie la liste des
 * massifs : [{ key, x, y (centre, en pixels monde), c, r, w, h }].
 */
export function buildBushTextures(scene, arena) {
  const list = [];
  const rnd = seeded(7331);
  clusters(arena, T_BUSH).forEach((b, i) => {
    const key = `bush_${i}`;
    const w = b.w * TILE + BUSH_MARGIN * 2;
    const h = b.h * TILE + BUSH_MARGIN * 2;
    list.push({ key, x: (b.c + b.w / 2) * TILE, y: (b.r + b.h / 2) * TILE, c: b.c, r: b.r, w: b.w, h: b.h, scale: 1 / BUSH_SCALE });
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, Math.ceil(w * BUSH_SCALE), Math.ceil(h * BUSH_SCALE));
    const ctx = tex.getContext();
    ctx.save();
    ctx.scale(BUSH_SCALE, BUSH_SCALE);
    ctx.translate(BUSH_MARGIN, BUSH_MARGIN);
    // Boules de feuillage : une grille de cercles légèrement décalés
    const balls = [];
    for (let r = 0; r < b.h; r++) {
      for (let c = 0; c < b.w; c++) {
        if (arena.tileType(b.c + c, b.r + r) !== T_BUSH) continue;
        for (const [ox, oy] of [[0.27, 0.3], [0.73, 0.28], [0.5, 0.52], [0.26, 0.74], [0.74, 0.72]]) {
          balls.push([(c + ox) * TILE + (rnd() - 0.5) * 7, (r + oy) * TILE + (rnd() - 0.5) * 7, 21 + rnd() * 5]);
        }
      }
    }
    balls.sort((p, q) => p[1] - q[1]);
    for (const [x, y, rad] of balls) {
      circle(ctx, x, y + 3, rad + 3.2);
      paint(ctx, P.bushLine);
    }
    for (const [x, y, rad] of balls) {
      circle(ctx, x, y, rad);
      paint(ctx, radial(ctx, x - rad * 0.3, y - rad * 0.35, rad * 0.1, rad * 1.1, [[0, P.bushLight], [0.7, P.bush], [1, '#278a4b']]));
    }
    for (const [x, y, rad] of balls) {
      // Reflets et petites feuilles
      c2(ctx, x - rad * 0.35, y - rad * 0.4, rad * 0.26, P.bushPale, 0.75);
      c2(ctx, x + rad * 0.3, y + rad * 0.2, rad * 0.13, P.bushPale, 0.5);
      if (rnd() < 0.3) c2(ctx, x + (rnd() - 0.5) * rad, y + (rnd() - 0.5) * rad, 2.6, ['#ff6b8a', '#ffd24a', '#ffffff'][Math.floor(rnd() * 3)], 1);
    }
    ctx.restore();
    tex.refresh();
  });
  return list;
}

function c2(ctx, x, y, r, color, alpha) {
  ctx.globalAlpha = alpha;
  circle(ctx, x, y, r);
  paint(ctx, color);
  ctx.globalAlpha = 1;
}

/** Bloc de mur mobile (pierre runique violette), horizontal ou vertical. */
export function buildMoverTextures(scene, arena) {
  const rnd = seeded(99);
  const colors = { top: '#b7b0f5', top2: '#948be0', front: '#5b52a8', line: '#2e2866' };
  const done = new Set();
  for (const m of arena.movers) {
    const key = `mover_${m.w}x${m.h}`;
    if (done.has(key) || scene.textures.exists(key)) continue;
    done.add(key);
    const S = 2;
    const tex = scene.textures.createCanvas(key, (m.w + 8) * S, (m.h + 8) * S);
    const ctx = tex.getContext();
    ctx.save();
    ctx.scale(S, S);
    ctx.translate(4, 4);
    stoneBlock(ctx, 0, 0, m.w, m.h, colors, rnd, { moss: false, radius: 12 });
    // Chevrons lumineux
    const horizontal = m.w > m.h;
    const mx = m.w / 2;
    const my = (m.h - 15) / 2;
    ctx.beginPath();
    for (const off of [-11, 0, 11]) {
      if (horizontal) {
        ctx.moveTo(mx + off - 5, my - 9);
        ctx.lineTo(mx + off + 5, my);
        ctx.lineTo(mx + off - 5, my + 9);
      } else {
        ctx.moveTo(mx - 9, my + off - 5);
        ctx.lineTo(mx, my + off + 5);
        ctx.lineTo(mx + 9, my + off - 5);
      }
    }
    paint(ctx, null, 'rgba(255,255,255,0.9)', 3.4);
    ctx.restore();
    tex.refresh();
  }
}
