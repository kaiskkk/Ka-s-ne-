// ─────────────────────────────────────────────────────────────
//  Profile — la progression du joueur, SAUVEGARDÉE SUR LE TÉLÉPHONE
//  (localStorage) : pseudo, pièces, gemmes, XP et niveau, trophées et niveau
//  de chaque personnage, récompenses déjà récupérées, offres du jour…
//
//  JavaScript pur (ni Phaser ni affichage) : testable sous Node, et prêt à
//  être remplacé plus tard par une sauvegarde sur serveur.
// ─────────────────────────────────────────────────────────────
import { CHARACTER_IDS } from '../config/characters.js';
import { CHESTS, DAILY_GIFT, DAILY_POOL, META, PASS, RANK_NAMES, ROAD } from '../config/meta.js';

const STORAGE_KEY = 'elementa.profile';
const VERSION = 1;

function defaults() {
  const chars = {};
  for (const id of CHARACTER_IDS) chars[id] = { level: 1, trophies: 0 };
  return {
    version: VERSION,
    name: 'Joueur',
    coins: META.startCoins,
    gems: META.startGems,
    level: 1,
    xp: 0,
    selected: 'braz',
    difficulty: 'facile',
    chars,
    /** Meilleur total de trophées atteint : les paliers débloqués le restent. */
    bestTrophies: 0,
    roadClaimed: [],
    passPoints: 0,
    passClaimed: [],
    shop: { day: '', bought: [] },
    stats: { matches: 0, wins: 0, kills: 0 },
    helpSeen: false,
  };
}

