// ─────────────────────────────────────────────────────────────
//  ArenaView — dessine l'arène : sol, murs, buissons, rails,
//  et les éléments dynamiques (lave, murs mobiles).
// ─────────────────────────────────────────────────────────────
import { TILE } from '../config/constants.js';
import { TEAM_COLORS } from '../config/elements.js';
import { LAVA_ON, LAVA_WARN, T_BUSH, T_WALL } from '../sim/Arena.js';
import { lerp } from '../sim/mathx.js';

export const DEPTH = {
  floor: 0,
  ground: 2, // lave, rails
  zone: 3, // zones au sol
  strike: 4,
  crystal: 5,
  wall: 6,
  aim: 8,
  shadow: 9,
  fighter: 10,
  projectile: 12,
  bush: 16,
  cloud: 20, // nuages, tornades, explosions
  fog: 30,
  overhead: 40, // barres de vie, noms, balises des porteurs
  number: 45,
};

const C = {
  outside: 0x070a14,
  floorA: 0x232c48,
  floorB: 0x27314f,
  line: 0x35406a,
  wallTop: 0x7783a8,
  wallFront: 0x4a5475,
  wallEdge: 0x9aa6c8,
  borderTop: 0x3d4767,
  borderFront: 0x2a3250,
  bush: 0x2f9e58,
  bushLight: 0x55c878,
  bushDark: 0x1f7a40,
  rail: 0x5a67a8,
  mover: 0x9aa7ff,
  moverFront: 0x5b66b8,
  lava: 0xff4a12,
  lavaHot: 0xffb13a,
};

