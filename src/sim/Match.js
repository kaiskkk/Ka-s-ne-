// ─────────────────────────────────────────────────────────────
//  Match — la simulation complète d'une partie d'ÉLÉMENTA.
//
//  Cette classe (et tout le dossier sim/) ne dépend PAS de Phaser : elle
//  avance par pas fixes (step) et publie des événements visuels dans `fx`,
//  que la scène de jeu consomme pour dessiner et jouer les sons.
//  Elle peut donc tourner telle quelle sous Node (tests) ou sur un serveur
//  (futur multijoueur en ligne).
// ─────────────────────────────────────────────────────────────
import { COMBAT, CRYSTAL, FUSION, MATCH, SIM_DT, TEAM_NEUTRAL } from '../config/constants.js';
import { CHARACTERS, CHARACTER_IDS } from '../config/characters.js';
import { ARENA_EVENTS } from '../config/arenaEvents.js';
import { DEFAULT_MAP, MAPS } from '../config/maps.js';
import { Arena, LAVA_ON } from './Arena.js';
import { ArenaDirector } from './ArenaDirector.js';
import { BotBrain } from './BotAI.js';
import { CrystalMode } from './CrystalMode.js';
import { Fighter } from './Fighter.js';
import { Rng } from './rng.js';
import { tryAttack, trySuper, updateBurst, updateDash } from './abilities.js';
import { updateProjectile, updateStrike, updateZone } from './entities.js';
import { performFusion } from './fusionEffects.js';
import { clamp } from './mathx.js';

const TIMER_KEYS = [
  'rootT',
  'slowT',
  'hasteT',
  'drT',
  'blindT',
  'cloakT',
  'revealT',
  'invulnT',
  'attackCd',
  'chillImmuneT',
  'facingLockT',
];

/** Durée pendant laquelle une action du joueur reste « en attente » (confort de jeu). */
const ACTION_BUFFER = 0.2;

export class Match {
  /**
   * @param {object} opts
   * @param {string}  [opts.playerChar]  id du personnage du joueur (null = match 100 % bots)
   * @param {number}  [opts.seed]        graine aléatoire
   * @param {string}  [opts.difficulty]  'facile' | 'normal' | 'difficile' (bots adverses)
   * @param {string}  [opts.mapId]
   * @param {string[][]} [opts.teams]    compositions imposées [[3 ids], [3 ids]] (tests)
   */
  constructor(opts = {}) {
    this.rng = new Rng(opts.seed ?? 12345);
    this.difficulty = opts.difficulty || 'normal';
    this.map = MAPS[opts.mapId || DEFAULT_MAP];
    this.arena = new Arena(this.map);

    this.phase = 'countdown'; // 'countdown' | 'playing' | 'ended'
    this.countdownT = MATCH.countdown;
    this.time = 0; // temps de jeu écoulé (s)
    this.result = null;
    this.teamKills = [0, 0];

    this.fighters = [];
    this.projectiles = [];
    this.zones = [];
    this.strikes = [];
    this.timers = [];
    this.bots = [];
    this.player = null;
    /** File d'événements visuels/sonores, vidée par le rendu à chaque image. */
    this.fx = [];
    this.nextEntityId = 1;
    this.assignT = 0;
    this.crystalAssign = new Map();

    this.setupTeams(opts);
    this.crystalMode = new CrystalMode(this);
    this.director = new ArenaDirector(this);
  }

  get timeLeft() {
    return Math.max(0, MATCH.duration - this.time);
  }

  get crystals() {
    return this.crystalMode.crystals;
  }

  // ── Mise en place ──────────────────────────────────────────

