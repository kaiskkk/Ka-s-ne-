// ─────────────────────────────────────────────────────────────
//  Entités « passives » de la simulation :
//   • projectiles  (tirs de base, bombes, orbes de plasma…)
//   • zones        (effets de surface : soin, vapeur, tornade, blizzard…)
//   • frappes      (impacts retardés avec avertissement : météores, foudre)
// ─────────────────────────────────────────────────────────────
import { TILE, TEAM_NEUTRAL } from '../config/constants.js';
import { clamp, rotateToward } from './mathx.js';

// ── Projectiles ──────────────────────────────────────────────

const PROJECTILE_SUBSTEP = 14; // px : évite de traverser un mur ou un ennemi

export function updateProjectile(m, p, dt) {
  p.px = p.x;
  p.py = p.y;
  p.age += dt;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed <= 0) {
    p.dead = true;
    return;
  }
  const ux = p.vx / speed;
  const uy = p.vy / speed;
  let remaining = Math.min(speed * dt, p.left);

  while (remaining > 0 && !p.dead) {
    const step = Math.min(remaining, PROJECTILE_SUBSTEP);
    p.x += ux * step;
    p.y += uy * step;
    remaining -= step;
    p.left -= step;

    // Mur ?
    if (m.arena.solidAt(p.x, p.y)) {
      // Une bombe explose juste devant le mur, pas dedans.
      if (p.explode) detonate(m, p, p.x - ux * step, p.y - uy * step);
      m.emit({ type: 'impact', x: p.x, y: p.y, visual: p.visual, wall: true });
      p.dead = true;
      return;
    }

    // Combattant ennemi ?
    for (const f of m.fighters) {
      if (!f.alive || f.team === p.team || p.hit.includes(f.id)) continue;
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      const rr = p.r + f.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      p.hit.push(f.id);
      if (p.dmg > 0) m.damage(f, p.dmg, { owner: m.fighters[p.ownerId], team: p.team, kind: p.kind });
      m.emit({ type: 'impact', x: p.x, y: p.y, visual: p.visual, wall: false });
      if (p.chain) chainLightning(m, p, f);
      if (p.explode) {
        detonate(m, p, p.x, p.y);
        p.dead = true;
        return;
      }
      if (!p.pierce) {
        p.dead = true;
        return;
      }
    }
  }

  if (!p.dead && p.left <= 0) {
    if (p.explode) detonate(m, p, p.x, p.y);
    p.dead = true;
  }
}

function detonate(m, p, x, y) {
  const e = p.explode;
  const owner = m.fighters[p.ownerId];
  m.explode(x, y, e.radius, e.dmg, { owner, team: p.team, kind: p.kind }, { visual: p.visual });
  if (e.zone) {
    m.addZone({
      kind: 'brasier',
      team: p.team,
      owner,
      x,
      y,
      r: e.radius,
      dur: e.zone.dur,
      enemyDps: e.zone.dps,
      source: p.kind,
    });
  }
}