/** Petit générateur déterministe pour placer les détails décoratifs. */
function hash(c, r, k = 0) {
  let h = (c * 374761393 + r * 668265263 + k * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class ArenaView {
  constructor(scene, arena) {
    this.scene = scene;
    this.arena = arena;

    this.floor = scene.add.graphics().setDepth(DEPTH.floor);
    this.lavaG = scene.add.graphics().setDepth(DEPTH.ground);
    this.walls = scene.add.graphics().setDepth(DEPTH.wall);
    this.moversG = scene.add.graphics().setDepth(DEPTH.wall);
    this.bushes = scene.add.graphics().setDepth(DEPTH.bush).setAlpha(0.8);

    this.drawFloor();
    this.drawWalls();
    this.drawBushes();
  }

  drawFloor() {
    const { arena } = this;
    const g = this.floor;
    // Extérieur de l'arène (visible seulement sur les écrans très larges)
    g.fillStyle(C.outside, 1);
    g.fillRect(-2000, -2000, arena.width + 4000, arena.height + 4000);
    // Damier discret
    for (let r = 0; r < arena.rows; r++) {
      for (let c = 0; c < arena.cols; c++) {
        g.fillStyle((c + r) % 2 === 0 ? C.floorA : C.floorB, 1);
        g.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    // Zones de base teintées aux couleurs des équipes
    const baseW = 4 * TILE;
    g.fillStyle(TEAM_COLORS[0].main, 0.1);
    g.fillRect(TILE, TILE, baseW - TILE, arena.height - 2 * TILE);
    g.fillStyle(TEAM_COLORS[1].main, 0.1);
    g.fillRect(arena.width - baseW, TILE, baseW - TILE, arena.height - 2 * TILE);
    // Ligne et cercle centraux
    const cx = arena.width / 2;
    const cy = arena.height / 2;
    g.lineStyle(3, C.line, 0.9);
    g.lineBetween(cx, TILE, cx, arena.height - TILE);
    g.strokeCircle(cx, cy, TILE * 2.6);
    // Points d'apparition
    for (let team = 0; team < 2; team++) {
      for (const s of arena.spawns[team]) {
        g.lineStyle(3, TEAM_COLORS[team].main, 0.55);
        g.strokeCircle(s.x, s.y, 30);
        g.fillStyle(TEAM_COLORS[team].main, 0.16);
        g.fillCircle(s.x, s.y, 30);
      }
    }
    // Socles des cristaux
    for (const p of arena.crystalSpawns) {
      g.fillStyle(0x7df9ff, 0.12);
      g.fillCircle(p.x, p.y, 26);
      g.lineStyle(2, 0x7df9ff, 0.45);
      g.strokeCircle(p.x, p.y, 26);
    }
    // Rails des murs mobiles (pointillés)
    for (const m of arena.movers) {
      const x0 = m.ax + m.w / 2;
      const y0 = m.ay + m.h / 2;
      const x1 = m.bx + m.w / 2;
      const y1 = m.by + m.h / 2;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(len / 28));
      g.fillStyle(C.rail, 0.55);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        g.fillRect(lerp(x0, x1, t) - 5, lerp(y0, y1, t) - 5, 10, 10);
      }
    }
  }

  drawWalls() {
    const { arena } = this;
    const g = this.walls;
    const front = 12; // hauteur de la « face avant » (fausse 3D)
    for (let r = 0; r < arena.rows; r++) {
      for (let c = 0; c < arena.cols; c++) {
        if (arena.tileType(c, r) !== T_WALL) continue;
        const border = c === 0 || r === 0 || c === arena.cols - 1 || r === arena.rows - 1;
        const x = c * TILE;
        const y = r * TILE;
        const below = arena.tileType(c, r + 1) === T_WALL;
        g.fillStyle(border ? C.borderFront : C.wallFront, 1);
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle(border ? C.borderTop : C.wallTop, 1);
        g.fillRect(x, y, TILE, below ? TILE : TILE - front);
        if (!border) {
          // Liseré clair en haut (seulement si la case du dessus est libre)
          if (arena.tileType(c, r - 1) !== T_WALL) {
            g.fillStyle(C.wallEdge, 1);
            g.fillRect(x, y, TILE, 4);
          }
          // Petites fissures décoratives
          g.fillStyle(C.wallFront, 0.5);
          g.fillRect(x + 10 + hash(c, r) * 30, y + 14 + hash(c, r, 1) * 20, 12, 3);
        }
      }
    }
  }

  drawBushes() {
    const { arena } = this;
    const g = this.bushes;
    for (let r = 0; r < arena.rows; r++) {
      for (let c = 0; c < arena.cols; c++) {
        if (arena.tileType(c, r) !== T_BUSH) continue;
        const x = c * TILE;
        const y = r * TILE;
        g.fillStyle(C.bushDark, 1);
        g.fillRoundedRect(x - 3, y - 3, TILE + 6, TILE + 6, 14);
        g.fillStyle(C.bush, 1);
        g.fillRoundedRect(x + 1, y + 1, TILE - 2, TILE - 6, 12);
        // Quelques touffes plus claires
        g.fillStyle(C.bushLight, 1);
        for (let k = 0; k < 4; k++) {
          g.fillCircle(x + 12 + hash(c, r, k) * 40, y + 12 + hash(c, r, k + 7) * 36, 5 + hash(c, r, k + 3) * 4);
        }
      }
    }
  }

  /** Éléments animés : lave et murs mobiles. `alpha` = interpolation entre deux pas. */
  update(time, alpha) {
    const { arena } = this;

    // Lave
    const lg = this.lavaG;
    lg.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.008);
    for (let i = 0; i < arena.lava.length; i++) {
      const state = arena.lava[i];
      if (state === 0) continue;
      const c = i % arena.cols;
      const r = (i - c) / arena.cols;
      const x = c * TILE;
      const y = r * TILE;
      if (state === LAVA_WARN) {
        // Avertissement : la case clignote
        lg.fillStyle(C.lava, 0.12 + 0.2 * pulse);
        lg.fillRect(x, y, TILE, TILE);
        lg.lineStyle(3, C.lavaHot, 0.5 + 0.5 * pulse);
        lg.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
      } else if (state === LAVA_ON) {
        lg.fillStyle(C.lava, 0.92);
        lg.fillRect(x, y, TILE, TILE);
        lg.fillStyle(C.lavaHot, 0.55 + 0.3 * Math.sin(time * 0.005 + c * 1.7 + r));
        lg.fillCircle(x + 20 + hash(c, r) * 24, y + 20 + hash(c, r, 1) * 24, 9 + hash(c, r, 2) * 6);
        lg.fillStyle(0xfff0a0, 0.5 + 0.3 * Math.sin(time * 0.007 + c + r * 2.3));
        lg.fillCircle(x + 14 + hash(c, r, 3) * 36, y + 14 + hash(c, r, 4) * 36, 4);
      }
    }

    // Murs mobiles
    const mg = this.moversG;
    mg.clear();
    for (const m of arena.movers) {
      if (m.state === 'hidden') continue;
      const x = lerp(m.px, m.x, alpha);
      const y = lerp(m.py, m.y, alpha);
      if (m.state === 'warning') {
        mg.fillStyle(C.mover, 0.15 + 0.3 * pulse);
        mg.fillRect(x, y, m.w, m.h);
        mg.lineStyle(3, C.mover, 0.6 + 0.4 * pulse);
        mg.strokeRect(x + 2, y + 2, m.w - 4, m.h - 4);
      } else {
        mg.fillStyle(C.moverFront, 1);
        mg.fillRect(x, y, m.w, m.h);
        mg.fillStyle(C.mover, 1);
        mg.fillRect(x, y, m.w, m.h - 12);
        mg.fillStyle(0xffffff, 0.85);
        mg.fillRect(x, y, m.w, 4);
        // Chevrons indiquant le sens de déplacement
        const horizontal = m.ay === m.by;
        const dir = (m.bx - m.ax + (m.by - m.ay) > 0 ? 1 : -1) * m.dir;
        const cx = x + m.w / 2;
        const cy = y + (m.h - 12) / 2;
        mg.fillStyle(0x2b3170, 0.9);
        for (const off of [-12, 6]) {
          if (horizontal) {
            mg.fillTriangle(cx + (off + 12) * dir, cy, cx + off * dir, cy - 9, cx + off * dir, cy + 9);
          } else {
            mg.fillTriangle(cx, cy + (off + 12) * dir, cx - 9, cy + off * dir, cx + 9, cy + off * dir);
          }
        }
      }
    }
  }

  destroy() {
    for (const g of [this.floor, this.lavaG, this.walls, this.moversG, this.bushes]) g.destroy();
  }
}
