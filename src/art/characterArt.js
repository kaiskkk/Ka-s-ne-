// ─────────────────────────────────────────────────────────────
//  Dessin des 5 personnages d'ÉLÉMENTA (créations originales).
//
//  Chaque personnage est dessiné en PIÈCES séparées (tête, corps, pieds,
//  mains, arme, pupilles, paupières, accessoire animé) rangées dans un
//  atlas « char_<id> ». Le squelette animé (render/CharacterRig.js)
//  assemble et anime ces pièces : marche, tir, clignement, mort…
//
//  Style : cartoon coloré, grosse tête ronde, grands yeux, contours épais.
// ─────────────────────────────────────────────────────────────
import { Atlas, TAU, blob, circle, ellipse, line, linear, paint, poly, radial, roundRect } from './canvas.js';

/** Pixels de texture par pixel monde (les persos restent nets en gros plan). */
export const CHAR_SCALE = 4;

const LW = 2.3; // épaisseur des contours
const FACE_Y = 6; // centre du visage dans l'image « head » (il reste de la place au-dessus pour les cheveux)
const EYE_DX = 7.8;
const EYE_Y = FACE_Y + 1.5;

/**
 * Fiche de montage de chaque personnage, lue par CharacterRig.
 *  weapon  : arme tenue (longueur utile, distance au corps) ou null (poings)
 *  handR   : rayon visuel des mains
 *  extras  : pièces animées propres au personnage
 */
export const RIGS = {
  braz: { skin: 0xffc48a, weapon: { dist: 17, tip: 30 }, handR: 5.6, extra: 'flame' },
  ondine: { skin: 0xbfeeff, weapon: { dist: 14, tip: 38 }, handR: 5.4, extra: 'orb' },
  dolmen: { skin: 0xa58a68, weapon: null, handR: 9.5, extra: 'leaf', wide: true },
  volta: { skin: 0xffe0bd, weapon: { dist: 15, tip: 34 }, handR: 5.4, extra: 'spark' },
  alize: { skin: 0xffe8d2, weapon: { dist: 16, tip: 26 }, handR: 5.4, extra: 'scarf' },
};

// ── Éléments communs ─────────────────────────────────────────

function eyes(c, lineColor, rx = 6.4, ry = 7.7) {
  for (const s of [-1, 1]) {
    ellipse(c, s * EYE_DX, EYE_Y, rx, ry);
    paint(c, '#ffffff', lineColor, 1.7);
  }
}

function blush(c, color, y = FACE_Y + 8.5, dx = 14.5) {
  for (const s of [-1, 1]) {
    ellipse(c, s * dx, y, 4.2, 2.6);
    paint(c, color);
  }
}

function smile(c, lineColor, y = FACE_Y + 10.5, w = 5.5, open = false) {
  c.beginPath();
  c.arc(0, y - 2, w, 0.18 * Math.PI, 0.82 * Math.PI);
  if (open) {
    c.closePath();
    paint(c, '#7a2a2a', lineColor, 1.8);
  } else {
    paint(c, null, lineColor, 2);
  }
}

function pupil(a, iris, glow = false) {
  a.add('pupil', 11, 11, (c) => {
    if (glow) {
      circle(c, 0, 0, 5.2);
      paint(c, radial(c, 0, 0, 0, 5.2, [[0, '#fff6c2'], [0.45, iris], [1, 'rgba(255,170,30,0)']]));
      return;
    }
    circle(c, 0, 0, 4.1);
    paint(c, iris);
    circle(c, 0, 0.3, 2.3);
    paint(c, '#15121c');
    circle(c, -1.4, -1.5, 1.35);
    paint(c, '#ffffff');
  });
}

