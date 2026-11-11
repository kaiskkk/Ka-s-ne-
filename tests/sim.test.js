// Tests de la simulation (sans navigateur) :  npm test
import test from 'node:test';
import assert from 'node:assert/strict';

import { CHARACTERS, CHARACTER_IDS } from '../src/config/characters.js';
import { ARENA_EVENT, COMBAT, CRYSTAL, FUSION, MATCH, SIM_DT, TILE } from '../src/config/constants.js';
import { ELEMENT_IDS } from '../src/config/elements.js';
import { FUSIONS, fusionKey, fusionsFor, getFusion } from '../src/config/fusions.js';
import { ARENA_EVENT_IDS } from '../src/config/arenaEvents.js';
import { DEFAULT_MAP, MAPS } from '../src/config/maps.js';
import { Arena, LAVA_NONE, LAVA_ON, LAVA_WARN, T_FLOOR, T_WALL } from '../src/sim/Arena.js';
import { Match } from '../src/sim/Match.js';
import { findPath } from '../src/sim/pathfinding.js';

// ── Outils ───────────────────────────────────────────────────

const OPEN_Y = 4.5 * TILE; // la ligne 4 est entièrement dégagée (rail)

/** Match « bac à sable » : pas de bots, pas de compte à rebours, pas d'événements. */
function sandbox(teams = [['braz', 'ondine', 'dolmen'], ['volta', 'alize', 'braz']], seed = 1) {
  const m = new Match({ seed, playerChar: null, teams });
  m.bots = [];
  m.phase = 'playing';
  m.director.index = 99; // plus aucun événement programmé
  return m;
}

function run(m, seconds) {
  const n = Math.round(seconds / SIM_DT);
  for (let i = 0; i < n && m.phase !== 'ended'; i++) m.step(SIM_DT);
}

function place(f, x, y = OPEN_Y) {
  f.x = f.px = x;
  f.y = f.py = y;
}

/** Éloigne tout le monde dans un coin, sauf les combattants listés. */
function isolate(m, keep) {
  let i = 0;
  for (const f of m.fighters) {
    if (keep.includes(f)) continue;
    place(f, (2.5 + (i % 3)) * TILE, 17.5 * TILE);
    f.invulnT = 9999; // spectateurs intouchables
    i++;
  }
}

function fxOf(m, type) {
  return m.fx.filter((e) => e.type === type);
}

// ── Carte ────────────────────────────────────────────────────

test('carte : symétrique, 3 apparitions par équipe, 3 cristaux au centre', () => {
  const a = new Arena(MAPS[DEFAULT_MAP]);
  assert.equal(a.cols, 33);
  assert.equal(a.rows, 19);
  for (let r = 0; r < a.rows; r++) {
    for (let c = 0; c < a.cols; c++) {
      assert.equal(a.tileType(c, r), a.tileType(a.cols - 1 - c, r), `asymétrie en (${c}, ${r})`);
    }
  }
  assert.equal(a.spawns[0].length, 3);
  assert.equal(a.spawns[1].length, 3);
  assert.equal(a.crystalSpawns.length, CRYSTAL.count);
  for (const p of a.crystalSpawns) assert.equal(a.colOf(p.x), (a.cols - 1) / 2);
  // Bordure entièrement murée
  for (let c = 0; c < a.cols; c++) assert.ok(a.isWall(c, 0) && a.isWall(c, a.rows - 1));
  for (let r = 0; r < a.rows; r++) assert.ok(a.isWall(0, r) && a.isWall(a.cols - 1, r));
});

test('carte : toutes les cases libres sont accessibles depuis une base', () => {
  const a = new Arena(MAPS[DEFAULT_MAP]);
  const seen = new Uint8Array(a.cols * a.rows);
  const start = a.spawns[0][0];
  const queue = [[a.colOf(start.x), a.rowOf(start.y)]];
  seen[a.idx(queue[0][0], queue[0][1])] = 1;
  while (queue.length) {
    const [c, r] = queue.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (a.isWall(nc, nr) || seen[a.idx(nc, nr)]) continue;
      seen[a.idx(nc, nr)] = 1;
      queue.push([nc, nr]);
    }
  }
  for (let r = 0; r < a.rows; r++) {
    for (let c = 0; c < a.cols; c++) {
      if (!a.isWall(c, r)) assert.ok(seen[a.idx(c, r)], `case isolée (${c}, ${r})`);
    }
  }
});

