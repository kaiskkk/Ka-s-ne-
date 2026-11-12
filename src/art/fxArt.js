// ─────────────────────────────────────────────────────────────
//  Atlas « fx » : particules de chaque élément, projectiles, emblèmes
//  des éléments, cristal… Tout est dessiné par le code (voir canvas.js).
// ─────────────────────────────────────────────────────────────
import { Atlas, TAU, blob, circle, ellipse, line, linear, paint, poly, radial, roundRect, star } from './canvas.js';

export const FX_SCALE = 3;

const zigzag = [[-18, -1], [-7, -6], [-4, -1.5], [6, -6.5], [9, -2], [18, -3], [7, 5.5], [4, 1.5], [-6, 6.5], [-9, 2]];

/** Icône blanche de chaque élément (centrée, tient dans un rayon ~13). */
const ICONS = {
  feu(c) {
    blob(c, [[0, 13], [-9, 9], [-10, 0], [-4, -4], [-5, -13], [3, -6], [6, -12], [10, 0], [9, 9]]);
    paint(c, '#ffffff');
    blob(c, [[0, 11], [-4, 7], [-3, 1], [1, -3], [4, 3], [4, 8]]);
    paint(c, 'rgba(255,170,60,0.9)');
  },
  eau(c) {
    blob(c, [[0, 13], [-9, 9], [-9, 1], [-3, -6], [0, -14], [3, -6], [9, 1], [9, 9]]);
    paint(c, '#ffffff');
    c.beginPath();
    c.arc(-1, 3, 5.5, 0.55 * Math.PI, 1.05 * Math.PI);
    paint(c, null, 'rgba(60,150,255,0.9)', 2.4);
  },
  terre(c) {
    poly(c, [[-13, 10], [-4, -8], [1, 0], [5, -5], [13, 10]]);
    paint(c, '#ffffff');
    poly(c, [[-4, -8], [-7.5, -1], [-3, -3], [-1, 0.5], [1, 0]]);
    paint(c, 'rgba(150,105,60,0.9)');
  },
  foudre(c) {
    poly(c, [[3, -14], [-9, 2], [-1, 2], [-4, 14], [9, -3], [1, -3]]);
    paint(c, '#ffffff');
  },
  vent(c) {
    c.lineCap = 'round';
    for (const [y, x0, x1, r] of [[-6, -12, 5, 4.5], [1, -12, 9, 4], [8, -9, 2, 3.5]]) {
      c.beginPath();
      c.moveTo(x0, y);
      c.lineTo(x1, y);
      c.arc(x1, y - r, r, 0.5 * Math.PI, -0.9 * Math.PI, true);
      paint(c, null, '#ffffff', 3.2);
    }
  },
};

const EMBLEM_COLORS = {
  feu: ['#ff8a4a', '#e8361a', '#8a1c0a'],
  eau: ['#6cc6ff', '#1f7fd1', '#0f4a82'],
  terre: ['#d2a878', '#9c6b3f', '#5a3a1c'],
  foudre: ['#ffe86a', '#f0b400', '#8a6400'],
  vent: ['#8ff5da', '#2fbf98', '#157058'],
};