/** L'éclair de Volta rebondit sur l'ennemi le plus proche de la première cible. */
function chainLightning(m, p, first) {
  let best = null;
  let bestD = p.chain.radius;
  for (const f of m.fighters) {
    if (!f.alive || f.team === p.team || f === first || p.hit.includes(f.id)) continue;
    const d = Math.hypot(f.x - first.x, f.y - first.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  if (!best) return;
  p.hit.push(best.id);
  m.emit({ type: 'chain', x0: first.x, y0: first.y, x1: best.x, y1: best.y });
  m.damage(best, p.dmg * p.chain.factor, { owner: m.fighters[p.ownerId], team: p.team, kind: p.kind });
}

// ── Zones ────────────────────────────────────────────────────

/**
 * Une zone agit sur les combattants à l'intérieur de son rayon.
 * « Ennemi » = équipe différente de z.team (tout le monde si z.team est neutre).
 */
export function updateZone(m, z, dt) {
  z.px = z.x;
  z.py = z.y;
  z.t += dt;

  // Zone attachée à un combattant (tempête de sable)
  if (z.followId >= 0) {
    const o = m.fighters[z.followId];
    if (o.alive) {
      z.x = o.x;
      z.y = o.y;
    } else {
      z.dead = true;
      return;
    }
  }

  // Zone mobile qui pourchasse l'ennemi le plus proche (tornade)
  if (z.homing) {
    let target = null;
    let best = Infinity;
    for (const f of m.fighters) {
      if (!f.alive || f.team === z.team || f.invulnT > 0) continue;
      const d = Math.hypot(f.x - z.x, f.y - z.y);
      if (d < best) {
        best = d;
        target = f;
      }
    }
    if (target) {
      const want = Math.atan2(target.y - z.y, target.x - z.x);
      z.angle = rotateToward(z.angle, want, z.homing.turn * dt);
    }
    z.x = clamp(z.x + Math.cos(z.angle) * z.homing.speed * dt, TILE, m.arena.width - TILE);
    z.y = clamp(z.y + Math.sin(z.angle) * z.homing.speed * dt, TILE, m.arena.height - TILE);
  }

  // Effets continus
  z.tickAcc += dt;
  const doTick = z.tickAcc >= z.tick;
  if (doTick) z.tickAcc -= z.tick;
  const owner = z.ownerId >= 0 ? m.fighters[z.ownerId] : null;

  for (const f of m.fighters) {
    if (!f.alive) continue;
    const dx = z.x - f.x;
    const dy = z.y - f.y;
    const d = Math.hypot(dx, dy);
    if (d > z.r) continue;
    const enemy = z.team === TEAM_NEUTRAL || f.team !== z.team;

    if (enemy) {
      if (f.invulnT > 0) continue;
      if (z.enemySlow < 1) f.zoneSlow = Math.min(f.zoneSlow, z.enemySlow);
      if (z.enemyBlind) f.blindT = Math.max(f.blindT, 0.25);
      if (z.pull > 0 && d > 18) {
        f.pushX += (dx / d) * z.pull;
        f.pushY += (dy / d) * z.pull;
      }
      if (z.chill && f.chillImmuneT <= 0 && f.stunT <= 0) {
        f.chilledTick = true;
        f.chill += dt;
        if (f.chill >= z.chill.time) {
          f.chill = 0;
          f.chillImmuneT = z.chill.freeze + 2.5;
          m.stun(f, z.chill.freeze, true);
        }
      }
      if (doTick && z.enemyDps > 0) {
        m.damage(f, z.enemyDps * z.tick, { owner, team: z.team, kind: z.source });
      }
    } else {
      if (z.allyCloak) f.cloakT = Math.max(f.cloakT, 0.25);
      if (doTick && z.allyHps > 0) m.heal(f, z.allyHps * z.tick, owner);
    }
  }

  if (z.t >= z.dur) {
    if (z.endBurst) {
      m.explode(
        z.x,
        z.y,
        z.endBurst.radius,
        z.endBurst.dmg,
        { owner, team: z.team, kind: z.source },
        { stun: z.endBurst.stun, visual: 'foudre' },
      );
    }
    z.dead = true;
  }
}

// ── Frappes retardées ────────────────────────────────────────

export function updateStrike(m, s, dt) {
  s.delay -= dt;
  if (s.delay > 0) return;
  const owner = s.ownerId >= 0 ? m.fighters[s.ownerId] : null;
  m.explode(s.x, s.y, s.r, s.dmg, { owner, team: s.team, kind: s.source }, { stun: s.stun, visual: s.kind });
  if (s.pool) {
    m.addZone({
      kind: 'lave',
      team: s.team,
      owner,
      x: s.x,
      y: s.y,
      r: s.r,
      dur: s.pool.dur,
      enemyDps: s.pool.dps,
      source: s.source,
    });
  }
  s.dead = true;
}