/** Paupières fermées (clignement) : deux ovales couleur peau avec un trait de cils. */
function lids(a, skinCss, lineColor) {
  a.add('lids', 36, 20, (c) => {
    for (const s of [-1, 1]) {
      ellipse(c, s * EYE_DX, 0, 6.9, 8.2);
      paint(c, skinCss);
      c.beginPath();
      c.arc(s * EYE_DX, -1.5, 5.6, 0.12 * Math.PI, 0.88 * Math.PI);
      paint(c, null, lineColor, 2);
    }
  });
}

function foot(a, fill, lineColor, toe = null) {
  a.add('foot', 18, 14, (c) => {
    ellipse(c, 0, 0, 6.8, 4.9);
    paint(c, fill, lineColor, 2);
    if (toe) {
      ellipse(c, 0, 1.4, 4.2, 2.2);
      paint(c, toe);
    }
  });
}

function hand(a, fill, lineColor, r = 5.6) {
  const size = r * 2 + 5;
  a.add('hand', size, size, (c) => {
    circle(c, 0, 0, r);
    paint(c, fill, lineColor, 2);
    circle(c, -r * 0.3, -r * 0.3, r * 0.35);
    paint(c, 'rgba(255,255,255,0.35)');
  });
}

function torso(a, draw) {
  a.add('body', 46, 38, draw);
}

// ── BRAZ (Feu) ───────────────────────────────────────────────
// Petit forgeron au tempérament volcanique : chevelure de flammes, canon à braises.

function drawBraz(a) {
  const ln = '#6a2c14';
  a.add('head', 72, 76, (c) => {
    ellipse(c, 0, FACE_Y, 21, 19.5);
    paint(c, linear(c, 0, FACE_Y - 20, 0, FACE_Y + 20, [[0, '#ffd6a8'], [1, '#f2a566']]), ln, LW);
    // Mèches rouge braise à la racine de la flamme
    blob(c, [[-19, FACE_Y - 7], [-12, FACE_Y - 22], [-3, FACE_Y - 15], [4, FACE_Y - 23], [12, FACE_Y - 16], [19, FACE_Y - 8], [9, FACE_Y - 11], [0, FACE_Y - 8], [-9, FACE_Y - 11]]);
    paint(c, linear(c, 0, FACE_Y - 22, 0, FACE_Y - 8, [[0, '#ff6a2a'], [1, '#c92812']]), ln, LW);
    eyes(c, ln);
    // Gros sourcils froncés
    line(c, -14, FACE_Y - 7.5, -3.5, FACE_Y - 4, ln, 3.4);
    line(c, 14, FACE_Y - 7.5, 3.5, FACE_Y - 4, ln, 3.4);
    blush(c, 'rgba(255,110,60,0.45)');
    // Sourire carnassier avec une dent
    smile(c, ln, FACE_Y + 11, 6.2, true);
    roundRect(c, -4.4, FACE_Y + 10.3, 3.4, 3, 1);
    paint(c, '#ffffff');
  });

  torso(a, (c) => {
    blob(c, [[-16, -8], [0, -13], [16, -8], [17, 8], [0, 14], [-17, 8]]);
    paint(c, linear(c, 0, -13, 0, 14, [[0, '#d8421f'], [1, '#9c2410']]), ln, LW);
    // Tablier de forgeron sombre + ceinture
    roundRect(c, -9, -4, 18, 15, 4);
    paint(c, '#4a2418', ln, 1.6);
    roundRect(c, -16.5, 2, 33, 5, 2);
    paint(c, '#ffb13a', ln, 1.6);
    roundRect(c, -3.5, 1, 7, 7, 2);
    paint(c, '#fff0a0', ln, 1.4);
  });

  foot(a, '#5a2a16', ln, '#8a4a26');
  hand(a, '#f7b377', ln);
  pupil(a, '#8a3a0c');
  lids(a, '#f8b87c', ln);

  // Canon à braises : fût de bronze, gueule incandescente (pointe vers la droite, poignée à gauche)
  a.add('weapon', 44, 26, (c) => {
    roundRect(c, -18, -4, 12, 12, 3); // poignée
    paint(c, '#5a2a16', ln, 1.8);
    roundRect(c, -12, -8, 28, 15, 5); // fût
    paint(c, linear(c, 0, -8, 0, 7, [[0, '#f0a94a'], [0.5, '#c9792b'], [1, '#8a4a1a']]), ln, LW);
    roundRect(c, -4, -9.5, 4.5, 18, 2); // cerclage
    paint(c, '#6b3a16', ln, 1.4);
    roundRect(c, 12, -10, 7, 19, 3); // bouche du canon
    paint(c, '#7a4018', ln, 1.8);
    ellipse(c, 17, -0.5, 3.2, 6.5);
    paint(c, radial(c, 17, -0.5, 0, 6.5, [[0, '#fff6b0'], [0.5, '#ffb13a'], [1, '#e8361a']]));
    line(c, -8, -4.5, 8, -4.5, 'rgba(255,255,255,0.45)', 2);
  });

  // Flamme (cheveux) : la base est en bas de l'image
  a.add('flame', 36, 44, (c) => {
    blob(c, [[0, 20], [-13, 14], [-15, 0], [-8, -8], [-9, -18], [0, -8], [5, -21], [10, -6], [15, 2], [12, 14]]);
    paint(c, linear(c, 0, 20, 0, -20, [[0, '#e8361a'], [0.45, '#ff7a1f'], [1, '#ffd23a']]), '#b3260e', 2);
    blob(c, [[0, 18], [-7, 12], [-7, 2], [-2, -4], [1, -12], [5, -2], [8, 6], [6, 14]]);
    paint(c, linear(c, 0, 18, 0, -12, [[0, '#ff9a2a'], [1, '#fff3a0']]));
  });
}