test('carte : les rails des murs mobiles sont dégagés et laissent une issue', () => {
  const a = new Arena(MAPS[DEFAULT_MAP]);
  assert.ok(a.movers.length >= 4);
  for (const m of a.movers) {
    const c0 = Math.min(m.ax, m.bx) / TILE;
    const c1 = (Math.max(m.ax, m.bx) + m.w) / TILE - 1;
    const r0 = Math.min(m.ay, m.by) / TILE;
    const r1 = (Math.max(m.ay, m.by) + m.h) / TILE - 1;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) assert.equal(a.tileType(c, r), T_FLOOR, `rail encombré en (${c}, ${r})`);
    }
    // Une case libre au-delà de chaque bout du rail (on ne peut pas être écrasé)
    if (m.ay === m.by) {
      for (let r = r0; r <= r1; r++) assert.ok(!a.isWall(c0 - 1, r) && !a.isWall(c1 + 1, r));
    } else {
      for (let c = c0; c <= c1; c++) assert.ok(!a.isWall(c, r0 - 1) && !a.isWall(c, r1 + 1));
    }
  }
});

// ── Géométrie ────────────────────────────────────────────────

test('collisions : un combattant ne traverse jamais un mur', () => {
  const m = sandbox();
  const f = m.fighters[0];
  for (const [mx, my] of [[-1, 0], [0, -1], [1, 1], [-1, -1], [1, 0], [0, 1]]) {
    f.input.mx = mx;
    f.input.my = my;
    for (let i = 0; i < 240; i++) {
      m.step(SIM_DT);
      assert.ok(!m.arena.circleBlocked(f.x, f.y, f.r - 0.5), `dans un mur en (${f.x}, ${f.y})`);
    }
  }
});

test('lancer de rayon : arrêté par un mur, libre en terrain dégagé', () => {
  const a = new Arena(MAPS[DEFAULT_MAP]);
  assert.equal(a.raycast(2 * TILE, OPEN_Y, 20 * TILE, OPEN_Y), 1);
  // Le mur (14, 9) coupe la ligne centrale
  const t = a.raycast(10.5 * TILE, 9.5 * TILE, 16.5 * TILE, 9.5 * TILE);
  assert.ok(t < 1);
  assert.ok(Math.abs(10.5 * TILE + t * 6 * TILE - 14 * TILE) < 0.01, 'le rayon doit s’arrêter sur la face du mur');
  assert.equal(a.clearLine(10.5 * TILE, 9.5 * TILE, 16.5 * TILE, 9.5 * TILE), false);
});

test('recherche de chemin : relie les deux bases en évitant les murs', () => {
  const a = new Arena(MAPS[DEFAULT_MAP]);
  const s = a.spawns[0][1];
  const g = a.spawns[1][1];
  const path = findPath(a, s.x, s.y, g.x, g.y);
  assert.ok(path && path.length > 10);
  let prev = s;
  for (const p of path) {
    assert.ok(!a.isWall(a.colOf(p.x), a.rowOf(p.y)));
    assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < TILE * 1.5, 'les étapes doivent être voisines');
    prev = p;
  }
  assert.deepEqual(path[path.length - 1], { x: g.x, y: g.y });
  // Vers un mur : on aboutit à la case libre la plus proche
  assert.ok(findPath(a, s.x, s.y, 14.5 * TILE, 9.5 * TILE));
});

// ── Personnages ──────────────────────────────────────────────

test('5 personnages, un par élément, stats différentes', () => {
  assert.equal(CHARACTER_IDS.length, 5);
  assert.deepEqual([...new Set(CHARACTER_IDS.map((id) => CHARACTERS[id].element))].sort(), [...ELEMENT_IDS].sort());
  for (const key of ['hp', 'speed']) {
    assert.ok(new Set(CHARACTER_IDS.map((id) => CHARACTERS[id][key])).size >= 4, `stat ${key} trop uniforme`);
  }
  assert.equal(new Set(CHARACTER_IDS.map((id) => CHARACTERS[id].attack.range)).size, 5);
});

for (const id of CHARACTER_IDS) {
  test(`${CHARACTERS[id].name} : l'attaque de base touche, consomme une munition et charge le super`, () => {
    const m = sandbox([[id, ...CHARACTER_IDS.filter((c) => c !== id).slice(0, 2)], ['dolmen', 'ondine', 'volta']]);
    const f = m.fighters[0];
    const e = m.fighters[3];
    isolate(m, [f, e]);
    place(f, 10 * TILE);
    place(e, 10 * TILE + 150);
    const charge0 = f.superCharge;
    m.queueAction(f.id, { type: 'attack', angle: 0 });
    m.step(SIM_DT);
    assert.ok(f.ammo < COMBAT.maxAmmo, 'une munition doit être consommée');
    run(m, 0.8);
    assert.ok(e.hp < e.maxHp, 'la cible doit être blessée');
    assert.ok(f.superCharge > charge0 + 0.05, 'le super doit se charger');
    assert.ok(f.damageDealt > 0);
    run(m, 6);
    assert.equal(f.ammo, COMBAT.maxAmmo, 'les munitions se rechargent');
  });
}