/** « 2026-11-12 » : sert à renouveler les offres chaque jour. */
export function dayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Profile {
  /**
   * @param {Storage|null} storage  localStorage (ou un équivalent pour les tests)
   * @param {() => number} random   source d'aléatoire (remplaçable dans les tests)
   */
  constructor(storage = null, random = Math.random) {
    this.storage = storage;
    this.random = random;
    this.data = defaults();
    this.migrateLegacy();
    this.load();
  }

  /** Reprend les réglages de la toute première version du jeu (clés séparées). */
  migrateLegacy() {
    try {
      const st = this.storage;
      if (!st || st.getItem(STORAGE_KEY)) return;
      const sel = st.getItem('elementa.char');
      if (sel && CHARACTER_IDS.includes(sel)) this.data.selected = sel;
      const diff = st.getItem('elementa.difficulty');
      if (diff) this.data.difficulty = diff;
      if (st.getItem('elementa.helpSeen') === '1') this.data.helpSeen = true;
    } catch {
      /* ignore */
    }
  }

  // ── Sauvegarde ─────────────────────────────────────────────

  load() {
    try {
      const raw = this.storage && this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      // On fusionne avec les valeurs par défaut : une ancienne sauvegarde reste valable
      const d = defaults();
      this.data = { ...d, ...saved, chars: { ...d.chars }, shop: { ...d.shop, ...(saved.shop || {}) }, stats: { ...d.stats, ...(saved.stats || {}) } };
      for (const id of CHARACTER_IDS) {
        const c = (saved.chars && saved.chars[id]) || {};
        this.data.chars[id] = {
          level: Math.min(META.maxCharLevel, Math.max(1, Math.floor(c.level) || 1)),
          trophies: Math.max(0, Math.floor(c.trophies) || 0),
        };
      }
      for (const key of ['coins', 'gems', 'xp', 'passPoints', 'bestTrophies']) {
        this.data[key] = Math.max(0, Math.floor(this.data[key]) || 0);
      }
      this.data.level = Math.max(1, Math.floor(this.data.level) || 1);
      if (!CHARACTER_IDS.includes(this.data.selected)) this.data.selected = 'braz';
      if (!Array.isArray(this.data.roadClaimed)) this.data.roadClaimed = [];
      if (!Array.isArray(this.data.passClaimed)) this.data.passClaimed = [];
      if (!Array.isArray(this.data.shop.bought)) this.data.shop.bought = [];
    } catch {
      this.data = defaults(); // sauvegarde illisible : on repart de zéro plutôt que de planter
    }
  }

  save() {
    try {
      if (this.storage) this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* stockage plein ou indisponible (navigation privée) : la partie continue sans sauvegarde */
    }
  }

  reset() {
    this.data = defaults();
    this.save();
  }

  // ── Lecture ────────────────────────────────────────────────

  get totalTrophies() {
    let t = 0;
    for (const id of CHARACTER_IDS) t += this.data.chars[id].trophies;
    return t;
  }

  char(id) {
    return this.data.chars[id] || { level: 1, trophies: 0 };
  }

  /** Multiplicateur de PV et de dégâts d'un personnage selon son niveau. */
  power(id) {
    return 1 + META.levelBonus * (this.char(id).level - 1);
  }

  xpNeeded() {
    return META.xpForLevel(this.data.level);
  }

  // ── Monnaies, XP ───────────────────────────────────────────

  canAfford(price) {
    return this.data.coins >= (price.coins || 0) && this.data.gems >= (price.gems || 0);
  }

  pay(price) {
    if (!this.canAfford(price)) return false;
    this.data.coins -= price.coins || 0;
    this.data.gems -= price.gems || 0;
    return true;
  }

  /** Ajoute de l'XP ; renvoie la liste des niveaux franchis (chacun donne une récompense). */
  addXp(amount) {
    const levelUps = [];
    this.data.xp += Math.max(0, Math.round(amount));
    while (this.data.xp >= this.xpNeeded()) {
      this.data.xp -= this.xpNeeded();
      this.data.level += 1;
      this.data.coins += META.levelUpReward.coins;
      this.data.gems += META.levelUpReward.gems;
      levelUps.push({ level: this.data.level, ...META.levelUpReward });
    }
    return levelUps;
  }

  /**
   * Donne une récompense { coins?, gems?, xp?, chest? }.
   * Un coffre est ouvert tout de suite : son contenu est tiré, ajouté au profil,
   * et renvoyé dans `loot` pour que l'écran puisse l'animer.
   */
  grant(reward) {
    const out = { reward, loot: null, levelUps: [] };
    if (reward.coins) this.data.coins += reward.coins;
    if (reward.gems) this.data.gems += reward.gems;
    if (reward.xp) out.levelUps.push(...this.addXp(reward.xp));
    if (reward.chest) {
      out.loot = this.rollChest(reward.chest);
      for (const item of out.loot) {
        if (item.kind === 'coins') this.data.coins += item.amount;
        else if (item.kind === 'gems') this.data.gems += item.amount;
        else if (item.kind === 'xp') out.levelUps.push(...this.addXp(item.amount));
      }
    }
    return out;
  }

  /** Tire le contenu d'un coffre : [{ kind: 'coins'|'gems'|'xp', amount }]. */
  rollChest(type) {
    const def = CHESTS[type];
    if (!def) return [];
    const total = Object.values(def.weights).reduce((a, b) => a + b, 0);
    const loot = [];
    for (let i = 0; i < def.rolls; i++) {
      let pick = this.random() * total;
      let kind = 'coins';
      for (const [k, w] of Object.entries(def.weights)) {
        pick -= w;
        if (pick < 0) {
          kind = k;
          break;
        }
      }
      // La dernière récompense d'un coffre est toujours des gemmes : un bouquet final
      if (i === def.rolls - 1) kind = 'gems';
      const [lo, hi] = def[kind];
      let amount = lo + this.random() * (hi - lo);
      amount = kind === 'gems' ? Math.round(amount) : Math.round(amount / 5) * 5;
      loot.push({ kind, amount: Math.max(1, amount) });
    }
    return loot;
  }

  // ── Fin de match ───────────────────────────────────────────

  /**
   * Applique les récompenses d'un match et renvoie tout ce qu'il faut pour
   * animer l'écran de fin (valeurs avant / après).
   * @param {{outcome:'win'|'lose'|'draw', charId:string, difficulty:string, kills:number}} m
   */
  applyMatchResult(m) {
    const d = this.data;
    const base = META.match[m.outcome] || META.match.draw;
    const mul = META.match.difficultyMul[m.difficulty] || 1;
    const ch = this.char(m.charId);

    let dTrophies = base.trophies > 0 ? Math.round(base.trophies * mul) : base.trophies;
    if (dTrophies < 0) {
      // Défaite adoucie pour les débutants, et jamais en dessous de zéro
      if (ch.trophies < 20) dTrophies = Math.ceil(dTrophies / 2);
      dTrophies = -Math.min(ch.trophies, -dTrophies) || 0; // « || 0 » : pas de « −0 »
    }
    const kills = Math.max(0, m.kills || 0);
    const coins = Math.round(base.coins * mul) + Math.min(META.match.maxKillCoins, kills * META.match.coinsPerKill);

    const before = {
      trophies: this.totalTrophies,
      charTrophies: ch.trophies,
      coins: d.coins,
      gems: d.gems,
      level: d.level,
      xp: d.xp,
      xpNeeded: this.xpNeeded(),
      pass: d.passPoints,
      best: d.bestTrophies,
    };

    ch.trophies += dTrophies;
    d.coins += coins;
    d.passPoints += base.pass;
    const levelUps = this.addXp(base.xp);
    d.bestTrophies = Math.max(d.bestTrophies, this.totalTrophies);
    d.stats.matches += 1;
    if (m.outcome === 'win') d.stats.wins += 1;
    d.stats.kills += kills;
    this.save();

    return {
      outcome: m.outcome,
      charId: m.charId,
      trophies: { before: before.trophies, after: this.totalTrophies, delta: dTrophies },
      charTrophies: { before: before.charTrophies, after: ch.trophies },
      coins: { before: before.coins, delta: coins, after: d.coins },
      xp: { gained: base.xp, before: before.xp, neededBefore: before.xpNeeded, after: d.xp, neededAfter: this.xpNeeded() },
      level: { before: before.level, after: d.level, ups: levelUps },
      pass: { before: before.pass, after: d.passPoints, delta: base.pass },
      /** Paliers de la Voie des Cristaux franchis grâce à ce match. */
      roadReached: ROAD.map((r, i) => ({ ...r, index: i })).filter((r) => before.best < r.at && d.bestTrophies >= r.at),
    };
  }

  // ── Personnages ────────────────────────────────────────────

  upgradeCost(id) {
    const level = this.char(id).level;
    return level >= META.maxCharLevel ? null : META.upgradeCost[level];
  }

  canUpgrade(id) {
    const cost = this.upgradeCost(id);
    return cost != null && this.data.coins >= cost;
  }

  upgrade(id) {
    const cost = this.upgradeCost(id);
    if (cost == null || this.data.coins < cost) return null;
    this.data.coins -= cost;
    this.data.chars[id].level += 1;
    this.save();
    return { level: this.data.chars[id].level, cost };
  }

  select(id) {
    if (!CHARACTER_IDS.includes(id)) return;
    this.data.selected = id;
    this.save();
  }

  setDifficulty(id) {
    this.data.difficulty = id;
    this.save();
  }

  setName(name) {
    const clean = String(name || '')
      .replace(/[\u0000-\u001f<>]/g, '')
      .trim()
      .slice(0, 12);
    if (!clean) return false;
    this.data.name = clean;
    this.save();
    return true;
  }

  // ── Voie des Cristaux (paliers de trophées) ────────────────

  /** État de chaque palier : 'claimed' (récupéré) | 'ready' (à récupérer) | 'locked'. */
  roadState() {
    return ROAD.map((r, index) => ({
      ...r,
      index,
      state: this.data.roadClaimed.includes(index) ? 'claimed' : this.data.bestTrophies >= r.at ? 'ready' : 'locked',
    }));
  }

  claimRoad(index) {
    const r = this.roadState()[index];
    if (!r || r.state !== 'ready') return null;
    this.data.roadClaimed.push(index);
    const out = this.grant(r.reward);
    this.save();
    return out;
  }

  /** Prochain palier non atteint (ou null si tout est débloqué) et le précédent. */
  roadProgress() {
    const best = this.data.bestTrophies;
    const next = ROAD.find((r) => best < r.at) || null;
    const prevAt = [...ROAD].reverse().find((r) => best >= r.at)?.at ?? 0;
    return { next, prevAt, trophies: this.totalTrophies, best };
  }

  // ── Pass de saison ─────────────────────────────────────────

  passState() {
    return PASS.tiers.map((reward, index) => {
      const need = (index + 1) * PASS.perTier;
      return {
        reward,
        index,
        need,
        state: this.data.passClaimed.includes(index) ? 'claimed' : this.data.passPoints >= need ? 'ready' : 'locked',
      };
    });
  }

  claimPass(index) {
    const t = this.passState()[index];
    if (!t || t.state !== 'ready') return null;
    this.data.passClaimed.push(index);
    const out = this.grant(t.reward);
    this.save();
    return out;
  }

  /** Nombre de récompenses en attente (pastilles rouges du menu). */
  pending() {
    return {
      road: this.roadState().filter((r) => r.state === 'ready').length,
      pass: this.passState().filter((t) => t.state === 'ready').length,
      shop: this.dailyOffers().some((o) => o.free && !o.bought) ? 1 : 0,
      chars: CHARACTER_IDS.filter((id) => this.canUpgrade(id)).length,
    };
  }

  // ── Boutique ───────────────────────────────────────────────

  /** Offres du jour : le cadeau gratuit + 2 offres choisies d'après la date. */
  dailyOffers(date = new Date()) {
    const day = dayKey(date);
    if (this.data.shop.day !== day) {
      this.data.shop = { day, bought: [] };
      this.save();
    }
    const h = hashString(day);
    const a = h % DAILY_POOL.length;
    let b = (h >>> 8) % DAILY_POOL.length;
    if (b === a) b = (b + 1) % DAILY_POOL.length;
    return [DAILY_GIFT, DAILY_POOL[a], DAILY_POOL[b]].map((o) => ({
      ...o,
      free: !o.price.coins && !o.price.gems,
      bought: this.data.shop.bought.includes(o.id),
    }));
  }

  buyOffer(id, date = new Date()) {
    const offer = this.dailyOffers(date).find((o) => o.id === id);
    if (!offer || offer.bought || !this.pay(offer.price)) return null;
    this.data.shop.bought.push(id);
    const out = this.grant(offer.reward);
    this.save();
    return out;
  }

  buyChest(type) {
    const def = CHESTS[type];
    if (!def || !this.pay(def.price)) return null;
    const out = this.grant({ chest: type });
    this.save();
    return out;
  }

  // ── Classement local ───────────────────────────────────────

  /** Classement d'entraînement : des joueurs fictifs, et le joueur à sa place selon ses trophées. */
  leaderboard() {
    const rows = RANK_NAMES.map((name, i) => ({
      name,
      // Du premier (~640 trophées) au dernier (~6), de façon décroissante et stable
      trophies: Math.round(640 * Math.pow(0.86, i) + (hashString(name) % 7)),
      level: Math.max(1, 28 - i),
      charId: CHARACTER_IDS[hashString(name) % CHARACTER_IDS.length],
      me: false,
    }));
    rows.push({ name: this.data.name, trophies: this.totalTrophies, level: this.data.level, charId: this.data.selected, me: true });
    rows.sort((x, y) => y.trophies - x.trophies || (x.me ? 1 : -1));
    rows.forEach((r, i) => {
      r.rank = i + 1;
    });
    return rows;
  }
}

function browserStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Le profil du joueur (unique, partagé par tous les écrans). */
export const profile = new Profile(browserStorage());