// ── ONDINE (Eau) ─────────────────────────────────────────────
// Esprit des sources : capuche en goutte d'eau, bâton de corail et orbe d'eau.

function drawOndine(a) {
  const ln = '#1d5486';
  a.add('head', 72, 76, (c) => {
    // Capuche d'eau : grosse goutte dont la pointe s'enroule comme une vague
    blob(c, [[-24, FACE_Y + 6], [-25, FACE_Y - 10], [-14, FACE_Y - 24], [2, FACE_Y - 28], [16, FACE_Y - 34], [24, FACE_Y - 26], [15, FACE_Y - 22], [24, FACE_Y - 10], [24, FACE_Y + 6], [14, FACE_Y + 19], [0, FACE_Y + 22], [-14, FACE_Y + 19]]);
    paint(c, linear(c, 0, FACE_Y - 34, 0, FACE_Y + 22, [[0, '#5cc2ff'], [1, '#1f7fd1']]), ln, LW);
    // Reflet
    c.beginPath();
    c.arc(-9, FACE_Y - 10, 13, 1.05 * Math.PI, 1.45 * Math.PI);
    paint(c, null, 'rgba(255,255,255,0.7)', 3);
    // Visage
    ellipse(c, 0, FACE_Y + 2, 17.5, 16.5);
    paint(c, linear(c, 0, FACE_Y - 14, 0, FACE_Y + 18, [[0, '#dff7ff'], [1, '#a9e2fb']]), ln, 2);
    eyes(c, ln, 6.2, 7.5);
    // Longs cils
    for (const s of [-1, 1]) {
      line(c, s * (EYE_DX + 5.5), EYE_Y - 4, s * (EYE_DX + 9), EYE_Y - 6.5, ln, 1.8);
      line(c, s * (EYE_DX + 6.2), EYE_Y - 0.5, s * (EYE_DX + 9.8), EYE_Y - 1.5, ln, 1.8);
    }
    blush(c, 'rgba(255,140,190,0.5)', FACE_Y + 9.5, 12.5);
    smile(c, ln, FACE_Y + 12.5, 3.6);
  });

  torso(a, (c) => {
    // Robe en cloche
    blob(c, [[-12, -9], [0, -13], [12, -9], [18, 10], [0, 15], [-18, 10]]);
    paint(c, linear(c, 0, -13, 0, 15, [[0, '#2f9bff'], [1, '#155a9e']]), ln, LW);
    // Liseré d'écume
    c.beginPath();
    c.moveTo(-17, 8);
    for (let i = 0; i < 6; i++) c.quadraticCurveTo(-14 + i * 5.8, 3.5, -11.2 + i * 5.8, 8.5);
    paint(c, null, '#eafaff', 2.6);
    // Perle
    circle(c, 0, -5, 3.2);
    paint(c, '#eafaff', ln, 1.4);
  });

  foot(a, '#155a9e', ln, '#2f9bff');
  hand(a, '#c9efff', ln, 5.4);
  pupil(a, '#1565c0');
  lids(a, '#bfe9fb', ln);

  // Bâton de corail (pointe vers la droite) : l'orbe d'eau flotte au bout
  a.add('weapon', 50, 22, (c) => {
    roundRect(c, -22, -2.4, 34, 4.8, 2.4);
    paint(c, linear(c, 0, -3, 0, 3, [[0, '#ffc2d1'], [1, '#e8809a']]), '#8f3d55', 1.8);
    // Fourche de corail qui enserre l'orbe
    c.beginPath();
    c.moveTo(10, 0);
    c.quadraticCurveTo(13, -9, 21, -8);
    c.moveTo(10, 0);
    c.quadraticCurveTo(13, 9, 21, 8);
    paint(c, null, '#8f3d55', 5.2);
    c.beginPath();
    c.moveTo(10, 0);
    c.quadraticCurveTo(13, -9, 21, -8);
    c.moveTo(10, 0);
    c.quadraticCurveTo(13, 9, 21, 8);
    paint(c, null, '#ff9db5', 2.8);
    for (const x of [-16, -8, 0]) line(c, x, -2.4, x + 2, 2.4, 'rgba(143,61,85,0.5)', 1.3);
  });

  a.add('orb', 20, 20, (c) => {
    circle(c, 0, 0, 7.6);
    paint(c, radial(c, -2, -2, 0, 9, [[0, '#eaffff'], [0.5, '#6fd0ff'], [1, '#1f7fd1']]), ln, 1.8);
    circle(c, -2.6, -2.8, 2.2);
    paint(c, 'rgba(255,255,255,0.9)');
  });
}