  setupTeams(opts) {
    const playerChar = opts.playerChar && CHARACTERS[opts.playerChar] ? opts.playerChar : null;
    let teams = opts.teams;
    if (!teams) {
      // Équipes de 3 personnages tous différents (toutes les paires peuvent donc fusionner)
      const others = this.rng.shuffle(CHARACTER_IDS.filter((id) => id !== playerChar));
      const allies = playerChar ? [playerChar, others[0], others[1]] : others.slice(0, MATCH.teamSize);
      const enemies = this.rng.shuffle(CHARACTER_IDS).slice(0, MATCH.teamSize);
      teams = [allies, enemies];
    }
    // Le joueur prend le point d'apparition du milieu.
    const slotOrder = [1, 0, 2];
    for (let team = 0; team < 2; team++) {
      teams[team].forEach((charId, i) => {
        const spawns = this.arena.spawns[team];
        const spawn = spawns[slotOrder[i] % spawns.length];
        const isPlayer = team === 0 && i === 0 && !!playerChar;
        const f = new Fighter(this.fighters.length, team, CHARACTERS[charId], spawn, isPlayer);
        this.fighters.push(f);
        if (isPlayer) this.player = f;
        else this.bots.push(new BotBrain(this, f, team === 0 ? 'normal' : this.difficulty));
      });
    }
  }

  // ── Boucle principale ──────────────────────────────────────

  /** Avance la simulation d'un pas fixe. */
  step(dt = SIM_DT) {
    if (this.phase === 'ended') return;

    if (this.phase === 'countdown') {
      for (const f of this.fighters) {
        f.px = f.x;
        f.py = f.y;
        f.pending = null;
      }
      const before = Math.ceil(this.countdownT);
      this.countdownT -= dt;
      const after = Math.ceil(this.countdownT);
      if (this.countdownT <= 0) {
        this.phase = 'playing';
        this.emit({ type: 'go' });
      } else if (after !== before) {
        this.emit({ type: 'countdown', n: after });
      }
      return;
    }

    this.time += dt;

    // 1. Remise à zéro des effets recalculés à chaque pas
    for (const f of this.fighters) {
      f.zoneSlow = 1;
      f.pushX = 0;
      f.pushY = 0;
      f.chilledTick = false;
    }

    // 2. Arène vivante + actions différées
    this.director.update(dt);
    this.arena.updateMovers(dt);
    this.updateTimers(dt);

    // 3. Zones et frappes (elles posent ralentissements, aveuglement, aspiration…)
    for (const z of this.zones) updateZone(this, z, dt);
    for (const s of this.strikes) updateStrike(this, s, dt);
    if (this.phase === 'ended') return;

    // 4. Bots : décision → entrées
    this.assignT -= dt;
    if (this.assignT <= 0) {
      this.assignT = 0.25;
      this.assignCrystals();
    }
    for (const b of this.bots) b.update(dt);

    // 5. Combattants
    for (const f of this.fighters) this.stepFighter(f, dt);

    // 6. Projectiles
    for (const p of this.projectiles) updateProjectile(this, p, dt);

    // 7. Nettoyage
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
    if (this.zones.some((z) => z.dead)) this.zones = this.zones.filter((z) => !z.dead);
    if (this.strikes.some((s) => s.dead)) this.strikes = this.strikes.filter((s) => !s.dead);

    // 8. Cristaux et conditions de victoire
    this.crystalMode.update(dt);
    if (this.phase === 'playing' && this.time >= MATCH.duration) this.finishByTime();
  }

  updateTimers(dt) {
    if (this.timers.length === 0) return;
    const due = [];
    for (const t of this.timers) {
      t.t -= dt;
      if (t.t <= 0) due.push(t);
    }
    if (due.length === 0) return;
    this.timers = this.timers.filter((t) => t.t > 0);
    for (const t of due) t.fn();
  }

  /** Exécute `fn` dans `delay` secondes de temps de jeu. */
  schedule(delay, fn) {
    if (delay <= 0) fn();
    else this.timers.push({ t: delay, fn });
  }

  // ── Combattants ────────────────────────────────────────────

