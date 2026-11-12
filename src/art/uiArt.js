// ─────────────────────────────────────────────────────────────
//  Atlas « ui » : icônes des menus (pièce, gemme, trophée, coffres,
//  boutique, pass…), dessinées par le code comme tout le reste.
// ─────────────────────────────────────────────────────────────
import { Atlas, TAU, blob, circle, ellipse, line, linear, paint, poly, radial, roundRect, star } from './canvas.js';

export const UI_SCALE = 3;
/** Taille (px de texture) des icônes carrées de l'atlas : 48 unités × 3. */
export const ICON_PX = 144;

const LINE = '#0f1326';

/** Couleurs des trois coffres. */
const CHEST_COLORS = {
  eveil: { body: '#c98a4a', dark: '#8a5626', metal: '#f0d48a', metalDark: '#9a7a2a', glow: '#fff3a0' },
  maree: { body: '#5aa2e8', dark: '#2a62a8', metal: '#eef3fb', metalDark: '#7a8aa8', glow: '#bfe9ff' },
  fusion: { body: '#a866f0', dark: '#5f2aa8', metal: '#ffd84a', metalDark: '#a87a00', glow: '#ffc8fb' },
};

function drawChest(c, col, open, kind) {
  ellipse(c, 0, 25, 27, 5);
  paint(c, 'rgba(0,0,0,0.28)');
  if (open) {
    // Couvercle relevé, vu de l'intérieur
    poly(c, [[-24, -4], [-21, -27], [21, -27], [24, -4]]);
    paint(c, col.dark, LINE, 2.4);
    poly(c, [[-19, -7], [-17, -23], [17, -23], [19, -7]]);
    paint(c, 'rgba(0,0,0,0.3)');
    // Lumière qui jaillit
    ellipse(c, 0, -5, 24, 13);
    paint(c, radial(c, 0, -5, 0, 24, [[0, '#ffffff'], [0.45, col.glow], [1, 'rgba(255,255,255,0)']]));
  }
  // Caisse
  roundRect(c, -24, -3, 48, 27, 5);
  paint(c, linear(c, 0, -3, 0, 24, [[0, col.body], [1, col.dark]]), LINE, 2.4);
  for (const x of [-18, 13]) {
    roundRect(c, x, -3, 5.5, 27, 1.5);
    paint(c, col.metal, col.metalDark, 1.2);
  }
  if (!open) {
    // Couvercle bombé
    c.beginPath();
    c.moveTo(-25.5, -2);
    c.quadraticCurveTo(-25.5, -25, 0, -25);
    c.quadraticCurveTo(25.5, -25, 25.5, -2);
    c.closePath();
    paint(c, linear(c, 0, -25, 0, -2, [[0, '#ffffff'], [0.18, col.body], [1, col.dark]]), LINE, 2.4);
    for (const x of [-18, 13]) {
      c.beginPath();
      c.moveTo(x, -3);
      c.quadraticCurveTo(x + (x < 0 ? 1 : -1), -20, x + 2.8, -23.5);
      c.lineTo(x + 5.5, -23.5);
      c.lineTo(x + 5.5, -3);
      c.closePath();
      paint(c, col.metal, col.metalDark, 1.2);
    }
    roundRect(c, -25.5, -5, 51, 4.5, 2);
    paint(c, col.metal, col.metalDark, 1.2);
  }
  // Serrure
  const ly = open ? 4 : -9;
  roundRect(c, -7, ly, 14, 15, 3.5);
  paint(c, col.metal, col.metalDark, 1.6);
  if (kind === 'fusion') {
    poly(c, [[0, ly + 2], [4.5, ly + 7.5], [0, ly + 13], [-4.5, ly + 7.5]]);
    paint(c, '#7df9ff', '#0f7f9a', 1.2);
  } else if (kind === 'maree') {
    c.beginPath();
    c.moveTo(-4.5, ly + 8);
    c.quadraticCurveTo(-2.2, ly + 4, 0, ly + 8);
    c.quadraticCurveTo(2.2, ly + 12, 4.5, ly + 8);
    paint(c, null, '#2a62a8', 2);
  } else {
    circle(c, 0, ly + 6, 2.3);
    paint(c, LINE);
    roundRect(c, -1.1, ly + 6, 2.2, 5, 1);
    paint(c, LINE);
  }
}