// ── DOLMEN (Terre) ───────────────────────────────────────────
// Petit golem de pierre moussue aux yeux d'ambre, avec d'énormes poings de roc.

function drawDolmen(a) {
  const ln = '#4a3a28';
  a.add('head', 72, 76, (c) => {
    blob(c, [[-22, FACE_Y + 4], [-21, FACE_Y - 11], [-10, FACE_Y - 19], [6, FACE_Y - 20], [19, FACE_Y - 13], [22, FACE_Y + 3], [17, FACE_Y + 17], [0, FACE_Y + 20], [-17, FACE_Y + 17]]);
    paint(c, linear(c, 0, FACE_Y - 20, 0, FACE_Y + 20, [[0, '#c4a988'], [1, '#927653']]), ln, LW);
    // Arcade sourcilière massive
    blob(c, [[-18, FACE_Y - 2], [-17, FACE_Y - 9], [0, FACE_Y - 7], [17, FACE_Y - 9], [18, FACE_Y - 2], [0, FACE_Y - 1.5]]);
    paint(c, '#7d6444', ln, 1.8);
    // Orbites sombres (les pupilles lumineuses viennent par-dessus)
    for (const s of [-1, 1]) {
      ellipse(c, s * EYE_DX, EYE_Y + 0.5, 6, 6.6);
      paint(c, '#2a2018', ln, 1.6);
    }
    // Bouche : simple fissure
    c.beginPath();
    c.moveTo(-6, FACE_Y + 12.5);
    c.lineTo(-2, FACE_Y + 11);
    c.lineTo(2, FACE_Y + 12.8);
    c.lineTo(6.5, FACE_Y + 11.4);
    paint(c, null, ln, 2.2);
    // Fissures et éclats
    c.beginPath();
    c.moveTo(13, FACE_Y - 16);
    c.lineTo(11, FACE_Y - 11);
    c.lineTo(15, FACE_Y - 8);
    paint(c, null, 'rgba(74,58,40,0.7)', 1.5);
    circle(c, -14, FACE_Y + 9, 1.6);
    paint(c, 'rgba(74,58,40,0.45)');
    circle(c, 15, FACE_Y + 8, 1.2);
    paint(c, 'rgba(74,58,40,0.45)');
    // Calotte de mousse
    blob(c, [[-20, FACE_Y - 11], [-13, FACE_Y - 22], [0, FACE_Y - 25], [13, FACE_Y - 22], [20, FACE_Y - 12], [12, FACE_Y - 14], [6, FACE_Y - 10], [0, FACE_Y - 15], [-7, FACE_Y - 11], [-13, FACE_Y - 15]]);
    paint(c, linear(c, 0, FACE_Y - 25, 0, FACE_Y - 10, [[0, '#9ad65c'], [1, '#5c9a38']]), '#3a6a22', 2);
  });

  torso(a, (c) => {
    blob(c, [[-20, -7], [0, -13], [20, -7], [21, 8], [0, 15], [-21, 8]]);
    paint(c, linear(c, 0, -13, 0, 15, [[0, '#a58a68'], [1, '#77603f']]), ln, LW);
    // Rune verte lumineuse
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(-5, 1);
    c.lineTo(0, 8);
    c.lineTo(5, 1);
    c.closePath();
    paint(c, null, '#b9ff7a', 2.4);
    circle(c, 0, 1, 1.8);
    paint(c, '#eaffc2');
    // Mousse sur l'épaule
    blob(c, [[-19, -5], [-13, -11], [-5, -10], [-9, -5], [-14, -2]]);
    paint(c, '#7cbf4a', '#3a6a22', 1.6);
  });

  // Pieds : blocs de pierre
  a.add('foot', 20, 15, (c) => {
    roundRect(c, -8, -5.2, 16, 10.4, 4);
    paint(c, '#6b5741', ln, 2);
    line(c, -4, -2.5, 3, -2.5, 'rgba(255,255,255,0.25)', 1.6);
  });

  // Poings de roc
  a.add('hand', 26, 26, (c) => {
    blob(c, [[-10, 0], [-8, -8], [0, -10.5], [8, -8], [10.5, 0], [8, 8], [0, 10], [-8, 8]]);
    paint(c, linear(c, 0, -10, 0, 10, [[0, '#c4a988'], [1, '#8a6f4d']]), ln, LW);
    for (const y of [-4, 0.5, 5]) line(c, 3.5, y, 8, y, 'rgba(74,58,40,0.65)', 1.5);
    circle(c, -3.5, -4, 2.6);
    paint(c, 'rgba(255,255,255,0.28)');
  });

  pupil(a, '#ffb21e', true);
  lids(a, '#2a2018', '#4a3a28');

  // Petite pousse sur la tête (se balance) : la base est en bas
  a.add('leaf', 22, 22, (c) => {
    line(c, 0, 10, 0, 0, '#3a6a22', 2.4);
    blob(c, [[0, 1], [-9, -3], [-8, -9], [-1, -5]]);
    paint(c, '#9ad65c', '#3a6a22', 1.6);
    blob(c, [[0, 1], [9, -4], [7, -10], [1, -5]]);
    paint(c, '#b6e86e', '#3a6a22', 1.6);
  });
}