test('tirer sans munition est refusé', () => {
  const m = sandbox();
  const f = m.fighters[0];
  f.ammo = 0.5;
  m.queueAction(f.id, { type: 'attack', angle: 0 });
  m.step(SIM_DT);
  assert.equal(m.projectiles.length, 0);
});

test('super de Braz : explosion + brasier au sol', () => {
  const m = sandbox();
  const [f, e] = [m.fighters[0], m.fighters[3]];
  isolate(m, [f, e]);
  place(f, 10 * TILE);
  place(e, 10 * TILE + 250);
  f.superCharge = 1;
  m.queueAction(f.id, { type: 'super', angle: 0 });
  run(m, 1);
  assert.equal(f.superCharge < 0.1, true);
  assert.ok(e.maxHp - e.hp >= CHARACTERS.braz.super.dmg, 'l’explosion doit blesser');
  assert.ok(m.zones.some((z) => z.kind === 'brasier'));
});

test('super d’Ondine : soigne les alliés, pas les ennemis', () => {
  const m = sandbox();
  const [braz, ondine] = m.fighters;
  const e = m.fighters[3];
  isolate(m, [braz, ondine, e]);
  place(ondine, 10 * TILE);
  place(braz, 10 * TILE + 200);
  place(e, 10 * TILE + 230);
  braz.hp = 1000;
  e.hp = 1000;
  braz.lastCombatT = e.lastCombatT = 1e9; // pas de régénération naturelle
  ondine.superCharge = 1;
  m.queueAction(ondine.id, { type: 'super', angle: null }); // visée auto → sur l'allié blessé
  run(m, 3);
  assert.ok(braz.hp > 2000, `allié soigné (${braz.hp})`);
  assert.equal(e.hp, 1000);
  assert.ok(ondine.healingDone > 1000);
});

test('super de Dolmen : charge, étourdit et se protège', () => {
  const m = sandbox();
  const f = m.fighters[2];
  const e = m.fighters[3];
  isolate(m, [f, e]);
  place(f, 10 * TILE);
  place(e, 10 * TILE + 200);
  f.superCharge = 1;
  m.queueAction(f.id, { type: 'super', angle: 0 });
  run(m, 0.3);
  assert.ok(e.stunT > 0, 'cible étourdie');
  assert.ok(e.hp < e.maxHp);
  assert.ok(f.drT > 0);
  run(m, 0.5);
  assert.ok(f.x > 10 * TILE + 300, `Dolmen doit avoir foncé (${f.x})`);
  assert.equal(f.dash, null);
});

test('super de Volta : rayon instantané, arrêté par les murs', () => {
  const m = sandbox();
  const f = m.fighters[3];
  const [e1, e2] = m.fighters;
  isolate(m, [f, e1, e2]);
  place(f, 10 * TILE);
  place(e1, 10 * TILE + 200);
  place(e2, 10 * TILE + 400);
  f.superCharge = 1;
  m.queueAction(f.id, { type: 'super', angle: 0 });
  m.step(SIM_DT);
  assert.ok(e1.hp < e1.maxHp && e2.hp < e2.maxHp, 'le rayon transperce');
  assert.ok(e1.stunT > 0);
  // Derrière un mur : intouchable
  const m2 = sandbox();
  const v = m2.fighters[3];
  const hidden = m2.fighters[0];
  isolate(m2, [v, hidden]);
  place(v, 12.5 * TILE, 9.5 * TILE);
  place(hidden, 16.5 * TILE, 9.5 * TILE); // le mur (14, 9) est entre les deux
  v.superCharge = 1;
  m2.queueAction(v.id, { type: 'super', angle: 0 });
  m2.step(SIM_DT);
  assert.equal(hidden.hp, hidden.maxHp);
});

test('super d’Alizé : repousse, dissipe les tirs et accélère', () => {
  const m = sandbox();
  const f = m.fighters[4];
  const e = m.fighters[0];
  isolate(m, [f, e]);
  place(f, 10 * TILE);
  place(e, 10 * TILE + 150);
  // Un tir ennemi en approche
  m.queueAction(e.id, { type: 'attack', angle: Math.PI });
  m.step(SIM_DT);
  assert.ok(m.projectiles.length > 0);
  f.superCharge = 1;
  m.queueAction(f.id, { type: 'super', angle: 0 });
  m.step(SIM_DT);
  assert.equal(m.projectiles.length, 0, 'tirs dissipés');
  run(m, 0.5);
  assert.ok(e.x > 10 * TILE + 380, `ennemi repoussé (${e.x})`);
  assert.ok(f.hasteT > 0);
});

// ── Fusions ──────────────────────────────────────────────────

