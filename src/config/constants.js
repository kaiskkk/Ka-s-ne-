// ─────────────────────────────────────────────────────────────
//  ÉLÉMENTA — constantes de jeu (tout l'équilibrage global est ici)
// ─────────────────────────────────────────────────────────────

/** Taille d'une case de l'arène, en pixels « monde ». */
export const TILE = 64;

/** Pas fixe de la simulation (60 Hz). Le rendu interpole entre deux pas. */
export const SIM_DT = 1 / 60;

export const TEAM_ALLY = 0; // équipe du joueur (bleue), apparaît à gauche
export const TEAM_ENEMY = 1; // équipe adverse (rouge), apparaît à droite
export const TEAM_NEUTRAL = -1; // dangers de l'arène (lave, orage…)

export const MATCH = {
  duration: 120, // 2 minutes
  countdown: 3, // « 3, 2, 1, GO ! »
  teamSize: 3,
  respawnTime: 3,
  spawnShield: 2.5, // invulnérabilité après réapparition (annulée si on attaque)
};

export const CRYSTAL = {
  count: 3,
  // Instant d'apparition de chaque cristal au centre (s).
  // Échelonnés pour que le premier combat ne décide pas de tout le match
  // (avec [0, 0, 0] — tous dès le coup d'envoi — un match dure ~35 s en moyenne).
  spawnTimes: [0, 20, 40],
  holdToWin: 15, // secondes à garder les 3 cristaux pour gagner
  pickupRadius: 22,
  dropLock: 0.6, // délai avant de pouvoir ramasser un cristal lâché
  damageBonus: 0.1, // +10 % de dégâts par cristal porté
  superPerSec: 0.03, // +3 %/s de charge du super par cristal porté
};

export const COMBAT = {
  maxAmmo: 3,
  regenDelay: 3, // secondes sans combat avant de régénérer
  regenRate: 0.13, // fraction des PV max régénérée par seconde
  passiveSuperPerSec: 0.02, // le super se charge un peu tout seul
  revealTime: 1.0, // on reste visible 1 s après avoir tiré / été touché
  bushRevealDist: 115, // distance à laquelle on voit quelqu'un caché dans un buisson
  fogVision: 330, // rayon de vision pendant l'événement « brouillard »
  blindVision: 105, // rayon de vision quand on est aveuglé (vapeur)
};

export const FUSION = {
  range: 240, // distance max entre les deux coéquipiers
  targetRange: 380, // portée de placement des fusions « de zone »
};

export const ARENA_EVENT = {
  interval: 30, // un événement toutes les 30 s
  warning: 3, // secondes d'avertissement avant l'activation
  duration: 20, // durée de l'effet
};

/** Vue caméra : hauteur du monde visible (px monde) et largeur minimale garantie. */
export const VIEW = {
  height: 540, // ~8,5 cases de haut : les personnages sont bien visibles sur un téléphone
  minWidth: 880,
  maxDpr: 2, // plafond de densité de pixels (performances iPhone)
};