// ── VOLTA (Foudre) ───────────────────────────────────────────
// Inventrice survoltée : cheveux en éclairs, lunettes d'aviatrice, bâton-foudre.

function drawVolta(a) {
  const ln = '#5a3d12';
  a.add('head', 72, 76, (c) => {
    // Cheveux en pointes d'éclair (derrière le visage)
    poly(c, [[-21, FACE_Y + 4], [-29, FACE_Y - 6], [-21, FACE_Y - 8], [-27, FACE_Y - 22], [-15, FACE_Y - 18], [-14, FACE_Y - 32], [-4, FACE_Y - 22], [3, FACE_Y - 35], [9, FACE_Y - 22], [19, FACE_Y - 30], [18, FACE_Y - 16], [29, FACE_Y - 17], [21, FACE_Y - 5], [27, FACE_Y + 3], [20, FACE_Y + 6]]);
    paint(c, linear(c, 0, FACE_Y - 35, 0, FACE_Y + 6, [[0, '#fff27a'], [1, '#ffc400']]), '#9a6f00', LW);
    // Visage
    ellipse(c, 0, FACE_Y + 1, 20, 18.5);
    paint(c, linear(c, 0, FACE_Y - 18, 0, FACE_Y + 20, [[0, '#ffe9cf'], [1, '#f6c79a']]), ln, LW);
    // Frange en zigzag
    poly(c, [[-19, FACE_Y - 6], [-17, FACE_Y - 17], [-8, FACE_Y - 19], [-10, FACE_Y - 11], [-2, FACE_Y - 16], [-2, FACE_Y - 9], [8, FACE_Y - 18], [16, FACE_Y - 16], [19, FACE_Y - 6], [12, FACE_Y - 11], [9, FACE_Y - 6], [3, FACE_Y - 9], [-6, FACE_Y - 5], [-12, FACE_Y - 9]]);
    paint(c, '#ffd400', '#9a6f00', 1.9);
    eyes(c, ln, 6.2, 7.2);
    // Paupières tombantes = regard assuré
    for (const s of [-1, 1]) line(c, s * (EYE_DX - 6.5), EYE_Y - 5.2, s * (EYE_DX + 6.5), EYE_Y - 6.4, ln, 2.4);
    blush(c, 'rgba(255,150,120,0.45)');
    // Sourire en coin
    c.beginPath();
    c.moveTo(-4.5, FACE_Y + 10.5);
    c.quadraticCurveTo(1, FACE_Y + 13.5, 6.5, FACE_Y + 9);
    paint(c, null, ln, 2);
    // Lunettes d'aviatrice relevées sur le front
    roundRect(c, -17, FACE_Y - 16.5, 34, 4, 2);
    paint(c, '#3a2a5a', '#231a3a', 1.4);
    for (const s of [-1, 1]) {
      circle(c, s * 7.5, FACE_Y - 15, 5.6);
      paint(c, '#c9cfe0', '#231a3a', 1.8);
      circle(c, s * 7.5, FACE_Y - 15, 3.6);
      paint(c, radial(c, s * 7.5 - 1, FACE_Y - 16, 0, 4, [[0, '#d9c8ff'], [1, '#6a3df0']]));
    }
  });

  torso(a, (c) => {
    blob(c, [[-15, -8], [0, -13], [15, -8], [17, 8], [0, 14], [-17, 8]]);
    paint(c, linear(c, 0, -13, 0, 14, [[0, '#3a45a0'], [1, '#232a66']]), '#151a40', LW);
    // Col jaune
    blob(c, [[-10, -10], [0, -6], [10, -10], [8, -5], [0, -1.5], [-8, -5]]);
    paint(c, '#ffd400', '#9a6f00', 1.5);
    // Éclair sur la poitrine
    poly(c, [[2, -1], [-4, 5], [-0.5, 5], [-3, 11], [5, 3.5], [1, 3.5]]);
    paint(c, '#ffe84d', '#9a6f00', 1.3);
  });

  foot(a, '#1b2150', '#0f1330', '#ffd400');
  hand(a, '#f9d2aa', ln, 5.4);
  pupil(a, '#6a3df0');
  lids(a, '#f8d5b0', ln);

  // Bâton-foudre : tige isolée, deux dents, étincelle entre les deux (pointe à droite)
  a.add('weapon', 48, 24, (c) => {
    roundRect(c, -21, -2.6, 30, 5.2, 2.6);
    paint(c, linear(c, 0, -3, 0, 3, [[0, '#8f9ac0'], [1, '#4a5380']]), '#232a4d', 1.8);
    for (const x of [-15, -10]) {
      roundRect(c, x, -3.6, 3, 7.2, 1.4);
      paint(c, '#ffd400', '#9a6f00', 1.2);
    }
    // Dents du diapason
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(7, s * 1.5);
      c.quadraticCurveTo(10, s * 9, 20, s * 7.5);
      paint(c, null, '#232a4d', 5.4);
      c.beginPath();
      c.moveTo(7, s * 1.5);
      c.quadraticCurveTo(10, s * 9, 20, s * 7.5);
      paint(c, null, '#c9cfe0', 3);
    }
    circle(c, 16.5, 0, 4.2);
    paint(c, radial(c, 16.5, 0, 0, 4.6, [[0, '#ffffff'], [0.5, '#ffe84d'], [1, 'rgba(255,200,0,0.2)']]));
  });

  // Étincelle au bout du bâton
  a.add('spark', 22, 22, (c) => {
    poly(c, [[0, -10], [2.2, -2.6], [9.5, -3], [3.5, 1.4], [6, 9], [0, 3.8], [-6, 9], [-3.5, 1.4], [-9.5, -3], [-2.2, -2.6]]);
    paint(c, radial(c, 0, 0, 0, 10, [[0, '#ffffff'], [0.6, '#fff27a'], [1, '#ffc400']]));
  });
}

