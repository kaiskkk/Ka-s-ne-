// ─────────────────────────────────────────────────────────────
//  FUSIONS — exécution des 10 combos (paramètres : config/fusions.js).
// ─────────────────────────────────────────────────────────────
import { COMBAT, FUSION, TILE } from '../config/constants.js';
import { getFusion } from '../config/fusions.js';
import { TAU, clamp } from './mathx.js';

/**
 * Déclenche la fusion entre `a` (le lanceur) et `b` (son partenaire).
 * Les deux supers sont consommés. Renvoie la définition de la fusion, ou null.
 */
export function performFusion(m, a, b) {
  const fu = getFusion(a.element, b.element);
  if (!fu) return null;

  a.superCharge = 0;
  b.superCharge = 0;
  for (const f of [a, b]) {
    f.lastCombatT = m.time;
    f.revealT = Math.max(f.revealT, COMBAT.revealTime);
    f.invulnT = 0;
  }

  // Direction : vers l'ennemi visible le plus proche, sinon droit devant.
  const target = m.nearestVisibleEnemy(a, 650);
  const angle = target ? Math.atan2(target.y - a.y, target.x - a.x) : a.facing;
  a.facing = angle;
  a.facingLockT = 0.3;

  let tx = a.x;
  let ty = a.y;
  if (fu.place === 'target') {
    const d = target
      ? Math.min(Math.hypot(target.x - a.x, target.y - a.y), FUSION.targetRange)
      : FUSION.targetRange * 0.6;
    tx = clamp(a.x + Math.cos(angle) * d, TILE, m.arena.width - TILE);
    ty = clamp(a.y + Math.sin(angle) * d, TILE, m.arena.height - TILE);
  }

  m.emit({ type: 'fusion', key: fu.key, kind: fu.kind, name: fu.name, team: a.team, a: a.id, b: b.id, x: tx, y: ty });

  const src = { owner: a, team: a.team, kind: 'fusion' };
  const zoneBase = { team: a.team, owner: a, x: tx, y: ty, r: fu.radius, dur: fu.dur, source: 'fusion' };

  switch (fu.kind) {
    // Feu + Eau : nuage qui aveugle
    case 'vapeur':
      m.addZone({ ...zoneBase, kind: 'vapeur', enemyDps: fu.dps, enemyBlind: true });
      break;

    // Terre + Foudre : onde de choc étourdissante
    case 'seisme':
      m.explode(a.x, a.y, fu.radius, fu.dmg, src, { stun: fu.stun, visual: 'seisme' });
      break;

    // Vent + Feu : tornade qui pourchasse
    case 'tornade':
      m.addZone({
        ...zoneBase,
        kind: 'tornade',
        enemyDps: fu.dps,
        tick: 0.2,
        pull: fu.pull,
        homing: { speed: fu.speed, turn: fu.turn },
        angle,
      });
      break;

    // Feu + Terre : pluie de roches en fusion
    case 'eruption':
      for (let i = 0; i < fu.count; i++) {
        let x = tx;
        let y = ty;
        if (i > 0) {
          const ang = m.rng.range(0, TAU);
          const d = Math.sqrt(m.rng.next()) * fu.radius;
          x = clamp(tx + Math.cos(ang) * d, TILE, m.arena.width - TILE);
          y = clamp(ty + Math.sin(ang) * d, TILE, m.arena.height - TILE);
        }
        m.addStrike({
          kind: 'meteore',
          team: a.team,
          owner: a,
          x,
          y,
          r: fu.impactRadius,
          delay: fu.delay + (i / Math.max(1, fu.count - 1)) * fu.over,
          dmg: fu.dmg,
          pool: fu.pool,
          source: 'fusion',
        });
      }
      break;

    // Feu + Foudre : couronnes d'orbes perçants
    case 'plasma':
      for (let w = 0; w < fu.waves; w++) {
        const offset = (w * Math.PI) / fu.count;
        m.schedule(w * fu.waveDelay, () => {
          if (!a.alive) return;
          for (let i = 0; i < fu.count; i++) {
            const ang = offset + (i / fu.count) * TAU;
            m.spawnProjectile({
              owner: a,
              x: a.x + Math.cos(ang) * (a.r + 2),
              y: a.y + Math.sin(ang) * (a.r + 2),
              angle: ang,
              speed: fu.speed,
              range: fu.range,
              r: fu.projRadius,
              dmg: fu.dmg,
              pierce: true,
              visual: 'plasma',
              kind: 'fusion',
            });
          }
          m.emit({ type: 'ring', x: a.x, y: a.y, r: 90, visual: 'plasma' });
        });
      }
      break;

    // Eau + Terre : bourbier
    case 'marecage':
      m.addZone({ ...zoneBase, kind: 'marecage', enemyDps: fu.dps, enemySlow: fu.slow });
      for (const e of m.fighters) {
        if (!e.alive || e.team === a.team || e.invulnT > 0) continue;
        if (Math.hypot(e.x - tx, e.y - ty) <= fu.radius) e.rootT = Math.max(e.rootT, fu.root);
      }
      break;

    // Eau + Foudre : nappe électrifiée
    case 'maree':
      m.addZone({ ...zoneBase, kind: 'maree', enemyDps: fu.dps, enemySlow: fu.slow, tick: 0.5 });
      break;

    // Eau + Vent : blizzard qui gèle
    case 'blizzard':
      m.addZone({
        ...zoneBase,
        kind: 'blizzard',
        enemyDps: fu.dps,
        enemySlow: fu.slow,
        chill: { time: fu.chillTime, freeze: fu.freeze },
      });
      break;

    // Terre + Vent : tempête de sable qui suit le lanceur
    case 'sable':
      m.addZone({
        ...zoneBase,
        kind: 'sable',
        x: a.x,
        y: a.y,
        enemyDps: fu.dps,
        enemySlow: fu.slow,
        allyCloak: true,
        followId: a.id,
      });
      break;

    // Foudre + Vent : cyclone aspirant
    case 'cyclone':
      m.addZone({ ...zoneBase, kind: 'cyclone', enemyDps: fu.dps, pull: fu.pull, endBurst: fu.endBurst });
      break;

    default:
      break;
  }
  return fu;
}