test('table des fusions : les 10 paires d’éléments sont définies', () => {
  let n = 0;
  for (let i = 0; i < ELEMENT_IDS.length; i++) {
    for (let j = i + 1; j < ELEMENT_IDS.length; j++) {
      const fu = getFusion(ELEMENT_IDS[i], ELEMENT_IDS[j]);
      assert.ok(fu, `fusion manquante : ${ELEMENT_IDS[i]} + ${ELEMENT_IDS[j]}`);
      assert.equal(fu, getFusion(ELEMENT_IDS[j], ELEMENT_IDS[i]), 'l’ordre ne doit pas compter');
      assert.equal(fu.key, fusionKey(ELEMENT_IDS[i], ELEMENT_IDS[j]));
      assert.ok(fu.name && fu.desc);
      n++;
    }
  }
  assert.equal(n, 10);
  assert.equal(Object.keys(FUSIONS).length, 10);
  assert.equal(new Set(Object.values(FUSIONS).map((f) => f.name)).size, 10);
  for (const el of ELEMENT_IDS) assert.equal(fusionsFor(el).length, 4);
});

/** Prépare une fusion entre deux personnages alliés, un ennemi à 220 px. */
function fusionSetup(charA, charB) {
  const third = CHARACTER_IDS.find((c) => c !== charA && c !== charB);
  const m = sandbox([[charA, charB, third], ['dolmen', 'dolmen', 'dolmen']]);
  const [a, b] = m.fighters;
  const e = m.fighters[3];
  isolate(m, [a, b, e]);
  place(a, 12 * TILE);
  place(b, 12 * TILE - 100);
  place(e, 12 * TILE + 220);
  a.superCharge = 1;
  b.superCharge = 1;
  return { m, a, b, e };
}

function byElement(el) {
  return CHARACTER_IDS.find((id) => CHARACTERS[id].element === el);
}

test('fusion : conditions (2 supers chargés + proximité)', () => {
  const { m, a, b } = fusionSetup('braz', 'ondine');
  assert.equal(m.findFusionPartner(a), b);
  assert.equal(m.findFusionPartner(b), a);
  b.superCharge = 0.9;
  assert.equal(m.findFusionPartner(a), null, 'partenaire non chargé');
  b.superCharge = 1;
  place(b, a.x - FUSION.range - 5);
  assert.equal(m.findFusionPartner(a), null, 'partenaire trop loin');
  place(b, a.x - FUSION.range + 5);
  assert.equal(m.findFusionPartner(a), b);
  // Une fusion refusée ne consomme rien
  place(b, a.x - 600);
  m.queueAction(a.id, { type: 'fusion' });
  m.step(SIM_DT);
  assert.equal(a.superCharge, 1);
  assert.equal(fxOf(m, 'fusion').length, 0);
});

const FUSION_CHECKS = {
  'eau+feu': ({ m, e }) => {
    assert.ok(m.zones.some((z) => z.kind === 'vapeur'));
    run(m, 0.5);
    assert.ok(e.blindT > 0, 'ennemi aveuglé');
    assert.equal(m.canSee(e, m.fighters[0]), false, 'aveuglé : ne voit plus à 220 px');
  },
  'foudre+terre': ({ m, e }) => {
    assert.ok(e.stunT > 1, 'ennemi étourdi');
    assert.ok(e.hp < e.maxHp);
  },
  'feu+vent': ({ m, e }) => {
    const z = m.zones.find((zz) => zz.kind === 'tornade');
    assert.ok(z);
    const d0 = Math.hypot(z.x - e.x, z.y - e.y);
    run(m, 1);
    assert.ok(Math.hypot(z.x - e.x, z.y - e.y) < d0 - 100, 'la tornade poursuit l’ennemi');
    run(m, 2);
    assert.ok(e.hp < e.maxHp);
  },
  'feu+terre': ({ m, e }) => {
    assert.equal(m.strikes.length, FUSIONS['feu+terre'].count);
    run(m, 1.2);
    assert.ok(e.hp < e.maxHp, 'premier impact sur la cible');
    assert.ok(m.zones.some((z) => z.kind === 'lave'), 'flaque de lave');
  },
  'feu+foudre': ({ m, e, spawned }) => {
    const fu = FUSIONS['feu+foudre'];
    assert.equal(spawned.n, fu.count, 'première couronne');
    run(m, fu.waveDelay + 0.1);
    assert.equal(spawned.n, fu.count * fu.waves, 'deuxième couronne');
    run(m, 0.6);
    assert.ok(e.hp < e.maxHp);
  },
  'eau+terre': ({ m, e }) => {
    assert.ok(e.rootT > 0, 'ennemi immobilisé');
    e.input.mx = 1;
    const x0 = e.x;
    run(m, 0.5);
    assert.ok(Math.abs(e.x - x0) < 1, 'immobilisé : ne bouge pas');
    run(m, 1);
    assert.ok(e.zoneSlow < 0.5, 'puis fortement ralenti');
  },
  'eau+foudre': ({ m, e }) => {
    run(m, 2);
    assert.ok(e.maxHp - e.hp >= 500, 'dégâts continus');
  },
  'eau+vent': ({ m, e }) => {
    run(m, FUSIONS['eau+vent'].chillTime + 0.2);
    assert.ok(e.stunT > 0 && e.frozen, 'ennemi gelé');
  },
  'terre+vent': ({ m, a, b, e }) => {
    const z = m.zones.find((zz) => zz.kind === 'sable');
    a.input.mx = -1;
    run(m, 1);
    assert.ok(Math.hypot(z.x - a.x, z.y - a.y) < 5, 'la tempête suit le lanceur');
    assert.ok(a.cloakT > 0 && b.cloakT > 0, 'alliés camouflés');
    a.revealT = 0;
    place(e, a.x + 700);
    m.step(SIM_DT);
    assert.equal(m.canSee(e, a), false, 'invisible de loin');
  },
  'foudre+vent': ({ m, e }) => {
    const z = m.zones.find((zz) => zz.kind === 'cyclone');
    place(e, z.x + 200);
    const hp0 = e.hp;
    run(m, 1.5);
    assert.ok(Math.abs(e.x - z.x) < 120, `ennemi aspiré (${Math.abs(e.x - z.x)})`);
    run(m, 2.2);
    assert.ok(hp0 - e.hp >= FUSIONS['foudre+vent'].endBurst.dmg, 'décharge finale');
  },
};

