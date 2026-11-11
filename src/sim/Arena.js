// ─────────────────────────────────────────────────────────────
//  Arena — la grille de l'arène et toute la géométrie :
//  collisions cercle/murs, lancers de rayon, lave, murs mobiles.
//  (Aucune dépendance à Phaser : utilisable côté serveur.)
// ─────────────────────────────────────────────────────────────
import { TILE } from '../config/constants.js';
import { clamp, lerp, segmentRect } from './mathx.js';

export const T_FLOOR = 0;
export const T_WALL = 1;
export const T_BUSH = 2;

export const LAVA_NONE = 0;
export const LAVA_WARN = 1; // la case clignote : la lave arrive
export const LAVA_ON = 2; // la case brûle

export class Arena {
  constructor(mapDef) {
    const rows = mapDef.rows;
    this.rows = rows.length;
    this.cols = rows[0].length;
    this.width = this.cols * TILE;
    this.height = this.rows * TILE;
    this.tiles = new Uint8Array(this.cols * this.rows);
    this.lava = new Uint8Array(this.cols * this.rows);
    this.moverMask = new Uint8Array(this.cols * this.rows);
    /** Points d'apparition par équipe : [[{x, y}…], [{x, y}…]] */
    this.spawns = [[], []];
    this.crystalSpawns = [];
    /** Vrai pendant l'événement « brouillard ». */
    this.fog = false;

    for (let r = 0; r < this.rows; r++) {
      if (rows[r].length !== this.cols) throw new Error(`Carte invalide : ligne ${r} de mauvaise longueur`);
      for (let c = 0; c < this.cols; c++) {
        const ch = rows[r][c];
        const center = { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
        if (ch === '#') this.tiles[this.idx(c, r)] = T_WALL;
        else if (ch === 'b') this.tiles[this.idx(c, r)] = T_BUSH;
        else if (ch === 'A') this.spawns[0].push(center);
        else if (ch === 'B') this.spawns[1].push(center);
        else if (ch === 'C') this.crystalSpawns.push(center);
      }
    }

    this.moverSpeed = mapDef.moverSpeed || 100;
    this.movers = (mapDef.movers || []).map((d, i) => {
      const ax = d.from[0] * TILE;
      const ay = d.from[1] * TILE;
      const bx = d.to[0] * TILE;
      const by = d.to[1] * TILE;
      return {
        id: i,
        w: d.w * TILE,
        h: d.h * TILE,
        ax,
        ay,
        bx,
        by,
        len: Math.hypot(bx - ax, by - ay),
        x: ax,
        y: ay,
        px: ax, // position au pas précédent (interpolation du rendu)
        py: ay,
        s: 0, // progression 0 → 1 le long du rail
        dir: 1,
        state: 'hidden', // 'hidden' | 'warning' | 'active'
      };
    });
  }

  // ── Accès à la grille ──────────────────────────────────────

  idx(c, r) {
    return r * this.cols + c;
  }

  inBounds(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  tileType(c, r) {
    return this.inBounds(c, r) ? this.tiles[r * this.cols + c] : T_WALL;
  }

  isWall(c, r) {
    return this.tileType(c, r) === T_WALL;
  }

  colOf(x) {
    return Math.floor(x / TILE);
  }

  rowOf(y) {
    return Math.floor(y / TILE);
  }

  tileCenter(c, r) {
    return { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
  }

  isBushAt(x, y) {
    return this.tileType(this.colOf(x), this.rowOf(y)) === T_BUSH;
  }

  lavaAt(x, y) {
    const c = this.colOf(x);
    const r = this.rowOf(y);
    return this.inBounds(c, r) ? this.lava[r * this.cols + c] : LAVA_NONE;
  }

  /** Vrai si le point est dans un mur fixe ou dans un mur mobile actif. */
  solidAt(x, y) {
    if (this.isWall(this.colOf(x), this.rowOf(y))) return true;
    for (const m of this.movers) {
      if (m.state === 'active' && x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) return true;
    }
    return false;
  }

  /** Case praticable pour la recherche de chemin (ni mur, ni mur mobile). */
  walkable(c, r) {
    if (!this.inBounds(c, r)) return false;
    const i = r * this.cols + c;
    return this.tiles[i] !== T_WALL && this.moverMask[i] === 0;
  }

  // ── Collisions cercle / décor ──────────────────────────────

  /**
   * Repousse le cercle `p` ({x, y, r}) hors des murs et des murs mobiles.
   * Renvoie true s'il y a eu contact.
   */
  resolveCircle(p) {
    let hit = false;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      const c0 = Math.floor((p.x - p.r) / TILE);
      const c1 = Math.floor((p.x + p.r) / TILE);
      const r0 = Math.floor((p.y - p.r) / TILE);
      const r1 = Math.floor((p.y + p.r) / TILE);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (this.isWall(c, r) && pushOut(p, c * TILE, r * TILE, TILE, TILE)) moved = true;
        }
      }
      for (const m of this.movers) {
        if (m.state === 'active' && pushOut(p, m.x, m.y, m.w, m.h)) moved = true;
      }
      if (!moved) break;
      hit = true;
    }
    return hit;
  }

