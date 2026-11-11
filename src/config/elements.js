// Les 5 éléments. `color` = teinte principale, `light`/`dark` = variantes pour les effets.
export const ELEMENTS = {
  feu: { id: 'feu', name: 'Feu', color: 0xff5533, light: 0xffb199, dark: 0xa32a12 },
  eau: { id: 'eau', name: 'Eau', color: 0x2f9bff, light: 0xa8d8ff, dark: 0x155a9e },
  terre: { id: 'terre', name: 'Terre', color: 0xb07a45, light: 0xe0bd95, dark: 0x6b4522 },
  foudre: { id: 'foudre', name: 'Foudre', color: 0xffd400, light: 0xfff0a0, dark: 0xa88a00 },
  vent: { id: 'vent', name: 'Vent', color: 0x52e0b8, light: 0xc4f7e8, dark: 0x1f8f72 },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS);

/** Couleurs d'équipe (contours, barres de vie, noms). */
export const TEAM_COLORS = {
  0: { main: 0x4d9bff, light: 0xb7d6ff, dark: 0x1d4f9e, css: '#4d9bff', name: 'Bleue' },
  1: { main: 0xff4d5e, light: 0xffb3ba, dark: 0x9e1d2a, css: '#ff4d5e', name: 'Rouge' },
};
