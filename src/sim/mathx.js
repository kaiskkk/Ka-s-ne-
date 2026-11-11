// Petites fonctions mathématiques partagées par la simulation et le rendu.

export const TAU = Math.PI * 2;

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Distance entre deux objets {x, y}. */
export function distObj(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Ramène un angle dans ]-π, π]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a <= -Math.PI) a += TAU;
  return a;
}

/** Différence signée la plus courte entre deux angles. */
export function angleDiff(from, to) {
  return wrapAngle(to - from);
}

/** Tourne `from` vers `to` d'au plus `maxStep` radians. */
export function rotateToward(from, to, maxStep) {
  const d = angleDiff(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return wrapAngle(from + Math.sign(d) * maxStep);
}

/** Distance d'un point à un segment [a, b]. */
export function pointSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/**
 * Intersection segment / rectangle (méthode des « slabs »).
 * Renvoie la fraction t ∈ [0, 1] du premier contact, ou 1 s'il n'y en a pas.
 */
export function segmentRect(x0, y0, x1, y1, rx, ry, rw, rh) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tMin = 0;
  let tMax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x0 < rx || x0 > rx + rw) return 1;
  } else {
    let t1 = (rx - x0) / dx;
    let t2 = (rx + rw - x0) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return 1;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y0 < ry || y0 > ry + rh) return 1;
  } else {
    let t1 = (ry - y0) / dy;
    let t2 = (ry + rh - y0) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return 1;
  }
  return tMin;
}
