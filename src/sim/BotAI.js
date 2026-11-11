// ─────────────────────────────────────────────────────────────
//  BotAI — le « cerveau » d'un bot (allié ou ennemi).
//
//  Toutes les ~0,25 s le bot choisit un OBJECTIF :
//    fuir (PV bas / protéger les 3 cristaux) → ramasser un cristal →
//    chasser le porteur adverse → combattre → se regrouper pour une fusion →
//    escorter le porteur allié → patrouiller au centre.
//  À chaque pas il se déplace vers cet objectif (A* + évitement des dangers),
//  vise avec une erreur volontaire et tire quand la ligne de tir est dégagée.
//
//  Le bot ne « triche » pas : il utilise les mêmes entrées qu'un joueur
//  (direction + actions) et ne voit que ce que match.canSee() lui autorise.
// ─────────────────────────────────────────────────────────────
import { FUSION, TILE } from '../config/constants.js';
import { getFusion } from '../config/fusions.js';
import { LAVA_ON } from './Arena.js';
import { TAU, distObj } from './mathx.js';
import { findPath } from './pathfinding.js';

/** Niveaux de difficulté des bots. */
export const BOT_SKILL = {
  facile: { aimError: 0.3, reaction: 0.7, shotDelay: [0.7, 1.4], lead: 0.4, thinkEvery: 0.35, superChance: 0.25 },
  normal: { aimError: 0.17, reaction: 0.4, shotDelay: [0.45, 1.0], lead: 0.7, thinkEvery: 0.25, superChance: 0.45 },
  difficile: { aimError: 0.08, reaction: 0.22, shotDelay: [0.3, 0.7], lead: 0.95, thinkEvery: 0.18, superChance: 0.7 },
};

export const DIFFICULTIES = [
  { id: 'facile', name: 'Facile' },
  { id: 'normal', name: 'Normal' },
  { id: 'difficile', name: 'Difficile' },
];

export class BotBrain {
  constructor(match, fighter, skillId = 'normal') {
    this.m = match;
    this.f = fighter;
    this.skill = BOT_SKILL[skillId] || BOT_SKILL.normal;
    const rng = match.rng;

    this.thinkT = rng.range(0, 0.3); // décalé pour que les bots ne pensent pas tous au même pas
    this.goal = { type: 'roam' };
    this.fleeing = false;

    // Perception
    this.seen = [];
    this.nearest = null;
    this.nearestD = Infinity;
    this.target = null; // ennemi sur lequel il tire
    this.seenT = 0; // temps depuis qu'il a acquis sa cible (temps de réaction)

    // Déplacement
    this.path = null;
    this.pathI = 0;
    this.pathKey = '';
    this.repathT = 0;
    this.wander = null;
    this.wanderT = 0;
    this.strafe = rng.chance(0.5) ? 1 : -1;
    this.strafeT = rng.range(0.8, 2);
    this.stuckAcc = 0;
    this.stuckN = 0;
    this.lastX = fighter.x;
    this.lastY = fighter.y;
    this.nudgeT = 0;
    this.nudgeAng = 0;
    this.refuge = null; // point de repli retenu
    this.atRefuge = false;

    // Tir
    this.aimErr = 0;
    this.aimErrT = 0;
    this.shotDelay = rng.range(0, 0.5);
    this.wasReady = false;
    this.superHoldT = 0;
  }

  update(dt) {
    const f = this.f;
    const inp = f.input;
    if (!f.alive) {
      inp.mx = 0;
      inp.my = 0;
      inp.aimAngle = null;
      this.path = null;
      this.target = null;
      this.fleeing = false;
      this.atRefuge = false;
      this.refuge = null;
      return;
    }
    this.thinkT -= dt;
    this.repathT -= dt;
    this.shotDelay -= dt;
    this.aimErrT -= dt;
    this.strafeT -= dt;
    this.wanderT -= dt;
    if (this.superHoldT > 0) this.superHoldT -= dt;

    if (this.thinkT <= 0) {
      this.thinkT = this.skill.thinkEvery * this.m.rng.range(0.8, 1.2);
      this.think();
    }
    this.move(dt);
    this.combat(dt);
  }