for (const fu of Object.values(FUSIONS)) {
  test(`fusion ${fu.key} → ${fu.name}`, () => {
    const [elA, elB] = fu.key.split('+');
    const ctx = fusionSetup(byElement(elA), byElement(elB));
    const { m, a, b } = ctx;
    // Compte les projectiles créés (certains meurent aussitôt contre un mur voisin)
    ctx.spawned = { n: 0 };
    const spawn = m.spawnProjectile.bind(m);
    m.spawnProjectile = (o) => {
      ctx.spawned.n++;
      return spawn(o);
    };
    m.queueAction(a.id, { type: 'fusion' });
    m.step(SIM_DT);
    const events = fxOf(m, 'fusion');
    assert.equal(events.length, 1);
    assert.equal(events[0].name, fu.name);
    assert.equal(a.superCharge < 0.05 && b.superCharge < 0.05, true, 'les deux supers sont consommés');
    FUSION_CHECKS[fu.key](ctx);
  });
}

// ── Cristaux ─────────────────────────────────────────────────

test('cristaux : apparition échelonnée au centre', () => {
  const m = sandbox();
  isolate(m, []);
  const active = () => m.crystals.filter((c) => c.active).length;
  // Le premier cristal est celui du centre exact de l'arène
  assert.equal(m.crystals[0].y, m.arena.height / 2);
  assert.ok(m.crystals.every((c, i) => c.spawnAt === CRYSTAL.spawnTimes[i]));
  m.step(SIM_DT);
  assert.equal(active(), CRYSTAL.spawnTimes.filter((t) => t <= 0).length);
  run(m, Math.max(...CRYSTAL.spawnTimes) + 0.5);
  assert.equal(active(), 3);
});

test('cristaux : ramassage, bonus du porteur, chute à la mort', () => {
  const m = sandbox();
  const f = m.fighters[0];
  const e = m.fighters[3];
  isolate(m, [f, e]);
  const c = m.crystals.find((k) => m.arena.rowOf(k.y) === 7); // la ligne 7 n'a aucun mur
  c.active = true;
  place(f, c.x - 300, c.y);
  place(e, c.x + 150, c.y);
  f.input.mx = 1;
  run(m, 2);
  assert.equal(c.carrierId, f.id);
  assert.equal(f.carrying, 1);
  assert.equal(m.crystalMode.teamCount[0], 1);
  // Bonus de dégâts : +10 % par cristal
  f.input.mx = 0;
  const before = e.hp;
  m.damage(e, 1000, { owner: f, team: f.team, kind: 'super' });
  assert.equal(before - e.hp, Math.round(1000 * (1 + CRYSTAL.damageBonus)));
  // Mort → le cristal tombe sur place, hors des murs
  m.kill(f, e);
  assert.equal(c.carrierId, -1);
  assert.equal(f.carrying, 0);
  assert.ok(Math.hypot(c.x - f.x, c.y - f.y) < 80);
  assert.ok(!m.arena.circleBlocked(c.x, c.y, 10));
  assert.equal(e.kills, 1);
  // Le cristal ne peut pas être repris tout de suite, puis l'ennemi le ramasse
  place(e, c.x, c.y);
  m.step(SIM_DT);
  assert.equal(c.carrierId, -1, 'verrou juste après la chute');
  run(m, CRYSTAL.dropLock + 0.1);
  assert.equal(c.carrierId, e.id);
  assert.equal(m.crystalMode.teamCount[1], 1);
});

