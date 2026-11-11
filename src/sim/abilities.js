// ─────────────────────────────────────────────────────────────
//  Attaques de base et supers des personnages.
//  Chaque `kind` de config/characters.js correspond à un cas ici.
// ─────────────────────────────────────────────────────────────
import { COMBAT, TILE } from '../config/constants.js';
import { angleDiff, clamp, pointSegmentDist } from './mathx.js';

/** Tire un projectile depuis le bord du combattant, dans la direction `angle`. */
function fireProjectile(m, f, angle, spec, extra = {}) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  return m.spawnProjectile({
    owner: f,
    x: f.x + ux * (f.r + 2),
    y: f.y + uy * (f.r + 2),
    angle,
    speed: spec.speed,
    range: spec.range,
    r: spec.projRadius,
    dmg: spec.dmg,
    pierce: !!spec.pierce,
    chain: spec.chain || null,
    visual: spec.visual,
    kind: 'attack',
    ...extra,
  });
}

function markAction(m, f, angle, lock) {
  f.facing = angle;
  f.facingLockT = lock;
  f.lastCombatT = m.time;
  f.revealT = Math.max(f.revealT, COMBAT.revealTime);
  f.invulnT = 0; // attaquer annule le bouclier de réapparition
}

// ── Attaque de base ──────────────────────────────────────────

/**
 * @returns {'done'|'wait'|'fail'} 'wait' = réessayer au prochain pas (délai en cours)
 */
export function tryAttack(m, f, angle) {
  if (!f.alive) return 'fail';
  if (f.ammo < 1) {
    if (f.isPlayer) m.emit({ type: 'noAmmo', id: f.id });
    return 'fail';
  }
  if (!f.canAct() || f.attackCd > 0 || f.burst) return 'wait';

  const a = f.def.attack;
  if (angle == null) angle = m.autoAimAngle(f, a.range, a.speed) ?? f.facing;
  f.ammo -= 1;
  f.attackCd = a.cooldown;
  markAction(m, f, angle, 0.25);

  if (a.kind === 'spread') {
    for (let i = 0; i < a.count; i++) {
      const off = a.count > 1 ? (i / (a.count - 1) - 0.5) * a.spread : 0;
      fireProjectile(m, f, angle + off, a);
    }
  } else if (a.kind === 'burst') {
    fireProjectile(m, f, angle, a);
    if (a.count > 1) f.burst = { left: a.count - 1, t: a.interval, angle };
  } else {
    fireProjectile(m, f, angle, a);
  }
  m.emit({ type: 'shoot', id: f.id, x: f.x, y: f.y, angle, visual: a.visual });
  return 'done';
}

/** Suite d'une rafale (2ᵉ lame d'Alizé). */
export function updateBurst(m, f, dt) {
  const b = f.burst;
  if (!b) return;
  if (!f.alive || f.stunT > 0) {
    f.burst = null;
    return;
  }
  b.t -= dt;
  while (f.burst && b.t <= 0) {
    fireProjectile(m, f, b.angle, f.def.attack);
    m.emit({ type: 'shoot', id: f.id, x: f.x, y: f.y, angle: b.angle, visual: f.def.attack.visual });
    b.left -= 1;
    if (b.left <= 0) f.burst = null;
    else b.t += f.def.attack.interval;
  }
}

// ── Super ────────────────────────────────────────────────────

/**
 * @param {number|null} angle  direction visée (null = visée automatique)
 * @param {number} power       0…1 : distance de placement pour les supers « posés »
 */