export function buildFxAtlas(scene) {
  if (scene.textures.exists('fx')) return;
  const a = new Atlas(scene, 'fx', 1024, 768, FX_SCALE);

  // ── Particules ──
  a.add('flame', 16, 22, (c) => {
    blob(c, [[0, 10], [-6.5, 6], [-6, -1], [-2, -4], [0, -10.5], [3, -3], [6.5, 2], [5, 7]]);
    paint(c, linear(c, 0, 10, 0, -10, [[0, '#ff5a1f'], [0.5, '#ffa52a'], [1, '#fff3a0']]));
  });
  a.add('drop', 12, 16, (c) => {
    blob(c, [[0, 7.5], [-5, 4.5], [-4.5, -0.5], [0, -7.5], [4.5, -0.5], [5, 4.5]]);
    paint(c, linear(c, 0, -7, 0, 7, [[0, '#c8f0ff'], [1, '#2f9bff']]));
    circle(c, -1.6, 2, 1.5);
    paint(c, 'rgba(255,255,255,0.85)');
  });
  a.add('bubble', 12, 12, (c) => {
    circle(c, 0, 0, 4.6);
    paint(c, 'rgba(160,225,255,0.35)', '#dff6ff', 1.3);
    circle(c, -1.5, -1.6, 1.2);
    paint(c, '#ffffff');
  });
  a.add('spark', 16, 16, (c) => {
    star(c, 4, 7.5, 2.2);
    paint(c, radial(c, 0, 0, 0, 7.5, [[0, '#ffffff'], [0.6, '#fff27a'], [1, '#ffc400']]));
  });
  a.add('bolt', 24, 12, (c) => {
    poly(c, [[-11, -1], [-3, -5], [-1, -1], [10, -4], [3, 5], [1, 1], [-8, 4]]);
    paint(c, '#fff8b0', '#ffc400', 1);
  });
  a.add('rock', 14, 14, (c) => {
    poly(c, [[-5.5, 1], [-3, -5.5], [3, -5], [6, 0], [3.5, 5.5], [-3, 5]]);
    paint(c, '#b98f62', '#5a3f22', 1.3);
    poly(c, [[-3, -4.5], [2.5, -4], [0, -1]]);
    paint(c, 'rgba(255,255,255,0.3)');
  });
  a.add('wind', 30, 12, (c) => {
    c.beginPath();
    c.moveTo(-13, 3);
    c.quadraticCurveTo(0, -8, 13, 0);
    c.quadraticCurveTo(0, -2, -13, 3);
    paint(c, 'rgba(255,255,255,0.95)');
  });
  a.add('smoke', 30, 30, (c) => {
    circle(c, 0, 0, 14);
    paint(c, radial(c, 0, 0, 0, 14, [[0, 'rgba(255,255,255,0.95)'], [0.6, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]));
  });
  a.add('star', 18, 18, (c) => {
    star(c, 5, 8, 3.6);
    paint(c, '#ffe14d', '#a86a00', 1.4);
  });
  a.add('leaf', 14, 10, (c) => {
    blob(c, [[-6, 0], [0, -4], [6, 0], [0, 4]]);
    paint(c, '#5cc04a', '#2a7a2a', 1);
    line(c, -4, 0, 4, 0, 'rgba(255,255,255,0.5)', 0.8);
  });
  a.add('snow', 12, 12, (c) => {
    for (let i = 0; i < 3; i++) {
      const an = (i / 3) * Math.PI;
      line(c, Math.cos(an) * -5, Math.sin(an) * -5, Math.cos(an) * 5, Math.sin(an) * 5, '#ffffff', 1.5);
    }
  });
  a.add('plus', 14, 14, (c) => {
    roundRect(c, -5.5, -1.9, 11, 3.8, 1.5);
    paint(c, '#d6ffe9');
    roundRect(c, -1.9, -5.5, 3.8, 11, 1.5);
    paint(c, '#d6ffe9');
  });
  a.add('shard', 10, 16, (c) => {
    poly(c, [[0, -7.5], [4, 0], [0, 7.5], [-4, 0]]);
    paint(c, '#bffcff', '#1aa6c4', 1);
  });
  a.add('confetti', 8, 12, (c) => {
    roundRect(c, -3, -5, 6, 10, 1.5);
    paint(c, '#ffffff');
  });
  a.add('sand', 8, 8, (c) => {
    circle(c, 0, 0, 3);
    paint(c, '#f0d9a0');
  });

  // ── Projectiles (orientés vers la droite) ──
  a.add('p_feu', 42, 24, (c) => {
    blob(c, [[17, 0], [10, -9], [-2, -9], [-12, -5], [-20, -7], [-14, 0], [-20, 7], [-12, 5], [-2, 9], [10, 9]]);
    paint(c, linear(c, -20, 0, 17, 0, [[0, '#e8361a'], [0.55, '#ff8a1f'], [1, '#ffd23a']]), '#a3200c', 1.6);
    ellipse(c, 6, 0, 8, 5.5);
    paint(c, radial(c, 7, 0, 0, 8, [[0, '#ffffff'], [0.6, '#fff3a0'], [1, 'rgba(255,220,90,0)']]));
  });
  a.add('p_eau', 36, 20, (c) => {
    blob(c, [[15, 0], [9, -7], [-2, -6.5], [-16, 0], [-2, 6.5], [9, 7]]);
    paint(c, linear(c, -16, 0, 15, 0, [[0, '#2f7bd6'], [1, '#7fd6ff']]), '#155a9e', 1.6);
    ellipse(c, 6, -2.2, 5, 2.2, -0.2);
    paint(c, 'rgba(255,255,255,0.85)');
  });
  a.add('p_terre', 24, 22, (c) => {
    poly(c, [[10, 0], [5, -8], [-5, -9], [-10, -2], [-7, 7], [3, 9]]);
    paint(c, linear(c, 0, -9, 0, 9, [[0, '#d2a878'], [1, '#8a6238']]), '#4a3018', 1.8);
    poly(c, [[5, -8], [-5, -9], [-2, -3], [4, -2]]);
    paint(c, 'rgba(255,255,255,0.28)');
  });
  a.add('p_foudre', 42, 20, (c) => {
    poly(c, zigzag);
    paint(c, '#fff27a', '#f0a800', 2);
    poly(c, zigzag.map(([x, y]) => [x * 0.86, y * 0.5]));
    paint(c, '#ffffff');
  });
  a.add('p_vent', 32, 32, (c) => {
    // Lame en croissant
    c.beginPath();
    c.arc(0, 0, 13, -1.25, 1.25);
    c.quadraticCurveTo(5, 0, 13 * Math.cos(-1.25), 13 * Math.sin(-1.25));
    paint(c, linear(c, 0, -13, 0, 13, [[0, '#ffffff'], [0.5, '#c4f7e8'], [1, '#ffffff']]), '#2fbf98', 1.6);
  });
  a.add('p_magma', 46, 46, (c) => {
    circle(c, 0, 0, 19);
    paint(c, radial(c, -4, -5, 2, 21, [[0, '#7a3a1a'], [1, '#3a1608']]), '#2a0e04', 2);
    // Fissures de lave
    c.beginPath();
    c.moveTo(-14, -6);
    c.lineTo(-5, -1);
    c.lineTo(-8, 9);
    c.moveTo(-5, -1);
    c.lineTo(5, -6);
    c.lineTo(13, -3);
    c.moveTo(5, -6);
    c.lineTo(4, -15);
    c.moveTo(-1, 4);
    c.lineTo(8, 10);
    paint(c, null, '#ffb13a', 3);
    paint(c, null, '#fff3a0', 1.2);
  });
  a.add('p_plasma', 36, 36, (c) => {
    circle(c, 0, 0, 13);
    paint(c, radial(c, 0, 0, 0, 13, [[0, '#ffffff'], [0.4, '#f0b8ff'], [1, '#a03df0']]), '#6a1fb0', 1.6);
    c.beginPath();
    c.ellipse(0, 0, 16, 5.5, 0.6, 0, TAU);
    paint(c, null, 'rgba(255,240,150,0.9)', 1.6);
  });
  a.add('muzzle', 32, 32, (c) => {
    star(c, 8, 15, 5.5);
    paint(c, radial(c, 0, 0, 0, 15, [[0, '#ffffff'], [0.5, '#fff3a0'], [1, 'rgba(255,200,60,0)']]));
  });

  // ── Emblèmes des éléments (pastilles) ──
  for (const el of Object.keys(ICONS)) {
    const [light, main, dark] = EMBLEM_COLORS[el];
    a.add(`em_${el}`, 54, 54, (c) => {
      circle(c, 0, 0, 24);
      paint(c, linear(c, 0, -24, 0, 24, [[0, light], [1, main]]), dark, 3);
      c.beginPath();
      c.arc(0, 0, 19.5, 1.1 * Math.PI, 1.9 * Math.PI);
      paint(c, null, 'rgba(255,255,255,0.4)', 2.2);
      c.save();
      c.scale(1.05, 1.05);
      c.translate(0, 0.5);
      ICONS[el](c);
      c.restore();
    });
  }

  // ── Cristal ──
  a.add('crystal', 44, 60, (c) => {
    poly(c, [[0, -26], [15, -6], [0, 26], [-15, -6]]);
    paint(c, '#7df9ff', '#ffffff', 3.4);
    poly(c, [[0, -26], [15, -6], [0, 26], [-15, -6]]);
    paint(c, null, '#0f7f9a', 1.6);
    poly(c, [[0, -26], [15, -6], [0, 26]]);
    paint(c, '#22b6d6');
    poly(c, [[0, -26], [15, -6], [0, -2]]);
    paint(c, '#4fd9f0');
    poly(c, [[0, -26], [-15, -6], [0, -2]]);
    paint(c, '#c8fdff');
    poly(c, [[-4, -17], [-10, -7], [-3, -6]]);
    paint(c, 'rgba(255,255,255,0.95)');
  });

  // ── Bloc de glace (personnage gelé) ──
  a.add('ice', 70, 76, (c) => {
    poly(c, [[-22, 34], [-30, 4], [-18, -26], [2, -36], [22, -24], [30, 6], [20, 34]]);
    paint(c, 'rgba(170,230,255,0.5)', 'rgba(255,255,255,0.95)', 2.4);
    poly(c, [[-18, -26], [2, -36], [-4, -8], [-22, 2]]);
    paint(c, 'rgba(255,255,255,0.4)');
    line(c, 8, -20, 16, 6, 'rgba(255,255,255,0.7)', 2);
  });

  // ── Halo doux allongé (traînées) ──
  a.add('streak', 40, 10, (c) => {
    ellipse(c, 0, 0, 19, 4);
    paint(c, radial(c, 0, 0, 0, 19, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]));
  });

  a.done();
}