  // ── Décision ───────────────────────────────────────────────

  think() {
    const { f, m } = this;
    const cm = m.crystalMode;

    // Perception : ennemis réellement visibles
    this.seen = m.fighters.filter((e) => e.team !== f.team && e.alive && m.canSee(f, e));
    this.nearest = null;
    this.nearestD = Infinity;
    for (const e of this.seen) {
      const d = distObj(f, e);
      if (d < this.nearestD) {
        this.nearestD = d;
        this.nearest = e;
      }
    }

    // Cible de tir : à portée, ligne de tir dégagée ; priorité aux porteurs et aux blessés
    const atk = f.def.attack;
    let best = null;
    let bestScore = -Infinity;
    for (const e of this.seen) {
      const d = distObj(f, e);
      if (d > atk.range + e.r || e.invulnT > 0) continue;
      if (!m.arena.clearLine(f.x, f.y, e.x, e.y, atk.projRadius)) continue;
      const score = -d / atk.range - e.hpPct * 0.6 + (e.carrying > 0 ? 0.8 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best !== this.target) {
      this.target = best;
      this.seenT = 0;
    }

    // Objectif
    const myCount = cm.teamCount[f.team];
    const theirCount = cm.teamCount[1 - f.team];
    const threatened = this.nearest && this.nearestD < 520;
    if (f.hpPct < 0.28 && threatened) this.fleeing = true;
    else if (f.hpPct > 0.6 || (!threatened && f.hpPct > 0.45)) this.fleeing = false;

    let goal = null;
    if (this.fleeing) goal = { type: 'flee' };
    if (!goal && f.carrying > 0) {
      // L'équipe tient les 3 cristaux : le porteur se met à l'abri pour gagner
      if (myCount === cm.crystals.length) goal = { type: 'flee' };
      else if (f.hpPct < 0.5 && threatened) goal = { type: 'flee' };
    }
    if (!goal) {
      const c = m.crystalAssign.get(f.id);
      if (c && c.carrierId < 0) goal = { type: 'collect', x: c.x, y: c.y };
    }
    if (!goal && theirCount > 0) {
      // Chasse au porteur adverse (il est visible de tous)
      let carrier = null;
      let score = -Infinity;
      for (const e of m.fighters) {
        if (e.team === f.team || !e.alive || e.carrying <= 0) continue;
        const s = e.carrying * 600 - distObj(f, e);
        if (s > score) {
          score = s;
          carrier = e;
        }
      }
      if (carrier) goal = { type: 'fight', enemy: carrier.id };
    }
    if (!goal && this.nearest) goal = { type: 'fight', enemy: this.nearest.id };
    if (!goal && f.superReady) {
      // Super prêt : se rapprocher d'un coéquipier lui aussi prêt, pour fusionner
      const ally = this.closestAlly((a) => a.superReady);
      if (ally && distObj(f, ally) > FUSION.range * 0.6) goal = { type: 'follow', ally: ally.id, keep: FUSION.range * 0.5 };
    }
    if (!goal && myCount > 0) {
      const ally = this.closestAlly((a) => a.carrying > 0);
      if (ally) goal = { type: 'follow', ally: ally.id, keep: 150 };
    }
    if (!goal) goal = { type: 'roam' };
    if (goal.type !== 'flee') this.atRefuge = false;
    this.goal = goal;

    this.decideSuper();
  }

  closestAlly(filter) {
    const { f, m } = this;
    let best = null;
    let bestD = Infinity;
    for (const a of m.fighters) {
      if (a === f || a.team !== f.team || !a.alive || !filter(a)) continue;
      const d = distObj(f, a);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  /** Utilisation du super et des fusions. */
  decideSuper() {
    const { f, m } = this;
    const rng = m.rng;

    // Le super vient de se charger : si un coéquipier est (presque) prêt lui aussi,
    // on le garde quelques secondes pour tenter une fusion.
    if (f.superReady && !this.wasReady) {
      const mate = this.closestAlly((a) => a.superCharge >= 0.6);
      this.superHoldT = mate ? 6 : 0;
    }
    this.wasReady = f.superReady;
    if (!f.superReady || !f.canAct()) return;

    // FUSION (jamais avec le super du joueur humain : c'est lui qui décide)
    const partner = m.findFusionPartner(f);
    if (partner && !partner.isPlayer) {
      const fu = getFusion(f.element, partner.element);
      if (fu && this.nearest && this.nearestD <= fu.aiRange) {
        if (rng.chance(0.6)) m.queueAction(f.id, { type: 'fusion' });
        return;
      }
      if (f.hpPct > 0.4) return; // les deux sont prêts : on attend une cible
    }
    if (this.superHoldT > 0 && f.hpPct > 0.4) return;
    if (!rng.chance(this.skill.superChance)) return;

    const s = f.def.super;
    const e = this.nearest;
    const d = this.nearestD;
    const reach = f.def.ai.superRange;
    const angleTo = (t) => Math.atan2(t.y - f.y, t.x - f.x);

    switch (s.kind) {
      case 'bomb':
        if (e && d <= reach && m.arena.clearLine(f.x, f.y, e.x, e.y, 10)) {
          const t = d / s.speed;
          const ang = Math.atan2(e.y + e.vy * t * this.skill.lead - f.y, e.x + e.vx * t * this.skill.lead - f.x);
          m.queueAction(f.id, { type: 'super', angle: ang });
        }
        break;
      case 'healZone': {
        // Sur l'allié le plus blessé à portée (soi compris)
        let who = null;
        let worst = 0.55;
        for (const a of m.fighters) {
          if (a.team !== f.team || !a.alive) continue;
          if (distObj(f, a) <= s.range && a.hpPct < worst) {
            worst = a.hpPct;
            who = a;
          }
        }
        if (who) {
          const dist = distObj(f, who);
          m.queueAction(f.id, { type: 'super', angle: who === f ? f.facing : angleTo(who), power: dist / s.range });
        }
        break;
      }
      case 'dash':
        if (e && d <= reach && d > 70 && m.arena.clearLine(f.x, f.y, e.x, e.y, f.r - 2)) {
          m.queueAction(f.id, { type: 'super', angle: angleTo(e) });
        }
        break;
      case 'beam':
        if (e && d <= reach && m.arena.clearLine(f.x, f.y, e.x, e.y, 6)) {
          m.queueAction(f.id, { type: 'super', angle: angleTo(e) + rng.noise() * this.skill.aimError * 0.5 });
        }
        break;
      case 'gust':
        if (e && d <= reach && (f.hpPct < 0.6 || e.carrying > 0 || rng.chance(0.35))) {
          m.queueAction(f.id, { type: 'super', angle: angleTo(e) });
        }
        break;
      default:
        break;
    }
  }

  // ── Déplacement ────────────────────────────────────────────

  move(dt) {
    const { f, m } = this;
    const g = this.goal;
    let mx = 0;
    let my = 0;

    const escape = this.hazardEscape();
    if (escape) {
      mx = escape.x;
      my = escape.y;
    } else if (g.type === 'collect') {
      [mx, my] = this.steerTo(g.x, g.y);
    } else if (g.type === 'flee') {
      [mx, my] = this.fleeMove();
    } else if (g.type === 'follow') {
      const ally = m.fighters[g.ally];
      if (ally && ally.alive && distObj(f, ally) > g.keep) [mx, my] = this.steerTo(ally.x, ally.y);
    } else if (g.type === 'fight') {
      const e = m.fighters[g.enemy];
      if (e && e.alive) [mx, my] = this.fightMove(e);
    } else {
      // Patrouille autour du centre
      if (!this.wander || this.wanderT <= 0 || Math.hypot(this.wander.x - f.x, this.wander.y - f.y) < 60) {
        this.wander = this.pickWanderPoint();
        this.wanderT = m.rng.range(3, 5);
      }
      [mx, my] = this.steerTo(this.wander.x, this.wander.y);
    }

    // Garder ses distances avec les coéquipiers (évite les bots empilés)
    for (const a of m.fighters) {
      if (a === f || a.team !== f.team || !a.alive) continue;
      const d = distObj(f, a);
      if (d < 58 && d > 0.01) {
        const w = 0.7 * (1 - d / 58);
        mx += ((f.x - a.x) / d) * w;
        my += ((f.y - a.y) / d) * w;
      }
    }

    // Ne pas entrer de soi-même dans la lave
    if (!escape && (mx !== 0 || my !== 0) && m.arena.lavaAt(f.x, f.y) !== LAVA_ON) {
      const len = Math.hypot(mx, my);
      const ahead = 44;
      if (m.arena.lavaAt(f.x + (mx / len) * ahead, f.y + (my / len) * ahead) === LAVA_ON) {
        const base = Math.atan2(my, mx);
        let fixed = false;
        for (const off of [0.9, -0.9, 1.6, -1.6]) {
          const a = base + off * this.strafe;
          if (m.arena.lavaAt(f.x + Math.cos(a) * ahead, f.y + Math.sin(a) * ahead) !== LAVA_ON) {
            mx = Math.cos(a) * len;
            my = Math.sin(a) * len;
            fixed = true;
            break;
          }
        }
        if (!fixed) {
          mx = 0;
          my = 0;
        }
      }
    }

    // Détection de blocage : si on n'avance pas, on change de côté / on se dégage
    this.stuckAcc += dt;
    if (this.stuckAcc >= 0.5) {
      const moved = Math.hypot(f.x - this.lastX, f.y - this.lastY);
      const wants = Math.hypot(mx, my) > 0.3 && f.canMove();
      if (wants && moved < 10) {
        this.stuckN += 1;
        this.strafe *= -1;
        this.path = null;
        if (this.stuckN >= 2) {
          this.nudgeT = 0.35;
          this.nudgeAng = m.rng.range(0, TAU);
        }
      } else {
        this.stuckN = 0;
      }
      this.lastX = f.x;
      this.lastY = f.y;
      this.stuckAcc = 0;
    }
    if (this.nudgeT > 0) {
      this.nudgeT -= dt;
      mx = Math.cos(this.nudgeAng);
      my = Math.sin(this.nudgeAng);
    }

    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    f.input.mx = mx;
    f.input.my = my;
  }

  /**
   * Repli : courir vers le point de repli puis, une fois arrivé, rester dans
   * les parages en esquivant (pas d'aller-retour entre fuite et combat).
   */
  fleeMove() {
    const { f, m } = this;
    const p = this.fleePoint();
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const d = Math.hypot(dx, dy);
    // Hystérésis : « arrivé » à moins de 70 px, on ne repart qu'au-delà de 150 px
    if (d < 70) this.atRefuge = true;
    else if (d > 150) this.atRefuge = false;
    if (!this.atRefuge) return this.steerTo(p.x, p.y);

    const e = this.nearest;
    if (!e || this.nearestD > 650) return [0, 0]; // tranquille : on récupère sur place
    // Esquive : pas de côté par rapport à l'ennemi, en restant près du refuge
    if (this.strafeT <= 0) {
      this.strafe *= -1;
      this.strafeT = m.rng.range(0.6, 1.6);
    }
    const ed = this.nearestD || 1;
    const nx = (e.x - f.x) / ed;
    const ny = (e.y - f.y) / ed;
    let mx = -ny * this.strafe * 0.8;
    let my = nx * this.strafe * 0.8;
    if (d > 45) {
      mx += (dx / d) * 0.7;
      my += (dy / d) * 0.7;
    }
    return [mx, my];
  }

  /** Déplacement en combat : s'approcher, garder sa distance préférée, tourner autour. */
  fightMove(e) {
    const { f, m } = this;
    const d = distObj(f, e);
    const pref = f.def.ai.range;
    const visible = m.canSee(f, e);
    const los = visible && m.arena.clearLine(f.x, f.y, e.x, e.y, 8);
    if (!visible || !los || d > pref * 1.15) return this.steerTo(e.x, e.y);

    if (this.strafeT <= 0) {
      this.strafe *= -1;
      this.strafeT = m.rng.range(0.8, 2.2);
    }
    const nx = (e.x - f.x) / (d || 1);
    const ny = (e.y - f.y) / (d || 1);
    // Composante radiale : reculer si trop près, avancer si un peu loin
    let radial = 0;
    if (d < pref * 0.6) radial = -1;
    else if (d < pref * 0.85) radial = -0.35;
    else if (d > pref) radial = 0.5;
    const tangential = this.strafe * 0.9;
    return [nx * radial - ny * tangential, ny * radial + nx * tangential];
  }

  /** Direction (normalisée) pour aller vers (tx, ty) en contournant les murs. */
  steerTo(tx, ty) {
    const { f, m } = this;
    const key = `${Math.floor(tx / TILE)},${Math.floor(ty / TILE)}`;
    if (!this.path || this.pathKey !== key || this.repathT <= 0) {
      this.path = findPath(m.arena, f.x, f.y, tx, ty, { extraCost: (c, r) => this.dangerCost(c, r) });
      this.pathKey = key;
      this.pathI = 0;
      this.repathT = m.rng.range(0.45, 0.7);
    }
    const path = this.path;
    let wx = tx;
    let wy = ty;
    if (path && path.length > 0) {
      while (this.pathI < path.length - 1 && Math.hypot(path[this.pathI].x - f.x, path[this.pathI].y - f.y) < 26) {
        this.pathI += 1;
      }
      // Raccourci : viser le point le plus lointain atteignable en ligne droite
      for (let k = Math.min(path.length - 1, this.pathI + 3); k > this.pathI; k--) {
        if (m.arena.clearLine(f.x, f.y, path[k].x, path[k].y, f.r - 1)) {
          this.pathI = k;
          break;
        }
      }
      wx = path[this.pathI].x;
      wy = path[this.pathI].y;
    }
    const dx = wx - f.x;
    const dy = wy - f.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return [0, 0];
    return [dx / d, dy / d];
  }

  /** Surcoût de chemin pour les cases situées dans une zone ennemie dangereuse. */
  dangerCost(c, r) {
    const { f, m } = this;
    if (m.zones.length === 0) return 0;
    const x = (c + 0.5) * TILE;
    const y = (r + 0.5) * TILE;
    let cost = 0;
    for (const z of m.zones) {
      if (z.team === f.team || (z.enemyDps <= 0 && z.enemySlow >= 1 && !z.enemyBlind)) continue;
      if (Math.hypot(x - z.x, y - z.y) < z.r) cost += 6;
    }
    return cost;
  }

  /**
   * S'il se trouve dans un danger (lave, zone ennemie, impact imminent),
   * renvoie la direction pour en sortir ; sinon null.
   */
  hazardEscape() {
    const { f, m } = this;
    const g = this.goal;
    // Un cristal tout proche vaut bien une petite brûlure
    if (g.type === 'collect' && Math.hypot(g.x - f.x, g.y - f.y) < 150) return null;

    let ex = 0;
    let ey = 0;
    let danger = false;
    const away = (x, y) => {
      let dx = f.x - x;
      let dy = f.y - y;
      let d = Math.hypot(dx, dy);
      if (d < 1) {
        dx = Math.cos(this.nudgeAng || 1);
        dy = Math.sin(this.nudgeAng || 1);
        d = 1;
      }
      ex += dx / d;
      ey += dy / d;
      danger = true;
    };
    for (const z of m.zones) {
      if (z.team === f.team) continue;
      const harmful = z.enemyDps > 0 || z.chill || z.enemyBlind;
      if (harmful && Math.hypot(f.x - z.x, f.y - z.y) < z.r + 10) away(z.x, z.y);
    }
    for (const s of m.strikes) {
      if (s.team === f.team) continue;
      if (Math.hypot(f.x - s.x, f.y - s.y) < s.r + f.r) away(s.x, s.y);
    }
    if (m.arena.lavaAt(f.x, f.y) === LAVA_ON) {
      // Vers la case sans lave la plus proche
      const c0 = m.arena.colOf(f.x);
      const r0 = m.arena.rowOf(f.y);
      let best = null;
      let bestD = Infinity;
      for (let dr = -3; dr <= 3; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
          const c = c0 + dc;
          const r = r0 + dr;
          if (!m.arena.walkable(c, r) || m.arena.lava[m.arena.idx(c, r)] === LAVA_ON) continue;
          const p = m.arena.tileCenter(c, r);
          const d = Math.hypot(p.x - f.x, p.y - f.y);
          if (d < bestD && m.arena.clearLine(f.x, f.y, p.x, p.y)) {
            bestD = d;
            best = p;
          }
        }
      }
      if (best && bestD > 1) {
        ex += ((best.x - f.x) / bestD) * 1.5;
        ey += ((best.y - f.y) / bestD) * 1.5;
        danger = true;
      }
    }
    if (!danger) return null;
    const len = Math.hypot(ex, ey);
    if (len < 0.01) return null;
    return { x: ex / len, y: ey / len };
  }

  /** Point de repli : le point d'apparition allié le plus éloigné des ennemis visibles. */
  fleePoint() {
    const { f, m } = this;
    const spawns = m.arena.spawns[f.team];
    const scoreOf = (s) => {
      let minD = 2000;
      for (const e of this.seen) minD = Math.min(minD, Math.hypot(e.x - s.x, e.y - s.y));
      return minD - Math.hypot(f.x - s.x, f.y - s.y) * 0.3;
    };
    let best = spawns[0];
    let bestScore = -Infinity;
    for (const s of spawns) {
      const score = scoreOf(s);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    // On garde le refuge actuel tant qu'un autre n'est pas nettement meilleur
    if (this.refuge && spawns.includes(this.refuge) && scoreOf(this.refuge) > bestScore - 220) return this.refuge;
    this.refuge = best;
    return best;
  }

  pickWanderPoint() {
    const { f, m } = this;
    const cx = m.arena.width / 2;
    const cy = m.arena.height / 2;
    const side = f.team === 0 ? -1 : 1; // plutôt de son côté du centre
    for (let i = 0; i < 12; i++) {
      const x = cx + side * m.rng.range(0, 260) + m.rng.range(-80, 80);
      const y = cy + m.rng.range(-330, 330);
      if (!m.arena.circleBlocked(x, y, f.r + 4)) return { x, y };
    }
    return { x: cx, y: cy };
  }

  // ── Tir ────────────────────────────────────────────────────

  combat(dt) {
    const { f, m } = this;
    const sk = this.skill;
    f.input.aimAngle = null;
    let e = this.target;
    if (e && (!e.alive || !m.canSee(f, e))) {
      this.target = null;
      e = null;
    }
    if (!e) return;

    const atk = f.def.attack;
    const d = distObj(f, e);
    this.seenT += dt;
    if (this.aimErrT <= 0) {
      this.aimErr = m.rng.noise() * sk.aimError;
      this.aimErrT = m.rng.range(0.3, 0.6);
    }
    // Anticipation du déplacement de la cible + erreur de visée
    const t = d / atk.speed;
    const ax = e.x + e.vx * t * sk.lead;
    const ay = e.y + e.vy * t * sk.lead;
    const ang = Math.atan2(ay - f.y, ax - f.x) + this.aimErr;
    f.input.aimAngle = ang;

    if (
      f.canAct() &&
      f.ammo >= 1 &&
      f.attackCd <= 0 &&
      !f.burst &&
      this.seenT >= sk.reaction &&
      this.shotDelay <= 0 &&
      d <= atk.range + e.r - 10 &&
      m.arena.clearLine(f.x, f.y, e.x, e.y, atk.projRadius)
    ) {
      m.queueAction(f.id, { type: 'attack', angle: ang });
      this.shotDelay = m.rng.range(sk.shotDelay[0], sk.shotDelay[1]);
    }
  }
}
