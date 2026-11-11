// ─────────────────────────────────────────────────────────────
//  Carte de l'arène, décrite en ASCII.
//
//  On ne dessine que la MOITIÉ GAUCHE (17 colonnes, la dernière étant la
//  colonne centrale) : la moitié droite est générée par symétrie miroir,
//  ce qui garantit une carte équitable pour les deux équipes.
//
//    #  mur            b  buisson (on s'y cache)
//    .  sol            A  point d'apparition (devient celui de l'équipe rouge à droite)
//    C  cristal (colonne centrale uniquement)
// ─────────────────────────────────────────────────────────────

const HALF = [
  '#################',
  '#................',
  '#....bb...##.....',
  '#....bb...##..bbb',
  '#................', // ← rail des murs mobiles (ligne 4)
  '#...##......#....',
  '#.A.##...bb.#....',
  '#........bb.....C',
  '#.............#..',
  '#.A...##......#.C',
  '#.............#..',
  '#........bb.....C',
  '#.A.##...bb.#....',
  '#...##......#....',
  '#................', // ← rail des murs mobiles (ligne 14)
  '#....bb...##..bbb',
  '#....bb...##.....',
  '#................',
  '#################',
];

function mirrorRow(half) {
  const left = half.slice(0, -1); // sans la colonne centrale
  const right = left.split('').reverse().join('').replace(/A/g, 'B');
  return half + right;
}

/**
 * Murs mobiles (événement « murs mobiles »). Coordonnées en cases.
 * Chaque mur fait l'aller-retour entre `from` et `to` (coin haut-gauche).
 * Règle de conception : les rails ne se croisent pas et laissent toujours
 * au moins une case libre à chaque bout (personne ne peut être écrasé).
 */
const MOVERS = [
  // Rail du haut (ligne 4) : deux blocs symétriques qui se rapprochent du centre
  { w: 2, h: 1, from: [6, 4], to: [13, 4] },
  { w: 2, h: 1, from: [25, 4], to: [18, 4] },
  // Rail du bas (ligne 14)
  { w: 2, h: 1, from: [6, 14], to: [13, 14] },
  { w: 2, h: 1, from: [25, 14], to: [18, 14] },
  // Deux blocs verticaux devant chaque base (colonnes 8 et 24)
  { w: 1, h: 2, from: [8, 6], to: [8, 11] },
  { w: 1, h: 2, from: [24, 11], to: [24, 6] },
];

export const MAPS = {
  carrefour: {
    id: 'carrefour',
    name: 'Carrefour des Cristaux',
    rows: HALF.map(mirrorRow),
    movers: MOVERS,
    moverSpeed: 110, // px/s
  },
};

export const DEFAULT_MAP = 'carrefour';