export function trySuper(m, f, angle, power = 1) {
  if (!f.alive || !f.superReady) return 'fail';
  if (!f.canAct()) return 'wait';

  const s = f.def.super;
  const auto = angle == null;
  if (auto) angle = m.autoAimAngle(f, superReach(s), s.speed || 0) ?? f.facing;
  f.superCharge = 0;
  markAction(m, f, angle, 0.3);
  m.emit({ type: 'super', id: f.id, x: f.x, y: f.y, angle, kind: s.kind });

  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const src = { owner: f, team: f.team, kind: 'super' };

  switch (s.kind) {
    // Braz : bombe qui explose et laisse un brasier
    case 'bomb':
      fireProjectile(m, f, angle, s, {
        dmg: 0,
        pierce: false,
        chain: null,
        visual: 'magma',
        kind: 'super',
        explode: { radius: s.radius, dmg: s.dmg, zone: s.zone },
      });
      break;

    // Ondine : zone de soin posée à distance
    case 'healZone': {
      let tx;
      let ty;
      if (auto) {
        // Visée auto : sur l'allié le plus blessé à portée (ou sur soi)
        let best = f;
        for (const ally of m.fighters) {
          if (ally.team !== f.team || !ally.alive || ally === f) continue;
          if (Math.hypot(ally.x - f.x, ally.y - f.y) <= s.range && ally.hpPct < best.hpPct - 0.05) best = ally;
        }
        tx = best.x;
        ty = best.y;
      } else {
        const d = s.range * clamp(power, 0, 1);
        tx = f.x + ux * d;
        ty = f.y + uy * d;
      }
      m.addZone({
        kind: 'source',
        team: f.team,
        owner: f,
        x: clamp(tx, TILE, m.arena.width - TILE),
        y: clamp(ty, TILE, m.arena.height - TILE),
        r: s.radius,
        dur: s.dur,
        allyHps: s.hps,
        enemySlow: s.enemySlow,
        source: 'super',
      });
      break;
    }

    // Dolmen : charge
    case 'dash': {
      const speed = s.dist / s.dur;
      f.dash = { t: s.dur, vx: ux * speed, vy: uy * speed, hit: [], dmg: s.dmg, stun: s.stun, knock: s.knock };
      f.drT = s.drDur;
      f.drFactor = s.dr;
      break;
    }

    // Volta : rayon instantané arrêté par les murs
    case 'beam': {
      const ex = f.x + ux * s.range;
      const ey = f.y + uy * s.range;
      const t = m.arena.raycast(f.x, f.y, ex, ey);
      const bx = f.x + (ex - f.x) * t;
      const by = f.y + (ey - f.y) * t;
      for (const e of m.fighters) {
        if (!e.alive || e.team === f.team) continue;
        if (pointSegmentDist(e.x, e.y, f.x, f.y, bx, by) <= s.width / 2 + e.r) {
          m.damage(e, s.dmg, src);
          m.stun(e, s.stun);
        }
      }
      m.emit({ type: 'beam', x0: f.x, y0: f.y, x1: bx, y1: by, width: s.width });
      break;
    }

    // Alizé : souffle en cône
    case 'gust': {
      for (const e of m.fighters) {
        if (!e.alive || e.team === f.team) continue;
        const dx = e.x - f.x;
        const dy = e.y - f.y;
        const d = Math.hypot(dx, dy);
        if (d > s.range + e.r) continue;
        const close = d < f.r + e.r + 12;
        if (!close && Math.abs(angleDiff(angle, Math.atan2(dy, dx))) > s.halfAngle) continue;
        if (!m.arena.clearLine(f.x, f.y, e.x, e.y)) continue;
        m.damage(e, s.dmg, src);
        const nx = d > 1 ? dx / d : ux;
        const ny = d > 1 ? dy / d : uy;
        m.knockback(e, nx, ny, s.knock, 0.3);
      }
      // Dissipe les projectiles ennemis pris dans le souffle
      for (const p of m.projectiles) {
        if (p.dead || p.team === f.team) continue;
        const dx = p.x - f.x;
        const dy = p.y - f.y;
        const d = Math.hypot(dx, dy);
        if (d > s.range) continue;
        if (d > 40 && Math.abs(angleDiff(angle, Math.atan2(dy, dx))) > s.halfAngle) continue;
        p.dead = true;
        m.emit({ type: 'impact', x: p.x, y: p.y, visual: 'vent', wall: false });
      }
      f.hasteT = s.hasteDur;
      f.hasteFactor = s.haste;
      m.emit({ type: 'gust', x: f.x, y: f.y, angle, range: s.range, halfAngle: s.halfAngle });
      break;
    }

    default:
      break;
  }
  return 'done';
}

/** Portée utile d'un super (sert à la visée automatique et à l'aperçu de visée). */
export function superReach(s) {
  if (s.kind === 'dash') return s.dist;
  return s.range || 300;
}

/** Dégâts de contact pendant la charge de Dolmen. */
export function updateDash(m, f, dt) {
  const d = f.dash;
  if (!d) return;
  const speed = Math.hypot(d.vx, d.vy) || 1;
  for (const e of m.fighters) {
    if (!e.alive || e.team === f.team || d.hit.includes(e.id)) continue;
    if (Math.hypot(e.x - f.x, e.y - f.y) > f.r + e.r + 8) continue;
    d.hit.push(e.id);
    m.damage(e, d.dmg, { owner: f, team: f.team, kind: 'super' });
    m.stun(e, d.stun);
    m.knockback(e, d.vx / speed, d.vy / speed, d.knock, 0.22);
  }
  d.t -= dt;
  if (d.t <= 0) f.dash = null;
}