  stepFighter(f, dt) {
    f.px = f.x;
    f.py = f.y;

    if (!f.alive) {
      f.pending = null;
      f.respawnT -= dt;
      if (f.respawnT <= 0) this.respawn(f);
      return;
    }

    // Minuteries d'état
    if (f.stunT > 0) {
      f.stunT -= dt;
      if (f.stunT <= 0) {
        f.stunT = 0;
        f.frozen = false;
      }
    }
    for (const k of TIMER_KEYS) if (f[k] > 0) f[k] = Math.max(0, f[k] - dt);
    if (!f.chilledTick && f.chill > 0) f.chill = Math.max(0, f.chill - dt * 0.6);

    // Munitions, super, régénération
    if (f.ammo < COMBAT.maxAmmo) f.ammo = Math.min(COMBAT.maxAmmo, f.ammo + dt / f.def.attack.reload);
    if (f.superCharge < 1) {
      const rate = COMBAT.passiveSuperPerSec + CRYSTAL.superPerSec * f.carrying;
      f.superCharge = Math.min(1, f.superCharge + rate * dt);
    }
    if (f.hp < f.maxHp && this.time - f.lastCombatT > COMBAT.regenDelay) {
      f.hp = Math.min(f.maxHp, f.hp + f.maxHp * COMBAT.regenRate * dt);
    }

    // Actions demandées (tir, super, fusion)
    this.processActions(f, dt);
    updateBurst(this, f, dt);

    // Déplacement
    let vx = 0;
    let vy = 0;
    if (f.dash) {
      vx = f.dash.vx;
      vy = f.dash.vy;
    } else if (f.canMove()) {
      let mx = f.input.mx;
      let my = f.input.my;
      const len = Math.hypot(mx, my);
      if (len > 1) {
        mx /= len;
        my /= len;
      }
      const speed = f.currentSpeed();
      vx = mx * speed;
      vy = my * speed;
      if (f.facingLockT <= 0) {
        if (f.input.aimAngle != null) f.facing = f.input.aimAngle;
        else if (len > 0.15) f.facing = Math.atan2(my, mx);
      }
    }
    if (f.kbT > 0) {
      vx += f.kbx;
      vy += f.kby;
      f.kbT -= dt;
    }
    vx += f.pushX;
    vy += f.pushY;

    const dx = vx * dt;
    const dy = vy * dt;
    const d = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(d / 10)); // sous-pas : jamais plus de 10 px d'un coup
    for (let i = 0; i < n; i++) {
      f.x += dx / n;
      f.y += dy / n;
      this.arena.resolveCircle(f);
    }
    // Filet de sécurité : jamais à l'intérieur d'un obstacle
    if (this.arena.solidAt(f.x, f.y)) {
      const p = this.arena.nearestFreePoint(f.x, f.y, f.r);
      f.x = p.x;
      f.y = p.y;
    }
    f.x = clamp(f.x, f.r, this.arena.width - f.r);
    f.y = clamp(f.y, f.r, this.arena.height - f.r);
    f.vx = (f.x - f.px) / dt;
    f.vy = (f.y - f.py) / dt;

    if (f.dash) updateDash(this, f, dt);