test('victoire : garder les 3 cristaux pendant 15 s', () => {
  const m = sandbox();
  isolate(m, []);
  m.crystals.forEach((c, i) => {
    c.active = true;
    c.carrierId = i;
    m.fighters[i].carrying = 1;
  });
  run(m, CRYSTAL.holdToWin - 1);
  assert.equal(m.phase, 'playing');
  assert.equal(m.crystalMode.holdTeam, 0);
  assert.ok(m.crystalMode.holdLeft < 1.1);
  run(m, 1.2);
  assert.equal(m.phase, 'ended');
  assert.deepEqual({ winner: m.result.winner, reason: m.result.reason }, { winner: 0, reason: 'hold' });
});

test('le compte à rebours repart de zéro si un porteur meurt', () => {
  const m = sandbox();
  isolate(m, []);
  m.crystals.forEach((c, i) => {
    c.active = true;
    c.carrierId = i;
    m.fighters[i].carrying = 1;
  });
  run(m, 10);
  m.kill(m.fighters[0], m.fighters[3]);
  m.step(SIM_DT);
  assert.equal(m.crystalMode.holdTeam, -1);
  assert.equal(m.crystalMode.holdT, 0);
  assert.equal(fxOf(m, 'holdBreak').length, 1);
  run(m, 10);
  assert.equal(m.phase, 'playing');
});

test('fin au temps : cristaux, puis éliminations, sinon égalité', () => {
  const end = (setup) => {
    const m = sandbox();
    isolate(m, []);
    m.crystals.forEach((c) => {
      c.active = true;
      c.x = 16.5 * TILE;
      c.y = 1.5 * TILE; // hors d'atteinte
    });
    setup(m);
    m.time = MATCH.duration - 0.5;
    run(m, 1);
    assert.equal(m.phase, 'ended');
    return m.result;
  };
  let r = end((m) => {
    m.crystals[0].carrierId = 3;
    m.fighters[3].carrying = 1;
  });
  assert.deepEqual([r.winner, r.reason], [1, 'crystals']);
  r = end((m) => {
    m.teamKills = [4, 2];
  });
  assert.deepEqual([r.winner, r.reason], [0, 'kills']);
  r = end(() => {});
  assert.deepEqual([r.winner, r.reason], [-1, 'draw']);
});

// ── Vision / buissons ────────────────────────────────────────

test('buissons : on y est caché, sauf de près, après un tir, ou en portant un cristal', () => {
  const m = sandbox();
  const hider = m.fighters[0];
  const seeker = m.fighters[3];
  isolate(m, [hider, seeker]);
  place(hider, 5.5 * TILE, 2.5 * TILE); // buisson (5, 2)
  place(seeker, 5.5 * TILE + 300, 2.5 * TILE);
  m.step(SIM_DT);
  assert.equal(hider.inBush, true);
  assert.equal(m.canSee(seeker, hider), false, 'caché de loin');
  assert.equal(m.canSee(hider, seeker), true, 'mais lui voit dehors');
  place(seeker, 5.5 * TILE + COMBAT.bushRevealDist - 10, 2.5 * TILE);
  assert.equal(m.canSee(seeker, hider), true, 'visible de près');
  place(seeker, 5.5 * TILE + 300, 2.5 * TILE);
  m.queueAction(hider.id, { type: 'attack', angle: Math.PI / 2 });
  m.step(SIM_DT);
  assert.equal(m.canSee(seeker, hider), true, 'révélé par son tir');
  run(m, COMBAT.revealTime + 0.2);
  assert.equal(m.canSee(seeker, hider), false, 'de nouveau caché');
  hider.carrying = 1;
  assert.equal(m.canSee(seeker, hider), true, 'un porteur est visible de tous');
});

// ── Arène vivante ────────────────────────────────────────────

test('arène vivante : un événement toutes les 30 s, 3 différents par match', () => {
  const m = sandbox();
  isolate(m, []);
  m.director.index = 0;
  const seen = [];
  const total = Math.round(MATCH.duration / SIM_DT) - 5;
  for (let i = 0; i < total; i++) {
    m.step(SIM_DT);
    for (const e of m.fx) if (e.type === 'arenaEvent' && e.phase === 'warning') seen.push([e.id, Math.round(m.time)]);
    m.fx.length = 0;
  }
  assert.equal(seen.length, 3);
  assert.deepEqual(seen.map((s) => s[1]), [30, 60, 90]);
  assert.equal(new Set(seen.map((s) => s[0])).size, 3, 'pas de répétition');
  for (const [id] of seen) assert.ok(ARENA_EVENT_IDS.includes(id));
});

