// ─────────────────────────────────────────────────────────────
//  MenuScene — choisir son personnage puis lancer un match.
//
//  L'écran est dessiné dans un rectangle de référence de 844 × 390
//  (un iPhone en paysage), mis à l'échelle et centré dans la zone sûre.
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { sfx } from '../audio/Sfx.js';
import { CHARACTERS, CHARACTER_IDS, STAT_MAX } from '../config/characters.js';
import { TILE } from '../config/constants.js';
import { ELEMENTS } from '../config/elements.js';
import { fusionsFor } from '../config/fusions.js';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from '../sim/BotAI.js';
import { Buttons } from '../ui/Buttons.js';
import { drawCharacter } from '../ui/shapes.js';
import { COLORS, addText, hex, mix, textResFor } from '../ui/theme.js';
import { fitCamera, isIOS, isStandalone, isTouchDevice } from '../ui/viewport.js';

const REF_W = 844;
const REF_H = 390;

function load(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.selected = load('elementa.char', 'braz');
    if (!CHARACTERS[this.selected]) this.selected = 'braz';
    this.difficulty = load('elementa.difficulty', DEFAULT_DIFFICULTY);
    if (!DIFFICULTIES.some((d) => d.id === this.difficulty)) this.difficulty = DEFAULT_DIFFICULTY;

    // L'aide s'ouvre toute seule au tout premier lancement
    this.helpOpen = load('elementa.helpSeen', '') !== '1';

    this.buttons = new Buttons(this);
    this.rebuild();
    this.onViewport = () => this.rebuild();
    this.game.events.on('viewport-changed', this.onViewport);
    this.events.once('shutdown', () => this.game.events.off('viewport-changed', this.onViewport));
  }

  /** (Re)construit tout l'écran : appelé au démarrage, à chaque sélection et à chaque rotation. */
  rebuild() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.buttons.clear();
    const zoom = fitCamera(this, REF_W, REF_H);
    this.textRes = textResFor(zoom);

    this.drawBackground();
    this.drawHeader();
    this.drawCards();
    this.drawDetails();
    this.drawFusions();
    this.drawPlay();
    if (this.helpOpen) this.drawHelp();
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg, 1);
    g.fillRect(-3000, -3000, 6844, 6390);
    // Halos aux couleurs des 5 éléments
    const spots = [
      [90, 60, 'feu'],
      [760, 40, 'eau'],
      [420, 420, 'terre'],
      [800, 330, 'foudre'],
      [40, 340, 'vent'],
    ];
    for (const [x, y, el] of spots) {
      this.add.image(x, y, 'dot').setTint(ELEMENTS[el].color).setAlpha(0.16).setDisplaySize(420, 420).setBlendMode('ADD');
    }
  }

  drawHeader() {
    // Titre : chaque lettre prend la couleur d'un élément
    const colors = ['feu', 'foudre', 'vent', 'eau', 'terre'].map((e) => ELEMENTS[e].color);
    let x = 28;
    'ÉLÉMENTA'.split('').forEach((ch, i) => {
      const t = addText(this, x, 6, ch, { size: 30, color: hex(mix(colors[i % 5], 0xffffff, 0.25)), stroke: '#05070f', strokeW: 5 });
      x += t.width - 5;
    });

    let tip = 'Brawler élémentaire 3 contre 3';
    if (isIOS() && !isStandalone()) tip = 'Plein écran : bouton Partager → « Sur l’écran d’accueil »';
    else if (!isTouchDevice()) tip = 'Clavier : ZQSD ou flèches · clic = tirer · Espace = super · F = fusion';
    addText(this, x + 10, 22, tip, { size: 10, color: '#9aa6c8', bold: false, oy: 0.5, wrap: 436 - x });

    // Difficulté des bots adverses
    const dw = 62;
    const dx = 448;
    DIFFICULTIES.forEach((d, i) => {
      const bx = dx + i * (dw + 4);
      const on = d.id === this.difficulty;
      const g = this.add.graphics();
      g.fillStyle(on ? 0x2f7bd6 : COLORS.panelLight, 1);
      g.fillRoundedRect(bx, 9, dw, 26, 9);
      addText(this, bx + dw / 2, 22, d.name, { size: 11, ox: 0.5, oy: 0.5, color: on ? '#ffffff' : '#9aa6c8' });
      this.buttons.add({
        x: bx,
        y: 4,
        w: dw,
        h: 36,
        onTap: () => {
          this.difficulty = d.id;
          save('elementa.difficulty', d.id);
          this.rebuild();
        },
      });
    });

    // Son
    const sx = 652;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panelLight, 1);
    g.fillRoundedRect(sx, 9, 68, 26, 9);
    addText(this, sx + 34, 22, sfx.muted ? 'Son : non' : 'Son : oui', { size: 11, ox: 0.5, oy: 0.5, color: '#c9d3ee' });
    this.buttons.add({
      x: sx,
      y: 4,
      w: 68,
      h: 36,
      onTap: () => {
        sfx.toggle();
        this.rebuild();
      },
    });

    // Aide
    const hx = 728;
    g.fillStyle(COLORS.panelLight, 1);
    g.fillRoundedRect(hx, 9, 88, 26, 9);
    g.lineStyle(1.5, COLORS.gold, 0.8);
    g.strokeRoundedRect(hx, 9, 88, 26, 9);
    addText(this, hx + 44, 22, 'Comment jouer', { size: 11, ox: 0.5, oy: 0.5, color: hex(COLORS.gold) });
    this.buttons.add({
      x: hx,
      y: 4,
      w: 88,
      h: 36,
      onTap: () => {
        this.helpOpen = true;
        this.rebuild();
      },
    });
  }

  /** Panneau « Comment jouer » par-dessus le menu. */
  drawHelp() {
    this.buttons.clear(); // les boutons du menu sont inactifs tant que l'aide est ouverte
    const D = 100;
    const g = this.add.graphics().setDepth(D);
    g.fillStyle(0x05070f, 0.82);
    g.fillRect(-3000, -3000, 6844, 6390);
    const x = 72;
    const y = 16;
    const w = 700;
    const h = 358;
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(2, COLORS.gold, 0.9);
    g.strokeRoundedRect(x, y, w, h, 18);
    addText(this, REF_W / 2, y + 24, 'COMMENT JOUER', { size: 20, ox: 0.5, oy: 0.5, color: hex(COLORS.gold), depth: D });

    const touch = isTouchDevice();
    const lines = [
      [
        'COMMANDES',
        touch
          ? 'Joystick gauche : se déplacer. Joystick droit : viser, puis relâcher pour tirer (un simple tap = tir automatique).'
          : 'ZQSD ou flèches : se déplacer. Souris : viser, clic pour tirer. Espace : super. F : fusion. Échap : pause.',
        0xffffff,
      ],
      ['SUPER', 'Il se charge en touchant les ennemis. Tap sur le bouton = visée automatique, glisser = viser soi-même.', COLORS.super],
      [
        'FUSION',
        'Ton super ET celui d’un allié sont prêts, et vous êtes proches ? Le bouton FUSION s’allume : un combo qui dépend de vos deux éléments. Un allié prêt (anneau doré) vient te rejoindre.',
        COLORS.fusion,
      ],
      [
        'CRISTAUX',
        'Ramasse-les au centre : chaque cristal porté donne +10 % de dégâts et charge ton super, mais te rend visible de tous (et tu lâches tout en mourant). L’équipe qui porte les 3 pendant 15 s gagne.',
        COLORS.crystal,
      ],
      ['BUISSONS', 'Tu y es invisible pour l’ennemi, sauf de très près ou juste après avoir tiré.', 0x55c878],
      ['ARÈNE VIVANTE', 'Toutes les 30 s : lave, brouillard, murs mobiles ou orage. Un bandeau prévient 3 s avant.', 0xff8a4d],
    ];
    let ly = y + 50;
    for (const [title, text, color] of lines) {
      addText(this, x + 22, ly, title, { size: 12, color: hex(color), depth: D });
      const t = addText(this, x + 138, ly, text, { size: 12, color: '#dfe6ff', bold: false, wrap: w - 160, depth: D });
      ly += Math.max(20, t.height) + 7;
    }

    const b = { x: REF_W / 2 - 110, y: y + h - 52, w: 220, h: 40 };
    g.fillStyle(0x8a5a00, 1);
    g.fillRoundedRect(b.x, b.y + 3, b.w, b.h, 12);
    g.fillStyle(COLORS.gold, 1);
    g.fillRoundedRect(b.x, b.y, b.w, b.h, 12);
    addText(this, REF_W / 2, b.y + b.h / 2, 'C’EST PARTI', { size: 17, ox: 0.5, oy: 0.5, color: '#3a2a00', depth: D });
    // Toucher n'importe où ferme l'aide
    this.buttons.add({
      x: -3000,
      y: -3000,
      w: 6844,
      h: 6390,
      onTap: () => {
        this.helpOpen = false;
        save('elementa.helpSeen', '1');
        this.rebuild();
      },
    });
  }

  drawCards() {
    const cw = 150;
    const ch = 114;
    const gap = 9;
    const x0 = (REF_W - (cw * 5 + gap * 4)) / 2;
    const y0 = 48;
    CHARACTER_IDS.forEach((id, i) => {
      const def = CHARACTERS[id];
      const el = ELEMENTS[def.element];
      const x = x0 + i * (cw + gap);
      const on = id === this.selected;
      const g = this.add.graphics();
      g.fillStyle(on ? mix(COLORS.panelLight, el.color, 0.28) : COLORS.panel, 1);
      g.fillRoundedRect(x, y0, cw, ch, 14);
      g.lineStyle(on ? 3 : 1.5, on ? el.color : COLORS.panelLine, 1);
      g.strokeRoundedRect(x, y0, cw, ch, 14);

      const icon = this.add.graphics();
      drawCharacter(icon, def.shape, 21, el.color, on ? 0xffffff : el.dark, 3, el.light);
      icon.setPosition(x + cw / 2, y0 + 36).setRotation(-Math.PI / 2);
      if (on) {
        this.tweens.add({ targets: icon, scale: 1.12, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      addText(this, x + cw / 2, y0 + 78, def.name, { size: 17, ox: 0.5, oy: 0.5 });
      addText(this, x + cw / 2, y0 + 98, `${el.name} · ${def.role}`, {
        size: 11,
        ox: 0.5,
        oy: 0.5,
        color: hex(el.light),
        bold: false,
      });
      this.buttons.add({
        x,
        y: y0,
        w: cw,
        h: ch,
        onTap: () => {
          if (this.selected === id) return;
          this.selected = id;
          save('elementa.char', id);
          this.rebuild();
        },
      });
    });
  }

  drawDetails() {
    const def = CHARACTERS[this.selected];
    const el = ELEMENTS[def.element];
    const x = 29;
    const y = 170;
    const w = 492;
    const h = 212;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(1.5, COLORS.panelLine, 1);
    g.strokeRoundedRect(x, y, w, h, 14);

    const name = addText(this, x + 16, y + 10, def.name, { size: 22 });
    addText(this, x + 24 + name.width, y + 24, `${el.name} · ${def.role}`, { size: 12, oy: 0.5, color: hex(el.light) });
    addText(this, x + 16, y + 40, def.tagline, { size: 12, color: '#9aa6c8', bold: false });

    // Barres de stats
    const stats = [
      ['PV', def.hp / STAT_MAX.hp, String(def.hp)],
      ['Vitesse', def.speed / STAT_MAX.speed, String(def.speed)],
      ['Portée', def.attack.range / STAT_MAX.range, `${(def.attack.range / TILE).toFixed(1).replace('.', ',')} cases`],
    ];
    stats.forEach(([label, pct, value], i) => {
      const sy = y + 70 + i * 19;
      addText(this, x + 16, sy, label, { size: 11, oy: 0.5, color: '#c9d3ee' });
      g.fillStyle(0x0a0d18, 1);
      g.fillRoundedRect(x + 72, sy - 4, 150, 8, 4);
      g.fillStyle(el.color, 1);
      g.fillRoundedRect(x + 72, sy - 4, Math.max(8, 150 * Math.min(1, pct)), 8, 4);
      addText(this, x + 230, sy, value, { size: 11, oy: 0.5, color: '#9aa6c8', bold: false });
    });

    // Attaque et super
    const blocks = [
      ['ATTAQUE', def.attack.name, def.attack.desc, '#ffffff'],
      ['SUPER', def.super.name, def.super.desc, hex(COLORS.super)],
    ];
    blocks.forEach(([tag, title, desc, color], i) => {
      const by = y + 130 + i * 39;
      addText(this, x + 16, by, `${tag} — ${title}`, { size: 12, color });
      addText(this, x + 16, by + 15, desc, { size: 11, color: '#9aa6c8', bold: false, wrap: w - 32 });
    });

    // Grand portrait à droite du panneau
    const portrait = this.add.graphics();
    this.add.image(x + w - 96, y + 76, 'dot').setTint(el.color).setAlpha(0.35).setDisplaySize(190, 190).setBlendMode('ADD');
    drawCharacter(portrait, def.shape, 42, el.color, 0xffffff, 4, el.light);
    portrait.setPosition(x + w - 96, y + 76).setRotation(-Math.PI / 2);
    this.tweens.add({ targets: portrait, y: y + 70, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  drawFusions() {
    const def = CHARACTERS[this.selected];
    const x = 530;
    const y = 170;
    const w = 285;
    const h = 148;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(1.5, COLORS.panelLine, 1);
    g.strokeRoundedRect(x, y, w, h, 14);
    addText(this, x + 14, y + 9, 'FUSIONS AVEC UN ALLIÉ', { size: 12, color: hex(COLORS.fusion) });
    addText(this, x + 14, y + 25, '2 supers chargés + être proches', { size: 10, color: '#9aa6c8', bold: false });

    fusionsFor(def.element).forEach(({ fusion, other }, i) => {
      const fy = y + 52 + i * 24;
      const el = ELEMENTS[other];
      g.fillStyle(ELEMENTS[def.element].color, 1);
      g.fillCircle(x + 22, fy, 7);
      g.fillStyle(el.color, 1);
      g.fillCircle(x + 34, fy, 7);
      g.lineStyle(1.5, 0x0a0d18, 1);
      g.strokeCircle(x + 34, fy, 7);
      addText(this, x + 50, fy, `+ ${el.name}`, { size: 11, oy: 0.5, color: hex(el.light) });
      addText(this, x + 112, fy, fusion.name, { size: 12, oy: 0.5 });
    });
  }

  drawPlay() {
    const b = { x: 530, y: 326, w: 285, h: 56 };
    const g = this.add.graphics();
    const paint = (pressed) => {
      g.clear();
      g.fillStyle(0x8a5a00, 1);
      g.fillRoundedRect(b.x, b.y + 4, b.w, b.h, 16);
      g.fillStyle(pressed ? 0xe0a81e : COLORS.gold, 1);
      g.fillRoundedRect(b.x, b.y + (pressed ? 3 : 0), b.w, b.h, 16);
    };
    paint(false);
    const label = addText(this, b.x + b.w / 2, b.y + b.h / 2, 'JOUER', { size: 28, ox: 0.5, oy: 0.5, color: '#3a2a00' });
    this.buttons.add({
      ...b,
      onPress: (pressed) => {
        paint(pressed);
        label.y = b.y + b.h / 2 + (pressed ? 3 : 0);
      },
      onTap: () => this.startMatch(),
    });
  }

  startMatch() {
    // Android / ordinateur tactile : plein écran + verrouillage paysage quand c'est possible.
    // (Sur iPhone, le plein écran s'obtient en ajoutant le jeu à l'écran d'accueil.)
    if (isTouchDevice() && !isIOS() && !isStandalone() && this.scale.fullscreen.available && !this.scale.isFullscreen) {
      try {
        this.scale.once('enterfullscreen', () => {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        });
        this.scale.startFullscreen();
      } catch {
        /* refusé : on joue dans la fenêtre */
      }
    }
    this.scene.start('Game', { charId: this.selected, difficulty: this.difficulty });
  }
}