// ── ALIZÉ (Vent) ─────────────────────────────────────────────
// Coursière du vent : mèche en volute, longue écharpe qui flotte, éventail.

function drawAlize(a) {
  const ln = '#2b6f5e';
  a.add('head', 72, 76, (c) => {
    // Chevelure : grande volute blanche et menthe
    blob(c, [[-22, FACE_Y + 8], [-24, FACE_Y - 8], [-15, FACE_Y - 22], [0, FACE_Y - 26], [14, FACE_Y - 24], [26, FACE_Y - 30], [30, FACE_Y - 20], [22, FACE_Y - 14], [23, FACE_Y - 2], [22, FACE_Y + 8], [12, FACE_Y + 14], [-12, FACE_Y + 14]]);
    paint(c, linear(c, 0, FACE_Y - 30, 0, FACE_Y + 14, [[0, '#ffffff'], [1, '#b9f5e4']]), ln, LW);
    // Spirale au bout de la mèche
    c.beginPath();
    c.arc(24.5, FACE_Y - 22.5, 4.2, 0.2 * Math.PI, 1.75 * Math.PI);
    paint(c, null, ln, 1.8);
    // Visage
    ellipse(c, 0, FACE_Y + 2, 19, 17.5);
    paint(c, linear(c, 0, FACE_Y - 16, 0, FACE_Y + 20, [[0, '#fff3e6'], [1, '#fbd9bd']]), ln, LW);
    // Frange balayée par le vent
    blob(c, [[-19, FACE_Y - 2], [-17, FACE_Y - 15], [-4, FACE_Y - 19], [12, FACE_Y - 17], [19, FACE_Y - 6], [10, FACE_Y - 10], [2, FACE_Y - 7], [-8, FACE_Y - 9]]);
    paint(c, linear(c, 0, FACE_Y - 19, 0, FACE_Y - 5, [[0, '#ffffff'], [1, '#c8f7ea']]), ln, 1.9);
    // Petite plume
    blob(c, [[-17, FACE_Y - 14], [-27, FACE_Y - 22], [-24, FACE_Y - 12]]);
    paint(c, '#52e0b8', ln, 1.6);
    eyes(c, ln, 6.6, 7.9);
    // Sourcils joyeux
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(s * EYE_DX, EYE_Y - 5, 6.5, s > 0 ? 1.25 * Math.PI : 1.4 * Math.PI, s > 0 ? 1.6 * Math.PI : 1.75 * Math.PI);
      paint(c, null, ln, 1.9);
    }
    blush(c, 'rgba(255,150,150,0.5)');
    // Taches de rousseur
    for (const s of [-1, 1]) for (const [dx, dy] of [[-1.5, 0], [1.5, -1.4], [3.2, 0.6]]) {
      circle(c, s * (11.5 + dx), FACE_Y + 6.4 + dy, 0.7);
      paint(c, 'rgba(180,110,80,0.6)');
    }
    smile(c, ln, FACE_Y + 11.5, 4.8, true);
  });

  torso(a, (c) => {
    blob(c, [[-14, -8], [0, -13], [14, -8], [16, 8], [0, 14], [-16, 8]]);
    paint(c, linear(c, 0, -13, 0, 14, [[0, '#ffffff'], [1, '#d5f5ec']]), ln, LW);
    // Ceinture drapée
    blob(c, [[-16, 1], [0, 4.5], [16, 1], [16, 6.5], [0, 10], [-16, 6.5]]);
    paint(c, '#1f8f72', ln, 1.6);
    // Écharpe nouée autour du cou
    blob(c, [[-13, -10], [0, -6.5], [13, -10], [12, -3.5], [0, 0.5], [-12, -3.5]]);
    paint(c, '#52e0b8', ln, 1.8);
  });

  foot(a, '#1f8f72', ln, '#52e0b8');
  hand(a, '#fde2cb', ln, 5.4);
  pupil(a, '#149a7d');
  lids(a, '#fbdcc2', ln);

  // Éventail : s'ouvre vers la droite, manche à gauche
  a.add('weapon', 44, 40, (c) => {
    roundRect(c, -19, -2.2, 13, 4.4, 2.2);
    paint(c, '#1f8f72', ln, 1.6);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a0 = -0.95 + (i / n) * 1.9;
      const a1 = -0.95 + ((i + 1) / n) * 1.9;
      c.beginPath();
      c.moveTo(-8, 0);
      c.arc(-8, 0, 26, a0, a1);
      c.closePath();
      paint(c, i % 2 ? '#52e0b8' : '#f4fffb', ln, 1.6);
    }
    c.beginPath();
    c.arc(-8, 0, 17, -0.95, 0.95);
    paint(c, null, 'rgba(31,143,114,0.6)', 1.6);
    circle(c, -8, 0, 2.6);
    paint(c, '#ffd24a', ln, 1.4);
  });

  // Pan d'écharpe flottant (attaché à gauche, s'effile vers la droite)
  a.add('scarf', 34, 14, (c) => {
    blob(c, [[-15, -4], [-2, -5.5], [14, -1.5], [15, 2], [2, 5], [-15, 4]]);
    paint(c, linear(c, -15, 0, 15, 0, [[0, '#52e0b8'], [1, '#9df5dd']]), ln, 1.8);
    line(c, -10, 0, 8, 0.5, 'rgba(255,255,255,0.5)', 1.4);
  });
}

const DRAWERS = { braz: drawBraz, ondine: drawOndine, dolmen: drawDolmen, volta: drawVolta, alize: drawAlize };

/** Génère les 5 atlas de personnages (une seule fois, au démarrage). */
export function buildCharacterAtlases(scene) {
  for (const id of Object.keys(DRAWERS)) {
    const key = `char_${id}`;
    if (scene.textures.exists(key)) continue;
    const atlas = new Atlas(scene, key, 1024, 512, CHAR_SCALE);
    DRAWERS[id](atlas);
    atlas.done();
  }
}

export { TAU };
