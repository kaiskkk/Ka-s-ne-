// Tests de la progression (pièces, trophées, niveaux, coffres…) :  npm test
import test from 'node:test';
import assert from 'node:assert/strict';

import { CHARACTER_IDS, CHARACTERS } from '../src/config/characters.js';
import { CHESTS, DAILY_POOL, META, PASS, ROAD } from '../src/config/meta.js';
import { SIM_DT } from '../src/config/constants.js';
import { Profile, dayKey } from '../src/meta/profile.js';
import { Match } from '../src/sim/Match.js';

class FakeStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }

  setItem(k, v) {
    this.map.set(k, String(v));
  }
}

/** Aléatoire déterministe pour les tests. */
function fixedRandom(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('nouveau profil : valeurs de départ, 5 personnages au niveau 1', () => {
  const p = new Profile(new FakeStorage());
  assert.equal(p.data.coins, META.startCoins);
  assert.equal(p.data.gems, META.startGems);
  assert.equal(p.data.level, 1);
  assert.equal(p.totalTrophies, 0);
  assert.deepEqual(Object.keys(p.data.chars).sort(), [...CHARACTER_IDS].sort());
  for (const id of CHARACTER_IDS) assert.deepEqual(p.char(id), { level: 1, trophies: 0 });
});

test('sauvegarde : tout est conservé d’une session à l’autre', () => {
  const store = new FakeStorage();
  const a = new Profile(store);
  a.applyMatchResult({ outcome: 'win', charId: 'volta', difficulty: 'normal', kills: 3 });
  a.setName('Kaïs');
  a.select('volta');
  assert.ok(a.upgrade('volta'));
  const snapshot = JSON.stringify(a.data);
  const b = new Profile(store); // « redémarrage » du jeu
  assert.equal(JSON.stringify(b.data), snapshot);
  assert.equal(b.data.name, 'Kaïs');
  assert.equal(b.char('volta').level, 2);
  assert.ok(b.totalTrophies > 0);
});

test('sauvegarde illisible ou trafiquée : on repart proprement', () => {
  const store = new FakeStorage();
  store.setItem('elementa.profile', '{pas du json');
  assert.equal(new Profile(store).data.coins, META.startCoins);
  store.setItem('elementa.profile', JSON.stringify({ coins: -50, gems: 'abc', chars: { braz: { level: 99, trophies: -3 } }, selected: 'inconnu' }));
  const p = new Profile(store);
  assert.equal(p.data.coins, 0);
  assert.equal(p.data.gems, 0);
  assert.equal(p.char('braz').level, META.maxCharLevel);
  assert.equal(p.char('braz').trophies, 0);
  assert.equal(p.data.selected, 'braz');
  assert.equal(p.char('alize').level, 1, 'les personnages manquants sont recréés');
});

test('victoire : trophées, pièces, XP et points de saison', () => {
  const p = new Profile(new FakeStorage());
  const r = p.applyMatchResult({ outcome: 'win', charId: 'braz', difficulty: 'facile', kills: 3 });
  assert.equal(r.trophies.delta, META.match.win.trophies);
  assert.equal(p.char('braz').trophies, META.match.win.trophies);
  assert.equal(p.totalTrophies, META.match.win.trophies);
  assert.equal(r.coins.delta, META.match.win.coins + 3 * META.match.coinsPerKill);
  assert.equal(p.data.coins, META.startCoins + r.coins.delta);
  assert.equal(p.data.xp, META.match.win.xp);
  assert.equal(p.data.passPoints, META.match.win.pass);
  assert.equal(p.data.stats.wins, 1);
  // Les bots plus forts rapportent plus
  const hard = new Profile(new FakeStorage()).applyMatchResult({ outcome: 'win', charId: 'braz', difficulty: 'difficile', kills: 0 });
  assert.equal(hard.trophies.delta, Math.round(META.match.win.trophies * 1.5));
  assert.ok(hard.coins.delta > META.match.win.coins);
  // Le bonus d'éliminations est plafonné
  const many = new Profile(new FakeStorage()).applyMatchResult({ outcome: 'win', charId: 'braz', difficulty: 'facile', kills: 50 });
  assert.equal(many.coins.delta, META.match.win.coins + META.match.maxKillCoins);
});

test('défaite : on perd des trophées, jamais sous zéro, et moins quand on débute', () => {
  const p = new Profile(new FakeStorage());
  let r = p.applyMatchResult({ outcome: 'lose', charId: 'braz', difficulty: 'facile', kills: 0 });
  assert.equal(r.trophies.delta, 0, 'à 0 trophée on ne perd rien');
  assert.equal(p.char('braz').trophies, 0);
  assert.ok(r.coins.delta > 0, 'on gagne quand même quelques pièces');
  p.data.chars.braz.trophies = 10;
  r = p.applyMatchResult({ outcome: 'lose', charId: 'braz', difficulty: 'facile', kills: 0 });
  assert.equal(r.trophies.delta, -2, 'perte divisée par deux sous 20 trophées');
  p.data.chars.braz.trophies = 60;
  r = p.applyMatchResult({ outcome: 'lose', charId: 'braz', difficulty: 'difficile', kills: 0 });
  assert.equal(r.trophies.delta, META.match.lose.trophies, 'la perte ne dépend pas de la difficulté');
  assert.equal(p.char('braz').trophies, 56);
});

test('XP : passage de niveau avec récompense, le surplus est reporté', () => {
  const p = new Profile(new FakeStorage());
  const need = META.xpForLevel(1);
  const ups = p.addXp(need + 15);
  assert.equal(ups.length, 1);
  assert.equal(p.data.level, 2);
  assert.equal(p.data.xp, 15);
  assert.equal(p.data.coins, META.startCoins + META.levelUpReward.coins);
  assert.equal(p.data.gems, META.startGems + META.levelUpReward.gems);
  assert.ok(META.xpForLevel(2) > need, 'chaque niveau demande plus d’XP');
  assert.equal(p.addXp(5000).length > 3, true, 'plusieurs niveaux d’un coup');
});

test('amélioration d’un personnage : coûte des pièces, +5 % par niveau, plafonnée', () => {
  const p = new Profile(new FakeStorage());
  p.data.coins = 50;
  assert.equal(p.canUpgrade('dolmen'), false);
  assert.equal(p.upgrade('dolmen'), null, 'pas assez de pièces');
  assert.equal(p.char('dolmen').level, 1);
  p.data.coins = 100000;
  let spent = 0;
  for (let lvl = 1; lvl < META.maxCharLevel; lvl++) {
    assert.equal(p.upgradeCost('dolmen'), META.upgradeCost[lvl]);
    const r = p.upgrade('dolmen');
    assert.equal(r.level, lvl + 1);
    spent += r.cost;
  }
  assert.equal(p.data.coins, 100000 - spent);
  assert.equal(p.char('dolmen').level, META.maxCharLevel);
  assert.equal(p.upgradeCost('dolmen'), null);
  assert.equal(p.upgrade('dolmen'), null, 'niveau maximum');
  assert.ok(Math.abs(p.power('dolmen') - (1 + META.levelBonus * (META.maxCharLevel - 1))) < 1e-9);
  assert.equal(p.power('braz'), 1);
  for (let i = 1; i < META.upgradeCost.length - 1; i++) assert.ok(META.upgradeCost[i + 1] > META.upgradeCost[i], 'coûts croissants');
});

test('le niveau du personnage renforce vraiment le joueur en match', () => {
  const m = new Match({ seed: 5, playerChar: 'braz', playerPower: 1.4 });
  const p = m.player;
  assert.equal(p.maxHp, Math.round(CHARACTERS.braz.hp * 1.4));
  assert.equal(p.hp, p.maxHp);
  m.phase = 'playing';
  const enemy = m.fighters[3];
  const before = enemy.hp;
  m.damage(enemy, 1000, { owner: p, team: p.team, kind: 'super' });
  assert.equal(before - enemy.hp, 1400);
  // Les bots, eux, restent au niveau 1
  assert.ok(m.fighters.slice(1).every((f) => f.power === 1 && f.maxHp === f.def.hp));
  // Après une mort, les PV max améliorés sont conservés
  m.kill(p, enemy);
  for (let i = 0; i < 60 * 4; i++) m.step(SIM_DT);
  assert.equal(p.alive, true);
  assert.equal(p.maxHp, Math.round(CHARACTERS.braz.hp * 1.4));
});

test('Voie des Cristaux : paliers débloqués par les trophées, récupérés une seule fois', () => {
  const p = new Profile(new FakeStorage(), fixedRandom(3));
  assert.ok(p.roadState().every((r) => r.state === 'locked'));
  for (let i = 1; i < ROAD.length; i++) assert.ok(ROAD[i].at > ROAD[i - 1].at, 'paliers croissants');
  assert.equal(p.roadProgress().next.at, ROAD[0].at);
  // Deux victoires → 16 trophées → 1er palier (10) franchi
  p.applyMatchResult({ outcome: 'win', charId: 'braz', difficulty: 'facile', kills: 0 });
  const r = p.applyMatchResult({ outcome: 'win', charId: 'ondine', difficulty: 'facile', kills: 0 });
  assert.deepEqual(r.roadReached.map((x) => x.at), [ROAD[0].at]);
  assert.equal(p.roadState()[0].state, 'ready');
  assert.equal(p.pending().road, 1);
  const coins = p.data.coins;
  const out = p.claimRoad(0);
  assert.equal(p.data.coins, coins + ROAD[0].reward.coins);
  assert.deepEqual(out.reward, ROAD[0].reward);
  assert.equal(p.roadState()[0].state, 'claimed');
  assert.equal(p.claimRoad(0), null, 'pas deux fois');
  assert.equal(p.claimRoad(1), null, 'palier pas encore atteint');
  // Perdre des trophées ne reverrouille pas un palier atteint
  p.data.bestTrophies = 30;
  p.data.chars.braz.trophies = 0;
  assert.equal(p.roadState()[1].state, 'ready');
  // Un palier « coffre » donne son contenu tout de suite
  const chest = p.claimRoad(1);
  assert.equal(chest.loot.length, CHESTS.eveil.rolls);
});

test('pass de saison : paliers gratuits débloqués avec les points', () => {
  const p = new Profile(new FakeStorage(), fixedRandom(9));
  assert.ok(PASS.tiers.length >= 10);
  assert.ok(p.passState().every((t) => t.state === 'locked'));
  p.data.passPoints = PASS.perTier * 2 + 10;
  const st = p.passState();
  assert.deepEqual(st.map((t) => t.state).slice(0, 3), ['ready', 'ready', 'locked']);
  assert.equal(p.pending().pass, 2);
  const gems = p.data.gems;
  p.claimPass(1);
  assert.equal(p.data.gems, gems + PASS.tiers[1].gems);
  assert.equal(p.claimPass(1), null);
  assert.equal(p.claimPass(2), null);
  assert.equal(p.passState()[1].state, 'claimed');
});

test('coffres : nombre de récompenses, montants dans les fourchettes, tout est crédité', () => {
  for (const type of Object.keys(CHESTS)) {
    const def = CHESTS[type];
    const p = new Profile(new FakeStorage(), fixedRandom(type.length * 7));
    p.data.coins = 5000;
    p.data.gems = 500;
    const before = { coins: p.data.coins, gems: p.data.gems, xp: p.data.xp, level: p.data.level };
    const out = p.buyChest(type);
    assert.equal(out.loot.length, def.rolls);
    assert.equal(out.loot[out.loot.length - 1].kind, 'gems', 'le bouquet final est en gemmes');
    let coins = -(def.price.coins || 0);
    let gems = -(def.price.gems || 0);
    for (const item of out.loot) {
      const [lo, hi] = def[item.kind];
      assert.ok(item.amount >= Math.min(lo, 1) && item.amount <= hi + 4, `${type} ${item.kind} ${item.amount}`);
      if (item.kind === 'coins') coins += item.amount;
      if (item.kind === 'gems') gems += item.amount;
    }
    coins += out.levelUps.length * META.levelUpReward.coins;
    gems += out.levelUps.length * META.levelUpReward.gems;
    assert.equal(p.data.coins, before.coins + coins);
    assert.equal(p.data.gems, before.gems + gems);
  }
  // Pas assez de monnaie : rien ne se passe
  const poor = new Profile(new FakeStorage());
  poor.data.gems = 0;
  assert.equal(poor.buyChest('fusion'), null);
  assert.equal(poor.data.gems, 0);
});

test('boutique : cadeau gratuit une fois par jour, offres renouvelées chaque jour', () => {
  const p = new Profile(new FakeStorage(), fixedRandom(4));
  const day1 = new Date(2026, 10, 12, 10);
  const offers = p.dailyOffers(day1);
  assert.equal(offers.length, 3);
  assert.equal(offers[0].free, true);
  assert.notEqual(offers[1].id, offers[2].id);
  assert.deepEqual(p.dailyOffers(day1).map((o) => o.id), offers.map((o) => o.id), 'stables dans la journée');
  assert.equal(p.pending().shop, 1);
  const coins = p.data.coins;
  assert.ok(p.buyOffer(offers[0].id, day1));
  assert.equal(p.data.coins, coins + offers[0].reward.coins);
  assert.equal(p.buyOffer(offers[0].id, day1), null, 'une seule fois par jour');
  assert.equal(p.dailyOffers(day1)[0].bought, true);
  // Le lendemain : de nouveau disponible
  const day2 = new Date(2026, 10, 13, 9);
  assert.notEqual(dayKey(day1), dayKey(day2));
  assert.equal(p.dailyOffers(day2)[0].bought, false);
  assert.ok(p.buyOffer(offers[0].id, day2));
  // Offre payante sans les moyens
  p.data.coins = 0;
  p.data.gems = 0;
  const paid = p.dailyOffers(day2)[1];
  assert.equal(p.buyOffer(paid.id, day2), null);
  assert.ok(DAILY_POOL.every((o) => o.price.coins || o.price.gems), 'les offres du catalogue sont payantes (monnaie du jeu)');
});

test('classement local : le joueur est classé selon ses trophées', () => {
  const p = new Profile(new FakeStorage());
  p.setName('Kaïs');
  let rows = p.leaderboard();
  const me = () => rows.find((r) => r.me);
  assert.equal(me().rank, rows.length, 'dernier avec 0 trophée');
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].trophies >= r.trophies));
  p.data.chars.braz.trophies = 5000;
  rows = p.leaderboard();
  assert.equal(me().rank, 1);
  assert.equal(me().name, 'Kaïs');
});

test('pseudo : nettoyé et limité à 12 caractères', () => {
  const p = new Profile(new FakeStorage());
  assert.equal(p.setName('   '), false);
  assert.equal(p.data.name, 'Joueur');
  assert.equal(p.setName('  <b>Super-Long-Pseudo-De-Test</b> '), true);
  assert.equal(p.data.name.length <= 12, true);
  assert.ok(!/[<>]/.test(p.data.name));
});