    // Décor : buisson, lave
    f.inBush = this.arena.isBushAt(f.x, f.y);
    if (this.arena.lavaAt(f.x, f.y) === LAVA_ON) {
      f.lavaAcc += dt;
      while (f.lavaAcc >= 0.25 && f.alive) {
        f.lavaAcc -= 0.25;
        this.damage(f, ARENA_EVENTS.lave.dps * 0.25, { owner: null, team: TEAM_NEUTRAL, kind: 'env' });
      }
    } else {
      f.lavaAcc = 0.15; // le 1er dégât arrive vite quand on entre dans la lave
    }
  }

  respawn(f) {
    f.reset(f.spawn.x, f.spawn.y);
    f.invulnT = MATCH.spawnShield;
    this.emit({ type: 'respawn', id: f.id, x: f.x, y: f.y });
  }

  // ── Actions ────────────────────────────────────────────────

  /**
   * Demande une action pour un combattant.
   *   { type: 'attack', angle }           angle null = visée automatique
   *   { type: 'super',  angle, power }    power 0…1 = distance (supers posés)
   *   { type: 'fusion' }
   */
  queueAction(fighterId, action) {
    const f = this.fighters[fighterId];
    if (!f || !f.alive || this.phase !== 'playing') return;
    if (!f.pending) f.pending = [];
    f.pending.push({ ...action, ttl: ACTION_BUFFER });
  }

  processActions(f, dt) {
    const list = f.pending;
    if (!list || list.length === 0) return;
    const keep = [];
    for (const a of list) {
      let res = 'fail';
      if (a.type === 'attack') res = tryAttack(this, f, a.angle ?? null);
      else if (a.type === 'super') res = trySuper(this, f, a.angle ?? null, a.power ?? 1);
      else if (a.type === 'fusion') res = this.tryFusion(f);
      if (res === 'wait') {
        a.ttl -= dt;
        if (a.ttl > 0) keep.push(a);
      }
    }
    f.pending = keep.length > 0 ? keep : null;
  }

  tryFusion(f) {
    if (!f.alive || !f.superReady) return 'fail';
    if (!f.canAct()) return 'wait';
    const partner = this.findFusionPartner(f);
    if (!partner) return 'fail';
    return performFusion(this, f, partner) ? 'done' : 'fail';
  }

  /**
   * Coéquipier avec lequel `f` peut fusionner maintenant (le plus proche), ou null.
   * Conditions : les deux supers chargés, tous deux en état d'agir, à portée.
   */
  findFusionPartner(f) {
    if (!f.alive || !f.superReady) return null;
    let best = null;
    let bestD = FUSION.range;
    for (const o of this.fighters) {
      if (o === f || o.team !== f.team || !o.alive || !o.superReady || o.stunT > 0) continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d <= bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  // ── Vision ─────────────────────────────────────────────────

  /** `viewer` voit-il `target` ? (buissons, brouillard, aveuglement, camouflage) */
  canSee(viewer, target) {
    if (!target.alive) return false;
    if (viewer.team === target.team) return true;
    if (target.carrying > 0) return true; // un porteur de cristal est visible de tous
    const d = Math.hypot(target.x - viewer.x, target.y - viewer.y);
    if (viewer.blindT > 0) return d < COMBAT.blindVision;
    if (this.arena.fog && d > COMBAT.fogVision) return false;
    if ((target.inBush || target.cloakT > 0) && target.revealT <= 0) {
      // Caché : visible seulement si un membre de l'équipe du spectateur est tout près
      for (const a of this.fighters) {
        if (a.team !== viewer.team || !a.alive) continue;
        if (Math.hypot(target.x - a.x, target.y - a.y) < COMBAT.bushRevealDist) return true;
      }
      return false;
    }
    return true;
  }

  nearestVisibleEnemy(f, maxDist = Infinity) {
    let best = null;
    let bestD = maxDist;
    for (const e of this.fighters) {
      if (e.team === f.team || !e.alive || !this.canSee(f, e)) continue;
      const d = Math.hypot(e.x - f.x, e.y - f.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Visée automatique : angle vers l'ennemi visible le plus proche à portée
   * (de préférence avec une ligne de tir dégagée), en anticipant un peu son
   * déplacement. Renvoie null s'il n'y a personne.
   */
  autoAimAngle(f, range, projSpeed = 0) {
    let best = null;
    let bestScore = Infinity;
    for (const e of this.fighters) {
      if (e.team === f.team || !e.alive || !this.canSee(f, e)) continue;
      const d = Math.hypot(e.x - f.x, e.y - f.y);
      if (d > range + e.r + 40) continue;
      const blocked = !this.arena.clearLine(f.x, f.y, e.x, e.y);
      const score = d + (blocked ? 10000 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (!best) return null;
    let tx = best.x;
    let ty = best.y;
    if (projSpeed > 0) {
      const t = Math.hypot(best.x - f.x, best.y - f.y) / projSpeed;
      tx += best.vx * t * 0.8;
      ty += best.vy * t * 0.8;
    }
    return Math.atan2(ty - f.y, tx - f.x);
  }

  // ── Dégâts, soins, états ───────────────────────────────────

  /**
   * Inflige des dégâts. `src` = { owner: Fighter|null, team, kind }
   * kind : 'attack' (charge le super) | 'super' | 'fusion' | 'env'
   * Renvoie les dégâts réellement infligés.
   */
  damage(target, amount, src = {}) {
    if (!target.alive || amount <= 0 || this.phase === 'ended') return 0;
    if (target.invulnT > 0) return 0;
    const owner = src.owner || null;
    let dmg = amount;
    if (owner) dmg *= 1 + CRYSTAL.damageBonus * owner.carrying; // bonus du porteur
    if (target.drT > 0) dmg *= 1 - target.drFactor;
    dmg = Math.max(1, Math.round(dmg));

    target.hp -= dmg;
    target.lastCombatT = this.time;
    target.revealT = Math.max(target.revealT, COMBAT.revealTime);
    if (owner && owner !== target) {
      target.lastHitBy = owner.id;
      target.lastHitT = this.time;
      owner.damageDealt += dmg;
      if (src.kind === 'attack') {
        owner.superCharge = Math.min(1, owner.superCharge + dmg / owner.def.super.need);
      }
    }
    this.emit({
      type: 'hit',
      id: target.id,
      x: target.x,
      y: target.y,
      amount: dmg,
      kind: src.kind || 'env',
      by: owner ? owner.id : -1,
    });

    if (target.hp <= 0) {
      // Mort par l'arène : on crédite le dernier ennemi qui l'a touché (5 s)
      let killer = owner;
      if (!killer && target.lastHitBy != null && this.time - target.lastHitT < 5) {
        killer = this.fighters[target.lastHitBy];
      }
      this.kill(target, killer);
    }
    return dmg;
  }

  heal(target, amount, healer = null) {
    if (!target.alive || amount <= 0) return 0;
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + amount);
    const done = target.hp - before;
    if (done > 0) {
      if (healer) healer.healingDone += done;
      this.emit({ type: 'heal', id: target.id, x: target.x, y: target.y, amount: done });
    }
    return done;
  }

  stun(target, duration, frozen = false) {
    if (!target.alive || target.invulnT > 0 || duration <= 0) return;
    if (duration >= target.stunT) {
      target.stunT = duration;
      target.frozen = frozen;
    }
    target.dash = null;
    target.burst = null;
    this.emit({ type: 'stun', id: target.id, x: target.x, y: target.y, frozen });
  }

  /** Pousse `target` de `distance` px dans la direction (ux, uy) en `dur` secondes. */
  knockback(target, ux, uy, distance, dur = 0.25) {
    if (!target.alive || target.invulnT > 0) return;
    target.kbx = (ux * distance) / dur;
    target.kby = (uy * distance) / dur;
    target.kbT = dur;
    target.dash = null;
  }

  kill(target, killer = null) {
    if (!target.alive) return;
    target.alive = false;
    target.hp = 0;
    target.deaths += 1;
    target.respawnT = MATCH.respawnTime;
    target.dash = null;
    target.burst = null;
    target.pending = null;
    target.stunT = 0;
    target.frozen = false;
    target.kbT = 0;
    target.vx = 0;
    target.vy = 0;
    this.teamKills[1 - target.team] += 1;
    if (killer && killer.team !== target.team) killer.kills += 1;
    this.crystalMode.dropAll(target);
    this.emit({
      type: 'death',
      id: target.id,
      team: target.team,
      x: target.x,
      y: target.y,
      by: killer ? killer.id : -1,
    });
  }

  /**
   * Explosion : blesse tous les « ennemis » de src.team dans le rayon
   * (tout le monde si src.team est neutre).
   * extra : { stun, visual }
   */
  explode(x, y, radius, dmg, src, extra = {}) {
    this.emit({ type: 'explosion', x, y, r: radius, visual: extra.visual || 'feu', team: src.team });
    for (const f of this.fighters) {
      if (!f.alive) continue;
      if (src.team !== TEAM_NEUTRAL && f.team === src.team) continue;
      if (Math.hypot(f.x - x, f.y - y) > radius + f.r * 0.5) continue;
      if (dmg > 0) this.damage(f, dmg, src);
      if (extra.stun) this.stun(f, extra.stun);
    }
  }

  // ── Création d'entités ─────────────────────────────────────

  spawnProjectile(o) {
    const p = {
      id: this.nextEntityId++,
      ownerId: o.owner.id,
      team: o.owner.team,
      visual: o.visual || 'feu',
      kind: o.kind || 'attack',
      x: o.x,
      y: o.y,
      px: o.x,
      py: o.y,
      vx: Math.cos(o.angle) * o.speed,
      vy: Math.sin(o.angle) * o.speed,
      r: o.r,
      dmg: o.dmg,
      left: o.range,
      pierce: !!o.pierce,
      chain: o.chain || null,
      explode: o.explode || null,
      hit: [],
      age: 0,
      dead: false,
    };
    this.projectiles.push(p);
    return p;
  }

  addZone(o) {
    const z = {
      id: this.nextEntityId++,
      kind: o.kind,
      team: o.team,
      ownerId: o.owner ? o.owner.id : -1,
      x: o.x,
      y: o.y,
      px: o.x,
      py: o.y,
      r: o.r,
      dur: o.dur,
      t: 0,
      tick: o.tick || 0.25,
      tickAcc: 0,
      enemyDps: o.enemyDps || 0,
      allyHps: o.allyHps || 0,
      enemySlow: o.enemySlow ?? 1,
      enemyBlind: !!o.enemyBlind,
      allyCloak: !!o.allyCloak,
      pull: o.pull || 0,
      followId: o.followId ?? -1,
      homing: o.homing || null,
      angle: o.angle || 0,
      chill: o.chill || null,
      endBurst: o.endBurst || null,
      source: o.source || 'super',
      dead: false,
    };
    this.zones.push(z);
    return z;
  }

  addStrike(o) {
    const s = {
      id: this.nextEntityId++,
      kind: o.kind,
      team: o.team,
      ownerId: o.owner ? o.owner.id : -1,
      x: o.x,
      y: o.y,
      r: o.r,
      delay: o.delay,
      total: o.delay,
      dmg: o.dmg,
      stun: o.stun || 0,
      pool: o.pool || null,
      source: o.source || 'env',
      dead: false,
    };
    this.strikes.push(s);
    return s;
  }

  emit(e) {
    this.fx.push(e);
    // Garde-fou si personne ne vide la file (tests sans rendu)
    if (this.fx.length > 4000) this.fx.splice(0, 2000);
  }

  // ── Coordination des bots ──────────────────────────────────

  /** Répartit les cristaux au sol entre les bots de chaque équipe (le plus proche d'abord). */
  assignCrystals() {
    this.crystalAssign.clear();
    const ground = this.crystals.filter((c) => c.active && c.carrierId < 0);
    if (ground.length === 0) return;
    for (let team = 0; team < 2; team++) {
      const pairs = [];
      for (const f of this.fighters) {
        if (f.team !== team || !f.alive || f.isPlayer) continue;
        for (const c of ground) pairs.push({ f, c, d: Math.hypot(f.x - c.x, f.y - c.y) });
      }
      pairs.sort((a, b) => a.d - b.d);
      const usedF = new Set();
      const usedC = new Set();
      for (const p of pairs) {
        if (usedF.has(p.f.id) || usedC.has(p.c.id)) continue;
        usedF.add(p.f.id);
        usedC.add(p.c.id);
        this.crystalAssign.set(p.f.id, p.c);
      }
    }
  }

  // ── Fin de match ───────────────────────────────────────────

  /**
   * @param {number} winner 0, 1, ou -1 (égalité)
   * @param {string} reason 'hold' (3 cristaux gardés 15 s) | 'crystals' | 'kills' | 'draw'
   */
  finish(winner, reason) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.result = {
      winner,
      reason,
      crystals: [...this.crystalMode.teamCount],
      kills: [...this.teamKills],
      time: this.time,
    };
    this.emit({ type: 'end', ...this.result });
  }

  /** Temps écoulé : le plus de cristaux gagne, puis le plus d'éliminations, sinon égalité. */
  finishByTime() {
    const [c0, c1] = this.crystalMode.teamCount;
    if (c0 !== c1) return this.finish(c0 > c1 ? 0 : 1, 'crystals');
    const [k0, k1] = this.teamKills;
    if (k0 !== k1) return this.finish(k0 > k1 ? 0 : 1, 'kills');
    return this.finish(-1, 'draw');
  }
}
