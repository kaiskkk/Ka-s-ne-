// ─────────────────────────────────────────────────────────────
//  Recherche de chemin A* sur la grille de l'arène (8 directions,
//  sans couper les coins). La grille est petite (33×19), c'est très rapide.
// ─────────────────────────────────────────────────────────────
import { TILE } from '../config/constants.js';
import { LAVA_NONE } from './Arena.js';

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

// Tampons réutilisés d'un appel à l'autre (évite de solliciter le ramasse-miettes).
let gScore = new Float32Array(0);
let cameFrom = new Int32Array(0);
let closed = new Uint8Array(0);
const heap = [];

function heapPush(f, i) {
  heap.push({ f, i });
  let n = heap.length - 1;
  while (n > 0) {
    const parent = (n - 1) >> 1;
    if (heap[parent].f <= heap[n].f) break;
    [heap[parent], heap[n]] = [heap[n], heap[parent]];
    n = parent;
  }
}

function heapPop() {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length > 0) {
    heap[0] = last;
    let n = 0;
    for (;;) {
      const l = n * 2 + 1;
      const r = l + 1;
      let m = n;
      if (l < heap.length && heap[l].f < heap[m].f) m = l;
      if (r < heap.length && heap[r].f < heap[m].f) m = r;
      if (m === n) break;
      [heap[m], heap[n]] = [heap[n], heap[m]];
      n = m;
    }
  }
  return top;
}

/** Case praticable la plus proche de (c, r) (recherche en anneaux). */
function nearestWalkable(arena, c, r) {
  if (arena.walkable(c, r)) return [c, r];
  for (let radius = 1; radius <= 8; radius++) {
    let best = null;
    let bestD = Infinity;
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
        if (!arena.walkable(c + dc, r + dr)) continue;
        const d = dc * dc + dr * dr;
        if (d < bestD) {
          bestD = d;
          best = [c + dc, r + dr];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Chemin de (sx, sy) vers (tx, ty), en pixels monde.
 * Renvoie une liste de points {x, y} (centres de cases, puis la cible exacte),
 * ou null si aucun chemin n'existe.
 *
 * opts.lavaCost  : surcoût d'une case de lave (les bots l'évitent si possible)
 * opts.extraCost : fonction (c, r) → surcoût (zones dangereuses…)
 */
export function findPath(arena, sx, sy, tx, ty, opts = {}) {
  const { cols, rows } = arena;
  const n = cols * rows;
  if (gScore.length !== n) {
    gScore = new Float32Array(n);
    cameFrom = new Int32Array(n);
    closed = new Uint8Array(n);
  }
  const lavaCost = opts.lavaCost ?? 8;
  const extraCost = opts.extraCost || null;

  const start = nearestWalkable(arena, Math.floor(sx / TILE), Math.floor(sy / TILE));
  const targetTileC = Math.floor(tx / TILE);
  const targetTileR = Math.floor(ty / TILE);
  const goal = nearestWalkable(arena, targetTileC, targetTileR);
  if (!start || !goal) return null;
  const exactTarget = goal[0] === targetTileC && goal[1] === targetTileR;

  const si = start[1] * cols + start[0];
  const gi = goal[1] * cols + goal[0];

  gScore.fill(Infinity);
  cameFrom.fill(-1);
  closed.fill(0);
  heap.length = 0;
  gScore[si] = 0;
  heapPush(0, si);

  let found = false;
  while (heap.length > 0) {
    const { i } = heapPop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === gi) {
      found = true;
      break;
    }
    const c = i % cols;
    const r = (i - c) / cols;
    for (const [dc, dr, base] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!arena.walkable(nc, nr)) continue;
      // Diagonale interdite si elle frôle un coin de mur.
      if (dc !== 0 && dr !== 0 && (!arena.walkable(c + dc, r) || !arena.walkable(c, r + dr))) continue;
      const ni = nr * cols + nc;
      if (closed[ni]) continue;
      let cost = base;
      if (arena.lava[ni] !== LAVA_NONE) cost += lavaCost;
      if (extraCost) cost += extraCost(nc, nr);
      const g = gScore[i] + cost;
      if (g < gScore[ni]) {
        gScore[ni] = g;
        cameFrom[ni] = i;
        const hx = Math.abs(nc - goal[0]);
        const hy = Math.abs(nr - goal[1]);
        const h = Math.max(hx, hy) + (Math.SQRT2 - 1) * Math.min(hx, hy);
        heapPush(g + h, ni);
      }
    }
  }
  if (!found) return null;

  const path = [];
  for (let i = gi; i !== -1 && i !== si; i = cameFrom[i]) {
    const c = i % cols;
    const r = (i - c) / cols;
    path.push({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE });
  }
  path.reverse();
  if (exactTarget) {
    if (path.length > 0) path[path.length - 1] = { x: tx, y: ty };
    else path.push({ x: tx, y: ty });
  }
  return path;
}