test('événement lave : avertit, brûle, puis disparaît', () => {
  const m = sandbox();
  const f = m.fighters[0];
  isolate(m, [f]);
  m.director.begin('lave');
  const tiles = m.director.current.tiles;
  assert.ok(tiles.length >= 12, `assez de lave (${tiles.length})`);
  const { cols } = m.arena;
  for (const i of tiles) {
    assert.equal(m.arena.lava[i], LAVA_WARN);
    assert.equal(m.arena.tiles[i], T_FLOOR);
    const c = i % cols;
    assert.ok(tiles.includes(i - c + (cols - 1 - c)), 'lave symétrique');
    assert.ok(c >= 5 && c <= cols - 6, 'pas de lave dans les bases');
  }
  const c = tiles[0] % cols;
  const r = (tiles[0] - c) / cols;
  place(f, (c + 0.5) * TILE, (r + 0.5) * TILE);
  run(m, ARENA_EVENT.warning - 0.2);
  assert.equal(f.hp, f.maxHp, 'pas de dégâts pendant l’avertissement');
  run(m, 1.5);
  assert.equal(m.arena.lava[tiles[0]], LAVA_ON);
  assert.ok(f.hp < f.maxHp, 'la lave brûle');
  run(m, ARENA_EVENT.duration);
  assert.ok(m.arena.lava.every((v) => v === LAVA_NONE));
  assert.equal(m.director.current, null);
});

test('événement brouillard : la vision est limitée', () => {
  const m = sandbox();
  const [a, e] = [m.fighters[0], m.fighters[3]];
  isolate(m, [a, e]);
  place(a, 8 * TILE);
  place(e, 8 * TILE + COMBAT.fogVision + 60);
  m.director.begin('brouillard');
  run(m, ARENA_EVENT.warning + 0.1);
  assert.equal(m.arena.fog, true);
  assert.equal(m.canSee(a, e), false);
  place(e, 8 * TILE + COMBAT.fogVision - 60);
  assert.equal(m.canSee(a, e), true);
  place(e, 8 * TILE + 900);
  e.carrying = 1;
  assert.equal(m.canSee(a, e), true, 'porteur visible même dans le brouillard');
  run(m, ARENA_EVENT.duration);
  assert.equal(m.arena.fog, false);
});

test('événement murs mobiles : ils bougent, poussent, et ne piègent personne', () => {
  const m = sandbox();
  const fighters = m.fighters;
  m.director.begin('murs');
  assert.ok(m.arena.movers.every((mv) => mv.state === 'warning'));
  // Un combattant posé en plein sur chaque rail
  m.arena.movers.forEach((mv, i) => {
    place(fighters[i], (mv.ax + mv.bx) / 2 + mv.w / 2, (mv.ay + mv.by) / 2 + mv.h / 2);
    fighters[i].invulnT = 9999;
  });
  run(m, ARENA_EVENT.warning + 0.1);
  assert.ok(m.arena.movers.every((mv) => mv.state === 'active'));
  const start = m.arena.movers.map((mv) => [mv.x, mv.y]);
  const steps = Math.round((ARENA_EVENT.duration - 1) / SIM_DT);
  let pushed = 0;
  const x0 = fighters.map((f) => f.x + f.y);
  for (let i = 0; i < steps; i++) {
    m.step(SIM_DT);
    for (const f of fighters) {
      assert.ok(!m.arena.circleBlocked(f.x, f.y, f.r - 1.5), `combattant ${f.id} coincé en (${f.x}, ${f.y})`);
    }
  }
  fighters.forEach((f, i) => {
    if (Math.abs(f.x + f.y - x0[i]) > 20) pushed++;
  });
  assert.ok(pushed >= 4, 'les murs poussent les combattants');
  assert.ok(m.arena.movers.some((mv, i) => Math.hypot(mv.x - start[i][0], mv.y - start[i][1]) > 30));
  assert.ok(m.arena.moverMask.some((v) => v === 1));
  // Les projectiles sont arrêtés par un mur mobile
  const mv = m.arena.movers[0];
  assert.equal(m.arena.solidAt(mv.x + mv.w / 2, mv.y + mv.h / 2), true);
  run(m, 2);
  assert.ok(m.arena.movers.every((mm) => mm.state === 'hidden'));
  assert.ok(m.arena.moverMask.every((v) => v === 0));
});

test('événement orage : la foudre tombe après un avertissement', () => {
  const m = sandbox();
  const f = m.fighters[0];
  isolate(m, [f]);
  place(f, 10 * TILE);
  m.director.begin('orage');
  run(m, ARENA_EVENT.warning + 1);
  assert.ok(m.strikes.length > 0, 'des éclairs sont annoncés');
  m.fx.length = 0;
  run(m, 2);
  assert.ok(fxOf(m, 'explosion').length >= 2);
  // Un éclair pile sur lui le blesse (sans crédit d'élimination)
  const hp = f.hp;
  m.addStrike({ kind: 'foudre', team: -1, owner: null, x: f.x, y: f.y, r: 90, delay: 0.1, dmg: 700, source: 'env' });
  run(m, 0.3);
  assert.ok(f.hp <= hp - 700);
});

