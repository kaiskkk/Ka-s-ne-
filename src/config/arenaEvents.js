// ─────────────────────────────────────────────────────────────
//  ARÈNE VIVANTE — événements aléatoires (un toutes les 30 s).
//  Chaque match en tire 3 différents parmi cette liste.
// ─────────────────────────────────────────────────────────────
export const ARENA_EVENTS = {
  lave: {
    id: 'lave',
    name: 'Coulée de lave',
    hint: 'Le sol s’embrase : évitez les cases rouges !',
    color: 0xff5a1f,
    dps: 450,
    blobs: 5, // nombre de flaques par moitié de carte
    blobSize: [4, 7],
  },
  brouillard: {
    id: 'brouillard',
    name: 'Brouillard',
    hint: 'On n’y voit plus rien… sauf les porteurs de cristaux.',
    color: 0xb8c4d6,
  },
  murs: {
    id: 'murs',
    name: 'Murs mobiles',
    hint: 'Des murs coulissent le long des rails !',
    color: 0x9aa7ff,
  },
  orage: {
    id: 'orage',
    name: 'Orage',
    hint: 'La foudre va tomber : sortez des cercles !',
    color: 0xffe14d,
    every: 0.55, // un éclair toutes les 0,55 s
    delay: 0.95, // avertissement avant l'impact
    radius: 92,
    dmg: 700,
  },
};

export const ARENA_EVENT_IDS = Object.keys(ARENA_EVENTS);
