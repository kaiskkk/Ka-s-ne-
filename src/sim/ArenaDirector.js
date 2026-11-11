// ─────────────────────────────────────────────────────────────
//  ArenaDirector — orchestre les événements de l'« arène vivante » :
//  avertissement (3 s) → effet actif (20 s) → fin, toutes les 30 s.
// ─────────────────────────────────────────────────────────────
import { ARENA_EVENT, MATCH, TEAM_NEUTRAL, TILE } from '../config/constants.js';
import { ARENA_EVENTS, ARENA_EVENT_IDS } from '../config/arenaEvents.js';
import { LAVA_ON, LAVA_WARN, T_FLOOR } from './Arena.js';
import { TAU, clamp } from './mathx.js';

export class ArenaDirector {
  constructor(match) {
    this.m = match;
    /** Ordre des événements pour ce match (tirage sans remise). */
    this.order = match.rng.shuffle(ARENA_EVENT_IDS);
    this.index = 0;
    /** Événement en cours : { id, def, phase: 'warning'|'active', t } ou null. */
    this.current = null;
  }

  /** Instant (temps de match écoulé) du prochain événement, ou Infinity. */
  get nextAt() {
    const t = ARENA_EVENT.interval * (this.index + 1);
    return t < MATCH.duration ? t : Infinity;
  }

  update(dt) {
    const m = this.m;
    if (!this.current) {
      if (m.time >= this.nextAt) this.begin(this.order[this.index % this.order.length]);
      return;
    }
    const ev = this.current;
    ev.t += dt;
    if (ev.phase === 'warning') {
      if (ev.t >= ARENA_EVENT.warning) {
        ev.phase = 'active';
        ev.t = 0;
        this.onStart(ev);
        m.emit({ type: 'arenaEvent', phase: 'start', id: ev.id });
      }
    } else {
      this.onTick(ev, dt);
      if (ev.t >= ARENA_EVENT.duration) this.end();
    }
  }

  /** Lance un événement (phase d'avertissement). Sert aussi aux tests / au mode debug. */
  begin(id) {
    if (this.current) this.end();
    const def = ARENA_EVENTS[id];
    if (!def) return;
    this.index += 1;
    this.current = { id, def, phase: 'warning', t: 0, acc: 0, tiles: null };
    this.onWarn(this.current);
    this.m.emit({ type: 'arenaEvent', phase: 'warning', id });
  }

  end() {
    const ev = this.current;
    if (!ev) return;
    const a = this.m.arena;
    if (ev.id === 'lave') a.clearLava();
    else if (ev.id === 'brouillard') a.fog = false;
    else if (ev.id === 'murs') a.setMoversState('hidden');
    this.current = null;
    this.m.emit({ type: 'arenaEvent', phase: 'end', id: ev.id });
  }

  // ── Phases ─────────────────────────────────────────────────

  onWarn(ev) {
    const a = this.m.arena;
    if (ev.id === 'lave') {
      ev.tiles = this.pickLavaTiles(ev.def);
      a.setLava(ev.tiles, LAVA_WARN);
    } else if (ev.id === 'murs') {
      a.setMoversState('warning');
    }
  }

  onStart(ev) {
    const a = this.m.arena;
    if (ev.id === 'lave') a.setLava(ev.tiles, LAVA_ON);
    else if (ev.id === 'brouillard') a.fog = true;
    else if (ev.id === 'murs') a.setMoversState('active');
  }

  onTick(ev, dt) {
    if (ev.id !== 'orage') return;
    ev.acc += dt;
    while (ev.acc >= ev.def.every) {
      ev.acc -= ev.def.every;
      this.spawnBolt(ev.def);
    }
  }

  // ── Lave : flaques aléatoires, symétriques (équitable pour les 2 équipes) ──

  pickLavaTiles(def) {
    const { arena, rng } = this.m;
    const { cols, rows } = arena;
    const mid = (cols - 1) / 2;
    const set = new Set();
    const isFloor = (c, r) => arena.tileType(c, r) === T_FLOOR;
    for (let b = 0; b < def.blobs; b++) {
      // Graine de la flaque : une case de sol, loin des points d'apparition
      let c = 0;
      let r = 0;
      let ok = false;
      for (let tries = 0; tries < 30 && !ok; tries++) {
        c = rng.int(6, mid);
        r = rng.int(1, rows - 2);
        ok = isFloor(c, r);
      }
      if (!ok) continue;
      const size = rng.int(def.blobSize[0], def.blobSize[1]);
      let count = 0;
      for (let i = 0; i < size * 4 && count < size; i++) {
        const idx = arena.idx(c, r);
        if (!set.has(idx)) {
          set.add(idx);
          count += 1;
        }
        // Marche aléatoire vers une case de sol voisine
        const [dc, dr] = rng.pick([
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]);
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 5 && nc <= mid && isFloor(nc, nr)) {
          c = nc;
          r = nr;
        }
      }
    }
    // Symétrie miroir
    for (const idx of [...set]) {
      const c = idx % cols;
      const r = (idx - c) / cols;
      set.add(arena.idx(cols - 1 - c, r));
    }
    return [...set];
  }

  // ── Orage : éclairs avec cercle d'avertissement ──

  spawnBolt(def) {
    const m = this.m;
    const { arena, rng } = m;
    let x;
    let y;
    const alive = m.fighters.filter((f) => f.alive);
    if (alive.length > 0 && rng.chance(0.6)) {
      // Près d'un combattant au hasard (les deux équipes sont visées pareil)
      const f = rng.pick(alive);
      const ang = rng.range(0, TAU);
      const d = rng.range(0, 130);
      x = f.x + Math.cos(ang) * d;
      y = f.y + Math.sin(ang) * d;
    } else {
      x = rng.range(TILE, arena.width - TILE);
      y = rng.range(TILE, arena.height - TILE);
    }
    m.addStrike({
      kind: 'foudre',
      team: TEAM_NEUTRAL,
      owner: null,
      x: clamp(x, TILE, arena.width - TILE),
      y: clamp(y, TILE, arena.height - TILE),
      r: def.radius,
      delay: def.delay,
      dmg: def.dmg,
      source: 'env',
    });
  }
}