// ── Matchs complets avec bots ────────────────────────────────

function checkInvariants(m, label) {
  for (const f of m.fighters) {
    assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.hp), `${label} : valeur invalide`);
    assert.ok(f.hp <= f.maxHp && f.superCharge >= 0 && f.superCharge <= 1 && f.ammo >= 0 && f.ammo <= COMBAT.maxAmmo);
    if (f.alive) {
      assert.ok(f.hp > 0, `${label} : vivant sans PV`);
      assert.ok(!m.arena.isWall(m.arena.colOf(f.x), m.arena.rowOf(f.y)), `${label} : combattant ${f.id} dans un mur`);
    } else {
      assert.equal(f.carrying, 0, `${label} : un mort porte un cristal`);
    }
  }
  // Conservation des cristaux
  const carried = [0, 0, 0, 0, 0, 0];
  for (const c of m.crystals) {
    if (c.carrierId >= 0) {
      assert.ok(m.fighters[c.carrierId].alive, `${label} : cristal porté par un mort`);
      carried[c.carrierId]++;
    } else if (c.active) {
      assert.ok(!m.arena.isWall(m.arena.colOf(c.x), m.arena.rowOf(c.y)), `${label} : cristal dans un mur`);
    }
  }
  m.fighters.forEach((f, i) => assert.equal(f.carrying, carried[i], `${label} : compte de cristaux incohérent`));
}

test('matchs complets bots contre bots : toujours un résultat, aucun état invalide', () => {
  const stats = { fusion: 0, super: 0, death: 0, pickup: 0, events: 0 };
  for (let seed = 1; seed <= 8; seed++) {
    const m = new Match({ seed: seed * 104729, playerChar: null, difficulty: ['facile', 'normal', 'difficile'][seed % 3] });
    let steps = 0;
    while (m.phase !== 'ended') {
      m.step(SIM_DT);
      steps++;
      if (steps % 3 === 0) checkInvariants(m, `graine ${seed}, pas ${steps}`);
      for (const e of m.fx) {
        if (e.type in stats) stats[e.type]++;
        if (e.type === 'arenaEvent' && e.phase === 'start') stats.events++;
      }
      m.fx.length = 0;
      assert.ok(steps < (MATCH.duration + MATCH.countdown + 2) / SIM_DT, 'le match doit se terminer');
    }
    assert.ok(m.result && [0, 1, -1].includes(m.result.winner));
    assert.ok(['hold', 'crystals', 'kills', 'draw'].includes(m.result.reason));
    assert.ok(m.result.time >= Math.max(...CRYSTAL.spawnTimes) + CRYSTAL.holdToWin - 0.1);
  }
  // Les bots jouent vraiment : ils ramassent, tuent, lancent des supers et des fusions
  assert.ok(stats.pickup >= 16, `ramassages : ${stats.pickup}`);
  assert.ok(stats.death >= 16, `éliminations : ${stats.death}`);
  assert.ok(stats.super >= 8, `supers : ${stats.super}`);
  assert.ok(stats.fusion >= 4, `fusions : ${stats.fusion}`);
  assert.ok(stats.events >= 8, `événements d’arène : ${stats.events}`);
});

test('match avec un joueur humain : commandes prises en compte, équipes de 3 personnages distincts', () => {
  const m = new Match({ seed: 42, playerChar: 'alize' });
  assert.equal(m.fighters.length, 6);
  assert.equal(m.player, m.fighters[0]);
  assert.equal(m.player.charId, 'alize');
  assert.equal(m.bots.length, 5);
  for (const team of [0, 1]) {
    const chars = m.fighters.filter((f) => f.team === team).map((f) => f.charId);
    assert.equal(new Set(chars).size, 3, 'personnages distincts dans une équipe');
  }
  // Pendant le compte à rebours, personne ne bouge
  const p = m.player;
  const x0 = p.x;
  p.input.mx = 1;
  run(m, MATCH.countdown - 0.2);
  assert.equal(m.phase, 'countdown');
  assert.equal(p.x, x0);
  run(m, 0.5);
  assert.equal(m.phase, 'playing');
  run(m, 1);
  assert.ok(p.x > x0 + 150, 'le joueur avance');
  m.queueAction(p.id, { type: 'attack', angle: null }); // visée automatique
  m.step(SIM_DT);
  assert.ok(p.ammo < COMBAT.maxAmmo);
});

test('déterminisme : même graine → même match', () => {
  const play = () => {
    const m = new Match({ seed: 2024, playerChar: null });
    for (let i = 0; i < 60 * 40; i++) m.step(SIM_DT);
    return JSON.stringify(m.fighters.map((f) => [f.x, f.y, f.hp, f.kills, f.superCharge]));
  };
  assert.equal(play(), play());
});
