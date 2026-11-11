// ─────────────────────────────────────────────────────────────
//  Les 5 personnages d'ÉLÉMENTA (créations originales).
//  Toutes les stats sont ici : modifie ce fichier pour équilibrer le jeu.
//
//  Unités : distances en pixels monde (1 case = 64 px), vitesses en px/s,
//  durées en secondes, angles en radians.
// ─────────────────────────────────────────────────────────────

export const CHARACTERS = {
  // ── FEU ────────────────────────────────────────────────────
  braz: {
    id: 'braz',
    name: 'Braz',
    element: 'feu',
    role: 'Attaquant',
    shape: 'triangle',
    tagline: 'Dégâts de zone à moyenne portée.',
    hp: 3600,
    speed: 215,
    radius: 26,
    attack: {
      name: 'Salve ardente',
      desc: '3 boules de feu en éventail.',
      kind: 'spread',
      count: 3,
      spread: 0.3, // ouverture totale de l'éventail
      dmg: 380,
      speed: 640,
      range: 420,
      projRadius: 9,
      reload: 1.5, // secondes pour recharger 1 munition
      cooldown: 0.4, // délai mini entre deux tirs
      visual: 'feu',
    },
    super: {
      name: 'Boule de magma',
      desc: "Explose à l'impact et laisse un brasier au sol.",
      kind: 'bomb',
      dmg: 1000,
      radius: 115,
      speed: 560,
      range: 470,
      projRadius: 16,
      zone: { dur: 3, dps: 240 },
      need: 3400, // dégâts à infliger pour charger le super
    },
    ai: { range: 320, superRange: 430 },
  },

  // ── EAU ────────────────────────────────────────────────────
  ondine: {
    id: 'ondine',
    name: 'Ondine',
    element: 'eau',
    role: 'Soutien',
    shape: 'circle',
    tagline: 'Tirs perçants et zone de soin.',
    hp: 3300,
    speed: 215,
    radius: 25,
    attack: {
      name: "Trait d'eau",
      desc: 'Un jet rapide qui traverse les ennemis.',
      kind: 'single',
      dmg: 660,
      speed: 720,
      range: 540,
      projRadius: 10,
      pierce: true,
      reload: 1.3,
      cooldown: 0.45,
      visual: 'eau',
    },
    super: {
      name: 'Source vive',
      desc: 'Zone qui soigne les alliés et ralentit les ennemis.',
      kind: 'healZone',
      range: 420,
      radius: 150,
      dur: 5,
      hps: 520,
      enemySlow: 0.65,
      need: 3000,
    },
    ai: { range: 410, superRange: 400 },
  },

  // ── TERRE ──────────────────────────────────────────────────
  dolmen: {
    id: 'dolmen',
    name: 'Dolmen',
    element: 'terre',
    role: 'Tank',
    shape: 'square',
    tagline: 'Très résistant, redoutable au corps à corps.',
    hp: 5200,
    speed: 190,
    radius: 30,
    attack: {
      name: 'Éclats de roc',
      desc: '5 éclats à courte portée : dévastateur de près.',
      kind: 'spread',
      count: 5,
      spread: 0.75,
      dmg: 290,
      speed: 600,
      range: 235,
      projRadius: 8,
      reload: 1.6,
      cooldown: 0.5,
      visual: 'terre',
    },
    super: {
      name: 'Charge de granit',
      desc: 'Fonce droit devant, étourdit les ennemis percutés et se protège.',
      kind: 'dash',
      dist: 380,
      dur: 0.42,
      dmg: 900,
      stun: 0.9,
      knock: 140,
      dr: 0.4, // réduction de dégâts
      drDur: 3,
      need: 3300,
    },
    ai: { range: 165, superRange: 330 },
  },

  // ── FOUDRE ─────────────────────────────────────────────────
  volta: {
    id: 'volta',
    name: 'Volta',
    element: 'foudre',
    role: 'Tireuse',
    shape: 'diamond',
    tagline: 'Longue portée, fragile mais rapide.',
    hp: 2800,
    speed: 235,
    radius: 24,
    attack: {
      name: 'Arc voltaïque',
      desc: 'Éclair longue portée qui rebondit sur un 2ᵉ ennemi.',
      kind: 'single',
      dmg: 740,
      speed: 1050,
      range: 580,
      projRadius: 7,
      chain: { radius: 180, factor: 0.5 },
      reload: 1.6,
      cooldown: 0.5,
      visual: 'foudre',
    },
    super: {
      name: 'Coup de tonnerre',
      desc: 'Rayon instantané qui transperce et étourdit tout sur sa ligne.',
      kind: 'beam',
      dmg: 1300,
      range: 640,
      width: 44,
      stun: 0.6,
      need: 3400,
    },
    ai: { range: 460, superRange: 600 },
  },

  // ── VENT ───────────────────────────────────────────────────
  alize: {
    id: 'alize',
    name: 'Alizé',
    element: 'vent',
    role: 'Éclaireuse',
    shape: 'pentagon',
    tagline: 'La plus rapide : harcèle et repousse.',
    hp: 3000,
    speed: 250,
    radius: 24,
    attack: {
      name: 'Lames de vent',
      desc: '2 lames rapides tirées coup sur coup.',
      kind: 'burst',
      count: 2,
      interval: 0.13,
      dmg: 400,
      speed: 820,
      range: 450,
      projRadius: 9,
      reload: 1.25,
      cooldown: 0.4,
      visual: 'vent',
    },
    super: {
      name: 'Bourrasque',
      desc: 'Souffle qui repousse les ennemis, dissipe leurs tirs et accélère Alizé.',
      kind: 'gust',
      dmg: 500,
      range: 330,
      halfAngle: 0.65,
      knock: 320,
      haste: 1.35,
      hasteDur: 3,
      need: 3200,
    },
    ai: { range: 330, superRange: 260 },
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS);

/** Valeurs max servant à normaliser les barres de stats du menu. */
export const STAT_MAX = {
  hp: 5200,
  speed: 250,
  range: 580,
};
