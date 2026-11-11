// ─────────────────────────────────────────────────────────────
//  Mode « Cristal d'élément »
//   • 3 cristaux apparaissent au centre.
//   • On ramasse un cristal en marchant dessus ; on les lâche tous en mourant.
//   • Une équipe qui porte les 3 cristaux pendant 15 s d'affilée gagne.
//   • Porter un cristal donne un bonus (dégâts + charge du super), mais le
//     porteur est visible de tous (même caché dans un buisson ou le brouillard).
// ─────────────────────────────────────────────────────────────
import { CRYSTAL } from '../config/constants.js';
import { TAU } from './mathx.js';

export class CrystalMode {
  constructor(match) {
    this.m = match;
    this.crystals = match.arena.crystalSpawns.map((p, i) => ({
      id: i,
      x: p.x,
      y: p.y,
      carrierId: -1, // -1 = au sol
      lockT: 0, // délai avant de pouvoir être ramassé
      spawnAt: CRYSTAL.spawnTimes[i] ?? 0, // instant d'apparition (temps de match)
      active: (CRYSTAL.spawnTimes[i] ?? 0) <= 0,
    }));
    /** Cristaux portés par chaque équipe. */
    this.teamCount = [0, 0];
    /** Équipe qui porte actuellement les 3 cristaux (-1 = aucune). */
    this.holdTeam = -1;
    this.holdT = 0;
  }

  /** Secondes restantes avant la victoire de l'équipe qui tient les 3 cristaux. */
  get holdLeft() {
    return this.holdTeam < 0 ? CRYSTAL.holdToWin : Math.max(0, CRYSTAL.holdToWin - this.holdT);
  }

  update(dt) {
    const m = this.m;

    for (const c of this.crystals) {
      if (!c.active) {
        // Pas encore apparu
        if (m.time < c.spawnAt) continue;
        c.active = true;
        m.emit({ type: 'crystalSpawn', crystal: c.id, x: c.x, y: c.y });
      }
      if (c.carrierId >= 0) {
        const carrier = m.fighters[c.carrierId];
        c.x = carrier.x;
        c.y = carrier.y;
        continue;
      }
      if (c.lockT > 0) {
        c.lockT -= dt;
        continue;
      }
      // Ramassage : le combattant vivant le plus proche, s'il touche le cristal
      let best = null;
      let bestD = Infinity;
      for (const f of m.fighters) {
        if (!f.alive) continue;
        const d = Math.hypot(f.x - c.x, f.y - c.y);
        if (d <= f.r + CRYSTAL.pickupRadius && d < bestD) {
          bestD = d;
          best = f;
        }
      }
      if (best) {
        c.carrierId = best.id;
        best.carrying += 1;
        best.crystalsPicked += 1;
        m.emit({ type: 'pickup', id: best.id, team: best.team, crystal: c.id, x: c.x, y: c.y });
      }
    }

    // Décompte par équipe
    this.teamCount[0] = 0;
    this.teamCount[1] = 0;
    for (const c of this.crystals) {
      if (c.carrierId >= 0) this.teamCount[m.fighters[c.carrierId].team] += 1;
    }

    // Compte à rebours de victoire
    const total = this.crystals.length;
    const holder = this.teamCount[0] === total ? 0 : this.teamCount[1] === total ? 1 : -1;
    if (holder !== this.holdTeam) {
      if (this.holdTeam >= 0) m.emit({ type: 'holdBreak', team: this.holdTeam });
      this.holdTeam = holder;
      this.holdT = 0;
      if (holder >= 0) m.emit({ type: 'holdStart', team: holder });
    } else if (holder >= 0) {
      this.holdT += dt;
      if (this.holdT >= CRYSTAL.holdToWin) m.finish(holder, 'hold');
    }
  }

  /** Le combattant lâche tous ses cristaux (à sa mort). */
  dropAll(f) {
    if (f.carrying <= 0) return;
    const m = this.m;
    let k = 0;
    for (const c of this.crystals) {
      if (c.carrierId !== f.id) continue;
      c.carrierId = -1;
      c.lockT = CRYSTAL.dropLock;
      // Les cristaux s'éparpillent un peu autour du point de chute
      const ang = m.rng.range(0, TAU);
      const d = 30 + 12 * k;
      let x = f.x + Math.cos(ang) * d;
      let y = f.y + Math.sin(ang) * d;
      if (m.arena.circleBlocked(x, y, 14)) {
        x = f.x;
        y = f.y;
      }
      const p = m.arena.nearestFreePoint(x, y, 14);
      c.x = p.x;
      c.y = p.y;
      k += 1;
      m.emit({ type: 'drop', crystal: c.id, x: c.x, y: c.y });
    }
    f.carrying = 0;
  }
}
