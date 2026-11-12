// ─────────────────────────────────────────────────────────────
//  ArenaView — affiche l'arène.
//  Le sol, les murs et les buissons sont des textures peintes au démarrage
//  (art/mapArt.js). Seuls la lave et les murs mobiles sont animés ici.
// ─────────────────────────────────────────────────────────────
import { GROUND_SCALE } from '../art/mapArt.js';
import { TILE } from '../config/constants.js';
import { LAVA_ON, LAVA_WARN } from '../sim/Arena.js';
import { lerp } from '../sim/mathx.js';

export const DEPTH = {
  floor: 0,
  ground: 2, // lave
  zone: 3, // zones au sol
  strike: 4,
  crystal: 5,
  wall: 6,
  aim: 8,
  shadow: 9,
  fighter: 10, // + un petit décalage selon y (les persos du bas passent devant)
  projectile: 12,
  bush: 16,
  cloud: 20, // nuages, tornades, explosions
  fog: 30,
  overhead: 40, // barres de vie, noms, balises des porteurs
  number: 45,
};

function hash(c, r, k = 0) {
  let h = (c * 374761393 + r * 668265263 + k * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class ArenaView {
  constructor(scene, arena) {
    this.scene = scene;
    this.arena = arena;

    // Au-delà de l'arène (visible seulement sur les écrans très larges)
    scene.add
      .rectangle(arena.width / 2, arena.height / 2, arena.width + 5000, arena.height + 5000, 0x263326)
      .setDepth(DEPTH.floor - 1);
    this.ground = scene.add
      .image(0, 0, 'ground')
      .setOrigin(0, 0)
      .setScale(1 / GROUND_SCALE)
      .setDepth(DEPTH.floor);

    this.lavaG = scene.add.graphics().setDepth(DEPTH.ground);

    this.moverImgs = arena.movers.map((m) =>
      scene.add.image(0, 0, `mover_${m.w}x${m.h}`).setOrigin(0, 0).setScale(0.5).setDepth(DEPTH.wall).setVisible(false),
    );

    // Massifs de buissons : par-dessus les personnages
    this.bushes = (scene.registry.get('bushes') || []).map((b) => ({
      ...b,
      img: scene.add.image(b.x, b.y, b.key).setScale(b.scale).setDepth(DEPTH.bush),
      alpha: 1,
      rustle: 0,
    }));
  }

  /** Le massif de buissons qui contient le point (x, y), ou null. */
  bushAt(x, y) {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    for (const b of this.bushes) {
      if (c >= b.c && c < b.c + b.w && r >= b.r && r < b.r + b.h) return b;
    }
    return null;
  }

  /**
   * @param {Array} visible  combattants que le joueur voit : [{ f, friendly }]
   */
  update(time, alpha, dt, visible) {
    const { arena } = this;

    // ── Buissons : s'estompent quand un allié est dedans, frémissent quand on y bouge ──
    for (const b of this.bushes) {
      b.inside = false;
    }
    for (const v of visible) {
      const f = v.f;
      if (!f.alive || !f.inBush) continue;
      const b = this.bushAt(f.x, f.y);
      if (!b) continue;
      if (v.friendly) b.inside = true;
      if (Math.abs(f.vx) + Math.abs(f.vy) > 40) b.rustle = 1;
    }
    for (const b of this.bushes) {
      b.alpha = lerp(b.alpha, b.inside ? 0.62 : 1, Math.min(1, dt * 10));
      b.rustle = Math.max(0, b.rustle - dt * 2.5);
      const wob = Math.sin(time * 0.03) * 0.025 * b.rustle;
      b.img.setAlpha(b.alpha).setScale(b.scale * (1 + wob), b.scale * (1 - wob));
    }

    // ── Lave ──
    const lg = this.lavaG;
    lg.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.008);
    const isLava = (c, r, state) => arena.inBounds(c, r) && arena.lava[r * arena.cols + c] === state;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < arena.lava.length; i++) {
        const state = arena.lava[i];
        if (state === 0) continue;
        const c = i % arena.cols;
        const r = (i - c) / arena.cols;
        const x = c * TILE;
        const y = r * TILE;
        // Coins arrondis seulement sur le pourtour de la flaque
        const n = isLava(c, r - 1, state);
        const s = isLava(c, r + 1, state);
        const w = isLava(c - 1, r, state);
        const e = isLava(c + 1, r, state);
        const rad = { tl: n || w ? 0 : 20, tr: n || e ? 0 : 20, bl: s || w ? 0 : 20, br: s || e ? 0 : 20 };
        if (state === LAVA_WARN) {
          if (pass === 0) {
            lg.fillStyle(0xff6a1f, 0.16 + 0.22 * pulse);
            lg.fillRoundedRect(x, y, TILE, TILE, rad);
          } else {
            lg.fillStyle(0xfff0a0, 0.35 + 0.5 * pulse);
            lg.fillCircle(x + TILE / 2, y + TILE / 2, 5 + pulse * 3);
          }
        } else if (state === LAVA_ON) {
          if (pass === 0) {
            // Croûte sombre qui déborde légèrement
            lg.fillStyle(0x5a1a0a, 0.9);
            lg.fillRoundedRect(x - 4, y - 4, TILE + 8, TILE + 8, 22);
          } else {
            lg.fillStyle(0xff4a12, 1);
            lg.fillRoundedRect(x, y, TILE, TILE, rad);
            lg.fillStyle(0xffa02a, 0.55 + 0.3 * Math.sin(time * 0.004 + c * 1.7 + r));
            lg.fillCircle(x + 20 + hash(c, r) * 24, y + 20 + hash(c, r, 1) * 24, 12 + hash(c, r, 2) * 7);
            lg.fillStyle(0xfff0a0, 0.55 + 0.35 * Math.sin(time * 0.007 + c + r * 2.3));
            lg.fillCircle(x + 14 + hash(c, r, 3) * 36, y + 14 + hash(c, r, 4) * 36, 4.5);
            // Bulle qui gonfle puis éclate
            const k = (time * 0.0009 + hash(c, r, 5)) % 1;
            lg.lineStyle(2.5, 0xfff0a0, 1 - k);
            lg.strokeCircle(x + 12 + hash(c, r, 6) * 40, y + 12 + hash(c, r, 7) * 40, 2 + k * 8);
          }
        }
      }
    }

    // ── Murs mobiles ──
    arena.movers.forEach((m, i) => {
      const img = this.moverImgs[i];
      if (m.state === 'hidden') {
        img.setVisible(false);
        return;
      }
      const horizontal = m.ay === m.by;
      const forward = (horizontal ? m.bx - m.ax : m.by - m.ay) * m.dir > 0;
      img
        .setVisible(true)
        .setPosition(lerp(m.px, m.x, alpha) - 4, lerp(m.py, m.y, alpha) - 4)
        .setAlpha(m.state === 'warning' ? 0.3 + 0.4 * pulse : 1)
        .setFlipX(horizontal && !forward)
        .setFlipY(!horizontal && !forward);
    });
  }
}
