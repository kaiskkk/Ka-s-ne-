// ─────────────────────────────────────────────────────────────
//  PROGRESSION — tout ce qui se passe HORS des matchs :
//  récompenses de fin de match, niveaux, améliorations, Voie des Cristaux
//  (paliers de trophées), pass de saison, coffres et offres du jour.
//
//  Uniquement de la monnaie du jeu : aucun achat en argent réel.
//  Modifie ce fichier pour équilibrer l'économie.
// ─────────────────────────────────────────────────────────────

export const META = {
  startCoins: 150,
  startGems: 15,

  /** XP nécessaire pour passer du niveau `level` au suivant. */
  xpForLevel: (level) => 80 + 40 * (level - 1),
  levelUpReward: { coins: 40, gems: 2 },

  // Personnages : niveau 1 à 9 ; chaque niveau donne +5 % de PV et de dégâts
  maxCharLevel: 9,
  levelBonus: 0.05,
  /** Coût (pièces) pour passer du niveau i au niveau i + 1. */
  upgradeCost: [0, 80, 140, 220, 340, 500, 700, 950, 1250],

  // Récompenses de fin de match
  match: {
    win: { trophies: 8, coins: 24, xp: 40, pass: 30 },
    lose: { trophies: -4, coins: 8, xp: 14, pass: 12 },
    draw: { trophies: 1, coins: 12, xp: 20, pass: 16 },
    /** Les bots plus forts rapportent plus (trophées gagnés et pièces). */
    difficultyMul: { facile: 1, normal: 1.25, difficile: 1.5 },
    coinsPerKill: 2,
    maxKillCoins: 16,
  },
};

/** « Voie des Cristaux » : récompenses débloquées en accumulant des trophées. */
export const ROAD = [
  { at: 10, reward: { coins: 100 } },
  { at: 25, reward: { chest: 'eveil' } },
  { at: 45, reward: { gems: 10 } },
  { at: 70, reward: { coins: 250 } },
  { at: 100, reward: { chest: 'maree' } },
  { at: 140, reward: { gems: 20 } },
  { at: 190, reward: { coins: 500 } },
  { at: 250, reward: { chest: 'fusion' } },
  { at: 320, reward: { gems: 40 } },
  { at: 400, reward: { chest: 'fusion' } },
];

/** Pass de saison : paliers gratuits, débloqués avec les points gagnés en jouant. */
export const PASS = {
  name: 'Saison 1 · L’Éveil des Éléments',
  perTier: 100,
  tiers: [
    { coins: 60 },
    { gems: 5 },
    { coins: 100 },
    { chest: 'eveil' },
    { coins: 150 },
    { gems: 10 },
    { coins: 200 },
    { chest: 'maree' },
    { coins: 300 },
    { gems: 20 },
    { coins: 400 },
    { chest: 'fusion' },
  ],
};

/**
 * Coffres. `rolls` = nombre de récompenses ; chaque tirage choisit un type
 * selon `weights`, puis un montant dans la fourchette correspondante.
 */
export const CHESTS = {
  eveil: {
    id: 'eveil',
    name: 'Coffre d’éveil',
    price: { coins: 120 },
    rolls: 3,
    weights: { coins: 70, xp: 20, gems: 10 },
    coins: [20, 60],
    gems: [2, 4],
    xp: [20, 40],
  },
  maree: {
    id: 'maree',
    name: 'Coffre des marées',
    price: { gems: 25 },
    rolls: 5,
    weights: { coins: 65, xp: 20, gems: 15 },
    coins: [60, 160],
    gems: [3, 8],
    xp: [40, 80],
  },
  fusion: {
    id: 'fusion',
    name: 'Coffre de fusion',
    price: { gems: 60 },
    rolls: 8,
    weights: { coins: 60, xp: 20, gems: 20 },
    coins: [120, 320],
    gems: [5, 14],
    xp: [60, 140],
  },
};

/** Offres du jour : un cadeau gratuit + deux offres tirées dans cette liste selon la date. */
export const DAILY_POOL = [
  { id: 'bourse', title: 'Bourse de pièces', desc: '200 pièces', price: { gems: 10 }, reward: { coins: 200 } },
  { id: 'sac', title: 'Sac de pièces', desc: '500 pièces', price: { gems: 22 }, reward: { coins: 500 } },
  { id: 'promo-maree', title: 'Coffre des marées', desc: 'Promo −40 %', price: { gems: 15 }, reward: { chest: 'maree' } },
  { id: 'promo-eveil', title: 'Coffre d’éveil', desc: 'Promo −35 %', price: { coins: 80 }, reward: { chest: 'eveil' } },
  { id: 'poignee', title: 'Poignée de gemmes', desc: '8 gemmes', price: { coins: 260 }, reward: { gems: 8 } },
  { id: 'promo-fusion', title: 'Coffre de fusion', desc: 'Promo −30 %', price: { gems: 42 }, reward: { chest: 'fusion' } },
];
export const DAILY_GIFT = { id: 'cadeau', title: 'Cadeau du jour', desc: '40 pièces offertes', price: {}, reward: { coins: 40 } };

/** Joueurs fictifs du classement local (en attendant le multijoueur en ligne). */
export const RANK_NAMES = [
  'Zéphyrine', 'Magmor', 'Kalia', 'Rokh', 'Voltix', 'Brumaire', 'Sylphe', 'Tessia', 'Gravok', 'Lumen',
  'Nyxa', 'Ondeline', 'Pyrrhus', 'Aquilon', 'Quartz', 'Fulmine', 'Embrun', 'Basalte', 'Mistral', 'Orya',
  'Cendre', 'Rivaël', 'Granit', 'Étincel', 'Bora', 'Kelp', 'Scorie', 'Galet', 'Iskra', 'Sirocco',
];