  /** Vrai si un cercle de rayon r centré en (x, y) touche un obstacle. */
  circleBlocked(x, y, r) {
    const c0 = Math.floor((x - r) / TILE);
    const c1 = Math.floor((x + r) / TILE);
    const r0 = Math.floor((y - r) / TILE);
    const r1 = Math.floor((y + r) / TILE);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (this.isWall(col, row) && circleRectOverlap(x, y, r, col * TILE, row * TILE, TILE, TILE)) return true;
      }
    }
    for (const m of this.movers) {
      if (m.state === 'active' && circleRectOverlap(x, y, r, m.x, m.y, m.w, m.h)) return true;
    }
    return false;
  }

  /**
   * Point libre le plus proche de (x, y) pour un cercle de rayon r :
   * (x, y) lui-même s'il est libre, sinon le centre de la case libre la plus proche.
   */
  nearestFreePoint(x, y, r) {
    if (!this.circleBlocked(x, y, r)) return { x, y };
    const c0 = clamp(this.colOf(x), 0, this.cols - 1);
    const r0 = clamp(this.rowOf(y), 0, this.rows - 1);
    let best = null;
    let bestD = Infinity;
    for (let radius = 0; radius <= 6 && !best; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
          const c = c0 + dc;
          const row = r0 + dr;
          if (!this.walkable(c, row)) continue;
          const p = this.tileCenter(c, row);
          if (this.circleBlocked(p.x, p.y, r)) continue;
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
      }
    }
    return best || { x, y };
  }

  // ── Lancers de rayon ───────────────────────────────────────

  /**
   * Fraction t ∈ [0, 1] du segment (x0,y0)→(x1,y1) parcourue avant de
   * toucher un obstacle (1 = aucun obstacle).
   */
  raycast(x0, y0, x1, y1) {
    let t = this.raycastTiles(x0, y0, x1, y1);
    for (const m of this.movers) {
      if (m.state !== 'active') continue;
      const tm = segmentRect(x0, y0, x1, y1, m.x, m.y, m.w, m.h);
      if (tm < t) t = tm;
    }
    return t;
  }

  /** Parcours de grille (DDA) contre les murs fixes uniquement. */
  raycastTiles(x0, y0, x1, y1) {
    let c = Math.floor(x0 / TILE);
    let r = Math.floor(y0 / TILE);
    if (this.isWall(c, r)) return 0;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const stepC = dx > 0 ? 1 : -1;
    const stepR = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
    let tMaxX = dx !== 0 ? (dx > 0 ? (c + 1) * TILE - x0 : x0 - c * TILE) / Math.abs(dx) : Infinity;
    let tMaxY = dy !== 0 ? (dy > 0 ? (r + 1) * TILE - y0 : y0 - r * TILE) / Math.abs(dy) : Infinity;
    for (let guard = 0; guard < 200; guard++) {
      let t;
      if (tMaxX < tMaxY) {
        t = tMaxX;
        tMaxX += tDeltaX;
        c += stepC;
      } else {
        t = tMaxY;
        tMaxY += tDeltaY;
        r += stepR;
      }
      if (t >= 1) return 1;
      if (this.isWall(c, r)) return t;
    }
    return 1;
  }

  /**
   * Ligne de tir dégagée entre deux points ? Avec `halfWidth` > 0 on teste
   * aussi deux rayons parallèles (pour un projectile épais ou un personnage).
   */
  clearLine(x0, y0, x1, y1, halfWidth = 0) {
    if (this.raycast(x0, y0, x1, y1) < 1) return false;
    if (halfWidth <= 0) return true;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return true;
    const ox = (-dy / len) * halfWidth;
    const oy = (dx / len) * halfWidth;
    return (
      this.raycast(x0 + ox, y0 + oy, x1 + ox, y1 + oy) >= 1 && this.raycast(x0 - ox, y0 - oy, x1 - ox, y1 - oy) >= 1
    );
  }

  // ── Murs mobiles ───────────────────────────────────────────

  setMoversState(state) {
    for (const m of this.movers) {
      m.state = state;
      if (state !== 'active') {
        m.s = 0;
        m.dir = 1;
        m.x = m.px = m.ax;
        m.y = m.py = m.ay;
      }
    }
    this.refreshMoverMask();
  }

  updateMovers(dt) {
    let any = false;
    for (const m of this.movers) {
      m.px = m.x;
      m.py = m.y;
      if (m.state !== 'active' || m.len <= 0) continue;
      any = true;
      m.s += (m.dir * this.moverSpeed * dt) / m.len;
      if (m.s >= 1) {
        m.s = 1;
        m.dir = -1;
      } else if (m.s <= 0) {
        m.s = 0;
        m.dir = 1;
      }
      m.x = lerp(m.ax, m.bx, m.s);
      m.y = lerp(m.ay, m.by, m.s);
    }
    if (any) this.refreshMoverMask();
  }

  /** Marque les cases couvertes par un mur mobile actif (pour les bots). */
  refreshMoverMask() {
    this.moverMask.fill(0);
    for (const m of this.movers) {
      if (m.state !== 'active') continue;
      const c0 = Math.floor((m.x + 2) / TILE);
      const c1 = Math.floor((m.x + m.w - 2) / TILE);
      const r0 = Math.floor((m.y + 2) / TILE);
      const r1 = Math.floor((m.y + m.h - 2) / TILE);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (this.inBounds(c, r)) this.moverMask[r * this.cols + c] = 1;
        }
      }
    }
  }

  // ── Lave ───────────────────────────────────────────────────

  setLava(indices, state) {
    for (const i of indices) this.lava[i] = state;
  }

  clearLava() {
    this.lava.fill(LAVA_NONE);
  }
}

// ── Fonctions géométriques internes ──────────────────────────

function circleRectOverlap(x, y, r, rx, ry, rw, rh) {
  const nx = clamp(x, rx, rx + rw);
  const ny = clamp(y, ry, ry + rh);
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy < r * r;
}

/** Pousse le cercle p hors du rectangle. Renvoie true s'il y avait chevauchement. */
function pushOut(p, rx, ry, rw, rh) {
  const nx = clamp(p.x, rx, rx + rw);
  const ny = clamp(p.y, ry, ry + rh);
  const dx = p.x - nx;
  const dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= p.r * p.r) return false;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = p.r - d;
    p.x += (dx / d) * push;
    p.y += (dy / d) * push;
    return true;
  }
  // Centre à l'intérieur du rectangle : on sort par le côté le plus proche.
  const left = p.x - rx;
  const right = rx + rw - p.x;
  const top = p.y - ry;
  const bottom = ry + rh - p.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) p.x = rx - p.r;
  else if (m === right) p.x = rx + rw + p.r;
  else if (m === top) p.y = ry - p.r;
  else p.y = ry + rh + p.r;
  return true;
}
