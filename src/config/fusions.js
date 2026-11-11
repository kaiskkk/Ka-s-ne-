// ─────────────────────────────────────────────────────────────
//  TABLE DES FUSIONS — une entrée par paire d'éléments (10 paires).
//
//  Une fusion se déclenche quand deux coéquipiers ont leur super chargé et
//  sont à moins de FUSION.range l'un de l'autre. Elle consomme les 2 supers.
//
//  `place` indique où l'effet apparaît :
//    'self'   → centré sur le lanceur
//    'target' → posé vers l'ennemi visible le plus proche (ou devant le lanceur)
//  `aiRange` : distance d'un ennemi à partir de laquelle un bot la déclenche.
// ─────────────────────────────────────────────────────────────

/** Clé canonique d'une paire d'éléments (ordre alphabétique). */
export function fusionKey(a, b) {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

export const FUSIONS = {
  // Feu + Eau → nuage de vapeur qui aveugle
  'eau+feu': {
    key: 'eau+feu',
    name: 'Nuage de vapeur',
    desc: 'Un épais nuage brûlant : les ennemis à l’intérieur sont aveuglés.',
    kind: 'vapeur',
    place: 'target',
    radius: 230,
    dur: 6,
    dps: 120,
    aiRange: 420,
  },

  // Terre + Foudre → séisme qui étourdit
  'foudre+terre': {
    key: 'foudre+terre',
    name: 'Séisme',
    desc: 'Une onde de choc étourdit tous les ennemis autour du lanceur.',
    kind: 'seisme',
    place: 'self',
    radius: 330,
    dmg: 900,
    stun: 1.8,
    aiRange: 290,
  },

  // Vent + Feu → tornade de flammes mobile
  'feu+vent': {
    key: 'feu+vent',
    name: 'Tornade de flammes',
    desc: 'Une tornade ardente qui pourchasse les ennemis.',
    kind: 'tornade',
    place: 'self',
    radius: 95,
    dur: 7,
    dps: 480,
    speed: 175,
    turn: 2.4, // vitesse de virage (rad/s)
    pull: 60,
    aiRange: 460,
  },

  // Feu + Terre → éruption (pluie de roches en fusion + flaques de lave)
  'feu+terre': {
    key: 'feu+terre',
    name: 'Éruption',
    desc: 'Des roches en fusion pleuvent et laissent des flaques de lave.',
    kind: 'eruption',
    place: 'target',
    radius: 260, // zone dans laquelle tombent les roches
    count: 7,
    over: 2.2, // durée de la pluie
    delay: 0.75, // avertissement avant chaque impact
    impactRadius: 88,
    dmg: 800,
    pool: { dur: 3, dps: 250 },
    aiRange: 430,
  },

  // Feu + Foudre → orage de plasma (anneau de projectiles perçants)
  'feu+foudre': {
    key: 'feu+foudre',
    name: 'Orage de plasma',
    desc: 'Une couronne d’orbes de plasma perçants jaillit dans toutes les directions.',
    kind: 'plasma',
    place: 'self',
    count: 14,
    dmg: 620,
    speed: 520,
    range: 430,
    projRadius: 13,
    waves: 2,
    waveDelay: 0.35,
    aiRange: 330,
  },

  // Eau + Terre → marécage (immobilise puis ralentit fortement)
  'eau+terre': {
    key: 'eau+terre',
    name: 'Marécage',
    desc: 'Un bourbier qui immobilise puis ralentit fortement les ennemis.',
    kind: 'marecage',
    place: 'target',
    radius: 250,
    dur: 7,
    dps: 80,
    slow: 0.4, // les ennemis ne gardent que 40 % de leur vitesse
    root: 1.0,
    aiRange: 430,
  },

  // Eau + Foudre → marée électrique (gros dégâts continus)
  'eau+foudre': {
    key: 'eau+foudre',
    name: 'Marée électrique',
    desc: 'Une nappe d’eau électrifiée qui inflige de lourds dégâts continus.',
    kind: 'maree',
    place: 'target',
    radius: 240,
    dur: 5,
    dps: 360,
    slow: 0.75,
    aiRange: 430,
  },

  // Eau + Vent → blizzard (gèle ceux qui restent dedans)
  'eau+vent': {
    key: 'eau+vent',
    name: 'Blizzard',
    desc: 'Ralentit, puis gèle sur place les ennemis qui restent à l’intérieur.',
    kind: 'blizzard',
    place: 'target',
    radius: 240,
    dur: 5,
    dps: 150,
    slow: 0.6,
    chillTime: 1.2, // temps passé dedans avant d'être gelé
    freeze: 1.6,
    aiRange: 430,
  },

  // Terre + Vent → tempête de sable (camoufle les alliés, suit le lanceur)
  'terre+vent': {
    key: 'terre+vent',
    name: 'Tempête de sable',
    desc: 'Suit le lanceur : cache les alliés, blesse et ralentit les ennemis.',
    kind: 'sable',
    place: 'self',
    radius: 220,
    dur: 7,
    dps: 200,
    slow: 0.75,
    aiRange: 330,
  },

  // Foudre + Vent → cyclone (aspire puis foudroie)
  'foudre+vent': {
    key: 'foudre+vent',
    name: 'Cyclone',
    desc: 'Aspire les ennemis vers son centre, puis les foudroie.',
    kind: 'cyclone',
    place: 'target',
    radius: 280,
    dur: 3.5,
    dps: 260,
    pull: 185,
    endBurst: { radius: 130, dmg: 650, stun: 0.5 },
    aiRange: 440,
  },
};

export function getFusion(elementA, elementB) {
  return FUSIONS[fusionKey(elementA, elementB)] || null;
}

/** Les 4 fusions possibles pour un élément donné (pour le menu). */
export function fusionsFor(element) {
  return Object.values(FUSIONS)
    .filter((f) => f.key.split('+').includes(element))
    .map((f) => ({ fusion: f, other: f.key.split('+').find((e) => e !== element) }));
}