export function buildUiAtlas(scene) {
  if (scene.textures.exists('ui')) return;
  const a = new Atlas(scene, 'ui', 1024, 1024, UI_SCALE);
  const icon = (name, draw) => a.add(name, 48, 48, draw);

  // ── Monnaies et récompenses ──
  icon('coin', (c) => {
    circle(c, 0, 1.5, 19);
    paint(c, '#9a6200', LINE, 2.4);
    circle(c, 0, -1, 19);
    paint(c, linear(c, 0, -20, 0, 18, [[0, '#fff0a0'], [0.5, '#ffcf3a'], [1, '#f0a01a']]), LINE, 2.4);
    circle(c, 0, -1, 13.5);
    paint(c, null, '#d98a10', 2.2);
    poly(c, [[0, -10], [6.5, -1], [0, 8], [-6.5, -1]]);
    paint(c, '#fff6c8', '#c98200', 1.6);
    c.beginPath();
    c.arc(0, -1, 16, 1.15 * Math.PI, 1.55 * Math.PI);
    paint(c, null, 'rgba(255,255,255,0.8)', 2.4);
  });
  icon('gem', (c) => {
    poly(c, [[0, -19], [16, -8], [16, 6], [0, 19], [-16, 6], [-16, -8]]);
    paint(c, '#ff5fd0', LINE, 2.6);
    poly(c, [[0, -19], [16, -8], [0, -1], [-16, -8]]);
    paint(c, '#ffb0ee');
    poly(c, [[16, -8], [16, 6], [0, 19], [0, -1]]);
    paint(c, '#c22aa6');
    poly(c, [[-16, -8], [0, -1], [0, 19], [-16, 6]]);
    paint(c, '#f04ac4');
    poly(c, [[0, -19], [16, -8], [16, 6], [0, 19], [-16, 6], [-16, -8]]);
    paint(c, null, LINE, 2.6);
    poly(c, [[-9, -9], [-2, -13], [-4, -6]]);
    paint(c, 'rgba(255,255,255,0.9)');
  });
  icon('trophy', (c) => {
    // Anses
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(s * 13, -8, 6.5, -Math.PI / 2, Math.PI / 2, s < 0);
      paint(c, null, LINE, 6.4);
      c.beginPath();
      c.arc(s * 13, -8, 6.5, -Math.PI / 2, Math.PI / 2, s < 0);
      paint(c, null, '#ffc21f', 2.8);
    }
    // Pied
    roundRect(c, -3.5, 4, 7, 10, 1.5);
    paint(c, '#e09a10', LINE, 2);
    roundRect(c, -11, 12, 22, 7, 3);
    paint(c, linear(c, 0, 12, 0, 19, [[0, '#ffe27a'], [1, '#e09a10']]), LINE, 2.2);
    // Coupe
    c.beginPath();
    c.moveTo(-14, -18);
    c.lineTo(14, -18);
    c.quadraticCurveTo(14, 5, 0, 7);
    c.quadraticCurveTo(-14, 5, -14, -18);
    c.closePath();
    paint(c, linear(c, -14, 0, 14, 0, [[0, '#fff0a0'], [0.5, '#ffcf3a'], [1, '#f0a01a']]), LINE, 2.4);
    c.save();
    c.translate(0, -7);
    star(c, 5, 6.5, 2.8);
    paint(c, '#fff8d8', '#c98200', 1.2);
    c.restore();
  });
  icon('xp', (c) => {
    star(c, 5, 20, 9.5);
    paint(c, linear(c, 0, -20, 0, 20, [[0, '#9fe0ff'], [1, '#3a8bff']]), LINE, 2.6);
    star(c, 5, 10, 4.6);
    paint(c, 'rgba(255,255,255,0.55)');
  });
  icon('season', (c) => {
    // Point de saison : médaille violette
    circle(c, 0, 0, 18);
    paint(c, linear(c, 0, -18, 0, 18, [[0, '#d7a8ff'], [1, '#8a4ddb']]), LINE, 2.6);
    circle(c, 0, 0, 12.5);
    paint(c, null, 'rgba(255,255,255,0.5)', 2);
    star(c, 4, 9, 3.4);
    paint(c, '#ffffff');
  });

  // ── Coffres (fermé / ouvert) ──
  for (const kind of Object.keys(CHEST_COLORS)) {
    a.add(`chest_${kind}`, 64, 62, (c) => drawChest(c, CHEST_COLORS[kind], false, kind));
    a.add(`chest_${kind}_open`, 64, 62, (c) => drawChest(c, CHEST_COLORS[kind], true, kind));
  }

  // ── Icônes des boutons ──
  icon('shop', (c) => {
    // Sac avec un cristal
    c.beginPath();
    c.arc(0, -10, 8, Math.PI, 0);
    paint(c, null, LINE, 6);
    c.beginPath();
    c.arc(0, -10, 8, Math.PI, 0);
    paint(c, null, '#ffd24a', 2.6);
    roundRect(c, -15, -10, 30, 28, 6);
    paint(c, linear(c, 0, -10, 0, 18, [[0, '#ff8a6a'], [1, '#e0364a']]), LINE, 2.6);
    poly(c, [[0, -4], [6, 4], [0, 12], [-6, 4]]);
    paint(c, '#ffffff', '#7a1422', 1.4);
  });
  icon('chars', (c) => {
    // Deux silhouettes
    for (const [x, y, k, col] of [[8, -2, 0.85, '#7fb8ff'], [-5, 2, 1, '#ffd24a']]) {
      blob(c, [[x - 12 * k, y + 18 * k], [x - 11 * k, y + 5 * k], [x, y + 2 * k], [x + 11 * k, y + 5 * k], [x + 12 * k, y + 18 * k]]);
      paint(c, col, LINE, 2.4);
      circle(c, x, y - 6 * k, 8.5 * k);
      paint(c, col, LINE, 2.4);
    }
    for (const s of [-1, 1]) {
      circle(c, -5 + s * 3.2, -4.5, 1.7);
      paint(c, LINE);
    }
  });
  icon('pass', (c) => {
    // Billet à encoches
    c.beginPath();
    c.moveTo(-19, -11);
    c.lineTo(19, -11);
    c.lineTo(19, -4);
    c.arc(19, 0, 4, -Math.PI / 2, Math.PI / 2, true);
    c.lineTo(19, 11);
    c.lineTo(-19, 11);
    c.lineTo(-19, 4);
    c.arc(-19, 0, 4, Math.PI / 2, -Math.PI / 2, true);
    c.closePath();
    paint(c, linear(c, 0, -11, 0, 11, [[0, '#d7a8ff'], [1, '#8a4ddb']]), LINE, 2.6);
    star(c, 5, 7.5, 3.2);
    paint(c, '#ffe14d', '#7a4a00', 1.2);
  });
  icon('ranks', (c) => {
    // Podium
    for (const [x, h, col] of [[-13, 12, '#c9cfe0'], [0, 20, '#ffd24a'], [13, 8, '#e0a070']]) {
      roundRect(c, x - 6.5, 16 - h, 13, h, 2.5);
      paint(c, col, LINE, 2.4);
    }
    c.save();
    c.translate(0, -12);
    star(c, 5, 7, 3);
    paint(c, '#ffe14d', LINE, 1.6);
    c.restore();
  });
  icon('gear', (c) => {
    c.beginPath();
    const teeth = 8;
    for (let i = 0; i < teeth * 2; i++) {
      const r = i % 2 ? 13.5 : 19;
      const a0 = (i / (teeth * 2)) * TAU - 0.13;
      const a1 = ((i + 1) / (teeth * 2)) * TAU - 0.13;
      c.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      c.lineTo(Math.cos(a1 - 0.14) * r, Math.sin(a1 - 0.14) * r);
    }
    c.closePath();
    paint(c, '#dfe6ff', LINE, 2.4);
    circle(c, 0, 0, 6.5);
    paint(c, '#3a4670', LINE, 2.2);
  });
  icon('back', (c) => {
    c.beginPath();
    c.moveTo(7, -13);
    c.lineTo(-7, 0);
    c.lineTo(7, 13);
    paint(c, null, LINE, 11);
    c.beginPath();
    c.moveTo(7, -13);
    c.lineTo(-7, 0);
    c.lineTo(7, 13);
    paint(c, null, '#ffffff', 6);
  });
  icon('lock', (c) => {
    c.beginPath();
    c.arc(0, -6, 8, Math.PI, 0);
    paint(c, null, LINE, 7);
    c.beginPath();
    c.arc(0, -6, 8, Math.PI, 0);
    paint(c, null, '#c9cfe0', 3);
    roundRect(c, -12, -6, 24, 21, 5);
    paint(c, linear(c, 0, -6, 0, 15, [[0, '#aab3cc'], [1, '#6b7594']]), LINE, 2.4);
    circle(c, 0, 2.5, 3);
    paint(c, LINE);
    roundRect(c, -1.3, 2.5, 2.6, 7, 1);
    paint(c, LINE);
  });
  icon('check', (c) => {
    circle(c, 0, 0, 18);
    paint(c, linear(c, 0, -18, 0, 18, [[0, '#8ff07a'], [1, '#35b04a']]), LINE, 2.6);
    c.beginPath();
    c.moveTo(-9, 0);
    c.lineTo(-2.5, 7);
    c.lineTo(10, -7);
    paint(c, null, '#0f4a1a', 7.5);
    c.beginPath();
    c.moveTo(-9, 0);
    c.lineTo(-2.5, 7);
    c.lineTo(10, -7);
    paint(c, null, '#ffffff', 4);
  });
  icon('plus', (c) => {
    circle(c, 0, 0, 17);
    paint(c, linear(c, 0, -17, 0, 17, [[0, '#8ff07a'], [1, '#35b04a']]), LINE, 2.6);
    roundRect(c, -10, -3, 20, 6, 2);
    paint(c, '#ffffff');
    roundRect(c, -3, -10, 6, 20, 2);
    paint(c, '#ffffff');
  });
  icon('gift', (c) => {
    roundRect(c, -15, -4, 30, 22, 4);
    paint(c, linear(c, 0, -4, 0, 18, [[0, '#7fd0ff'], [1, '#2f7bd6']]), LINE, 2.4);
    roundRect(c, -17, -11, 34, 9, 3);
    paint(c, '#9fe0ff', LINE, 2.4);
    roundRect(c, -3.5, -11, 7, 29, 1);
    paint(c, '#ffd24a', '#a87a00', 1.2);
    for (const s of [-1, 1]) {
      blob(c, [[0, -11], [s * 5, -20], [s * 13, -17], [s * 8, -11]]);
      paint(c, '#ffd24a', LINE, 2);
    }
  });
  icon('up', (c) => {
    poly(c, [[0, -19], [16, -1], [7, -1], [7, 17], [-7, 17], [-7, -1], [-16, -1]]);
    paint(c, linear(c, 0, -19, 0, 17, [[0, '#b8ff9a'], [1, '#35b04a']]), LINE, 2.6);
  });
  icon('clock', (c) => {
    circle(c, 0, 0, 17);
    paint(c, '#eef3fb', LINE, 2.6);
    line(c, 0, 0, 0, -10, LINE, 3);
    line(c, 0, 0, 7, 4, LINE, 3);
  });
  icon('sound', (c) => {
    poly(c, [[-16, -6], [-8, -6], [1, -15], [1, 15], [-8, 6], [-16, 6]]);
    paint(c, '#ffffff', LINE, 2.4);
    for (const r of [8, 14]) {
      c.beginPath();
      c.arc(3, 0, r, -0.75, 0.75);
      paint(c, null, LINE, 5.4);
      c.beginPath();
      c.arc(3, 0, r, -0.75, 0.75);
      paint(c, null, '#ffffff', 2.4);
    }
  });
  icon('note', (c) => {
    for (const x of [-9, 9]) {
      ellipse(c, x - 3, 11, 6.5, 5, -0.3);
      paint(c, '#ffffff', LINE, 2.4);
    }
    roundRect(c, -8, -16, 3.5, 28, 1);
    paint(c, '#ffffff', LINE, 2);
    roundRect(c, 10, -16, 3.5, 28, 1);
    paint(c, '#ffffff', LINE, 2);
    poly(c, [[-8, -17], [13.5, -17], [13.5, -9], [-8, -9]]);
    paint(c, '#ffffff', LINE, 2);
  });
  icon('help', (c) => {
    circle(c, 0, 0, 17);
    paint(c, linear(c, 0, -17, 0, 17, [[0, '#ffe680'], [1, '#ffb81f']]), LINE, 2.6);
    c.font = '700 26px Fredoka, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#4a2f00';
    c.fillText('?', 0, 1.5);
  });

  a.done();
}

/** Rayons de lumière tournants (derrière le personnage, derrière les coffres). */
export function buildRaysTexture(scene) {
  if (scene.textures.exists('rays')) return;
  const size = 512;
  const tex = scene.textures.createCanvas('rays', size, size);
  const ctx = tex.getContext();
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const a1 = a0 + (TAU / n) * 0.5;
    ctx.beginPath();
    ctx.moveTo(h, h);
    ctx.arc(h, h, h, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  tex.refresh();
}
