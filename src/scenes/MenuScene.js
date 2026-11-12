// ─────────────────────────────────────────────────────────────
//  MenuScene — choisir son personnage puis lancer un match.
//
//  L'écran est dessiné dans un rectangle de référence de 844 × 390
//  (un iPhone en paysage), mis à l'échelle et centré dans la zone sûre.
//  Les personnages y sont animés (mêmes pantins qu'en match).
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { music } from '../audio/Music.js';
import { sfx } from '../audio/Sfx.js';
import { CHARACTERS, CHARACTER_IDS, STAT_MAX } from '../config/characters.js';
import { TILE } from '../config/constants.js';
import { ELEMENTS } from '../config/elements.js';
import { fusionsFor } from '../config/fusions.js';
import { CharacterRig } from '../render/CharacterRig.js';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from '../sim/BotAI.js';
import { Buttons } from '../ui/Buttons.js';
import { COLORS, addText, fitWidth, hex, mix, textResFor } from '../ui/theme.js';
import { fitCamera, isIOS, isStandalone, isTouchDevice } from '../ui/viewport.js';

const REF_W = 844;
const REF_H = 390;
const EMBLEM = 162; // taille d'un emblème dans l'atlas (px)

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

    this.rigs = [];
    this.ui = [];
    this.buttons = new Buttons(this);
    this.layout();
    this.onViewport = () => this.layout();
    this.game.events.on('viewport-changed', this.onViewport);
    this.events.once('shutdown', () => this.game.events.off('viewport-changed', this.onViewport));
    music.play('menu');
  }

  /** Taille d'écran modifiée (rotation…) : on refait tout, fond compris. */
  layout() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.rigs = [];
    this.ui = [];
    const zoom = fitCamera(this, REF_W, REF_H);
    this.textRes = textResFor(zoom);
    this.drawBackground();
    this.rebuild();
  }

  /** (Re)construit l'interface (pas le fond animé) : à chaque sélection. */
  rebuild() {
    for (const o of this.ui) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    for (const r of this.rigs) r.rig.destroy();
    this.rigs = [];
    this.buttons.clear();
    const before = new Set(this.children.list);

    this.drawHeader();
    this.drawCards();
    this.drawDetails();
    this.drawFusions();
    this.drawPlay();
    if (this.helpOpen) this.drawHelp();

    this.ui = this.children.list.filter((o) => !before.has(o));
  }

  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    const t = time / 1000;
    for (const r of this.rigs) {
      if (r.mode === 'idle') {
        r.rig.update(dt, { aim: 0.45 + Math.sin(t * 0.9 + r.phase) * 0.45, moveX: 0, moveY: 0 });
      } else if (r.mode === 'walk') {
        // Carte sélectionnée : le personnage trottine sur place et tire de temps en temps
        if (Math.floor(t / 1.3 + r.phase) !== r.beat) {
          r.beat = Math.floor(t / 1.3 + r.phase);
          r.rig.attack();
        }
        r.rig.update(dt, { aim: Math.sin(t * 1.1) * 0.5, moveX: 0.9, moveY: 0 });
      } else {
        // Grand portrait : il vise tout autour de lui et fait une démonstration de tir
        if (Math.floor(t / 1.1) !== r.beat) {
          r.beat = Math.floor(t / 1.1);
          r.rig.attack();
        }
        r.rig.update(dt, { aim: 0.5 + Math.sin(t * 0.8) * 1.1, moveX: 0, moveY: 0 });
      }
    }
  }

  addRig(id, x, y, scale, mode, depth = 5) {
    const rig = new CharacterRig(this, id, scale);
    rig.setPosition(x, y).setDepth(depth);
    this.rigs.push({ rig, mode, phase: this.rigs.length * 1.7, beat: -1 });
    return rig;
  }

  // ── Fond animé (persistant) ────────────────────────────────

  drawBackground() {
    const g = this.add.graphics().setDepth(-10);
    g.fillGradientStyle(0x16224a, 0x16224a, 0x0a0f22, 0x0a0f22, 1);
    g.fillRect(-3000, -3000, 6844, 6390);
    // Halos aux couleurs des 5 éléments, qui dérivent lentement
    const spots = [
      [90, 60, 'feu'],
      [760, 40, 'eau'],
      [420, 430, 'terre'],
      [800, 330, 'foudre'],
      [40, 340, 'vent'],
    ];
    spots.forEach(([x, y, el], i) => {
      const img = this.add.image(x, y, 'dot').setTint(ELEMENTS[el].color).setAlpha(0.2).setDisplaySize(440, 440).setBlendMode('ADD').setDepth(-9);
      this.tweens.add({
        targets: img,
        x: x + (i % 2 ? 60 : -60),
        y: y + (i % 3 ? -40 : 40),
        alpha: 0.12,
        duration: 5200 + i * 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
    // Particules des cinq éléments qui montent doucement
    const frames = [
      ['flame', 0.5, 'ADD'],
      ['drop', 0.5, 'NORMAL'],
      ['rock', 0.5, 'NORMAL'],
      ['spark', 0.6, 'ADD'],
      ['wind', 0.6, 'NORMAL'],
    ];
    frames.forEach(([frame, scale, blendMode], i) => {
      this.add
        .particles(0, 0, 'fx', {
          frame,
          x: { min: -40, max: REF_W + 40 },
          y: REF_H + 30,
          lifespan: { min: 7000, max: 11000 },
          speedY: { min: -62, max: -30 },
          speedX: { min: -14, max: 14 },
          scale: { start: scale, end: scale * 0.4 },
          alpha: { start: 0.55, end: 0 },
          rotate: { min: -40, max: 40 },
          frequency: 1500,
          delay: i * 300,
          blendMode,
          advance: 6000,
        })
        .setDepth(-8);
    });
  }

  // ── En-tête ────────────────────────────────────────────────

  drawHeader() {
    // Titre : chaque lettre prend la couleur d'un élément et ondule
    const colors = ['feu', 'foudre', 'vent', 'eau', 'terre'].map((e) => ELEMENTS[e].color);
    let x = 28;
    'ÉLÉMENTA'.split('').forEach((ch, i) => {
      const t = addText(this, x, 5, ch, { size: 31, color: hex(mix(colors[i % 5], 0xffffff, 0.3)), stroke: '#05070f', strokeW: 6 });
      this.tweens.add({ targets: t, y: 2, duration: 900, delay: i * 110, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      x += t.width - 6;
    });
    const titleEnd = x + 10;

    // Boutons de droite, placés de droite à gauche
    let bx = REF_W - 28;
    const pill = (label, w, on, onTap, gold = false) => {
      bx -= w;
      const g = this.add.graphics();
      g.fillStyle(on ? 0x2f7bd6 : COLORS.panelLight, 1);
      g.fillRoundedRect(bx, 9, w, 27, 10);
      if (gold) {
        g.lineStyle(1.5, COLORS.gold, 0.9);
        g.strokeRoundedRect(bx, 9, w, 27, 10);
      }
      const t = addText(this, bx + w / 2, 22.5, label, {
        size: 11.5,
        ox: 0.5,
        oy: 0.5,
        color: gold ? hex(COLORS.gold) : on ? '#ffffff' : '#93a0c4',
      });
      fitWidth(t, w - 8);
      this.buttons.add({ x: bx - 2, y: 3, w: w + 4, h: 39, onTap });
      bx -= 5;
    };
    pill('?', 30, false, () => {
      this.helpOpen = true;
      this.rebuild();
    }, true);
    pill('Musique', 62, music.enabled, () => {
      music.toggle();
      this.rebuild();
    });
    pill('Sons', 46, !sfx.muted, () => {
      sfx.toggle();
      this.rebuild();
    });
    bx -= 8;
    // Difficulté des bots adverses
    [...DIFFICULTIES].reverse().forEach((d) => {
      pill(d.name, 60, d.id === this.difficulty, () => {
        this.difficulty = d.id;
        save('elementa.difficulty', d.id);
        this.rebuild();
      });
    });
    const buttonsStart = bx;

    // Astuce : seulement s'il reste assez de place entre le titre et les boutons
    let tip = 'Brawler élémentaire 3 contre 3';
    if (isIOS() && !isStandalone()) tip = 'Plein écran : bouton Partager → « Sur l’écran d’accueil »';
    else if (!isTouchDevice()) tip = 'ZQSD / flèches · clic = tirer · Espace = super · F = fusion';
    const room = buttonsStart - titleEnd - 14;
    if (room >= 96) {
      addText(this, titleEnd, 22.5, tip, { size: 10, color: '#9aa6c8', bold: false, oy: 0.5, wrap: room, lineSpacing: -1 });
    }
  }

  // ── Cartes des personnages ─────────────────────────────────

  drawCards() {
    const cw = 150;
    const ch = 122;
    const gap = 9;
    const x0 = (REF_W - (cw * 5 + gap * 4)) / 2;
    const y0 = 48;
    CHARACTER_IDS.forEach((id, i) => {
      const def = CHARACTERS[id];
      const el = ELEMENTS[def.element];
      const x = x0 + i * (cw + gap);
      const on = id === this.selected;
      const g = this.add.graphics();
      if (on) {
        g.fillStyle(el.color, 0.35);
        g.fillRoundedRect(x - 4, y0 - 4, cw + 8, ch + 8, 18);
      }
      g.fillGradientStyle(
        mix(COLORS.panelLight, el.color, on ? 0.5 : 0.16),
        mix(COLORS.panelLight, el.color, on ? 0.5 : 0.16),
        mix(COLORS.panel, el.color, on ? 0.2 : 0.04),
        mix(COLORS.panel, el.color, on ? 0.2 : 0.04),
        1,
      );
      g.fillRoundedRect(x, y0, cw, ch, 14);
      g.lineStyle(on ? 3 : 1.5, on ? mix(el.color, 0xffffff, 0.35) : COLORS.panelLine, 1);
      g.strokeRoundedRect(x, y0, cw, ch, 14);
      // Petit socle lumineux sous le personnage
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(x + cw / 2, y0 + 90, 62, 15);
      g.fillStyle(el.color, on ? 0.5 : 0.22);
      g.fillEllipse(x + cw / 2, y0 + 88, 74, 19);

      this.addRig(id, x + cw / 2, y0 + 66, on ? 1.06 : 0.96, on ? 'walk' : 'idle');
      this.add.image(x + 19, y0 + 19, 'fx', `em_${def.element}`).setScale(26 / EMBLEM).setDepth(6);
      fitWidth(addText(this, x + cw / 2, y0 + 108, def.name, { size: 15, ox: 0.5, oy: 0.5, stroke: '#05070f', strokeW: 4, depth: 6 }), cw - 16);

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

  // ── Fiche du personnage sélectionné ────────────────────────

  drawDetails() {
    const def = CHARACTERS[this.selected];
    const el = ELEMENTS[def.element];
    const x = 29;
    const y = 180;
    const w = 492;
    const h = 202;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.94);
    g.fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(1.5, COLORS.panelLine, 1);
    g.strokeRoundedRect(x, y, w, h, 14);

    // Grand portrait animé, sous un projecteur à la couleur de l'élément
    const px = x + 84;
    this.add.image(px, y + 104, 'dot').setTint(el.color).setAlpha(0.42).setDisplaySize(230, 230).setBlendMode('ADD');
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(px, y + 171, 118, 24);
    g.fillStyle(el.color, 0.45);
    g.fillEllipse(px, y + 168, 136, 30);
    g.lineStyle(2, mix(el.color, 0xffffff, 0.5), 0.8);
    g.strokeEllipse(px, y + 168, 136, 30);
    const rig = this.addRig(this.selected, px, y + 126, 1.85, 'show');
    rig.spawnT = 0; // il surgit en rebondissant à chaque sélection

    // Colonne de texte
    const tx = x + 172;
    const tw = w - 172 - 16;
    this.add.image(tx + 12, y + 24, 'fx', `em_${def.element}`).setScale(26 / EMBLEM);
    const name = addText(this, tx + 30, y + 24, def.name, { size: 23, oy: 0.5 });
    addText(this, tx + 38 + name.width, y + 26, `${el.name} · ${def.role}`, { size: 12, oy: 0.5, color: hex(el.light) });
    fitWidth(addText(this, tx, y + 46, def.tagline, { size: 11.5, color: '#9aa6c8', bold: false, oy: 0.5 }), tw);

    const stats = [
      ['PV', def.hp / STAT_MAX.hp, String(def.hp)],
      ['Vitesse', def.speed / STAT_MAX.speed, String(def.speed)],
      ['Portée', def.attack.range / STAT_MAX.range, `${(def.attack.range / TILE).toFixed(1).replace('.', ',')} cases`],
    ];
    stats.forEach(([label, pct, value], i) => {
      const sy = y + 68 + i * 17;
      addText(this, tx, sy, label, { size: 11, oy: 0.5, color: '#c9d3ee' });
      g.fillStyle(0x0a0d18, 1);
      g.fillRoundedRect(tx + 52, sy - 4.5, 150, 9, 4.5);
      g.fillStyle(el.color, 1);
      g.fillRoundedRect(tx + 52, sy - 4.5, Math.max(9, 150 * Math.min(1, pct)), 9, 4.5);
      g.fillStyle(0xffffff, 0.3);
      g.fillRoundedRect(tx + 54, sy - 3.5, Math.max(5, 150 * Math.min(1, pct) - 4), 3, 1.5);
      addText(this, tx + 210, sy, value, { size: 11, oy: 0.5, color: '#9aa6c8', bold: false });
    });

    const blocks = [
      ['ATTAQUE', def.attack.name, def.attack.desc, '#ffffff'],
      ['SUPER', def.super.name, def.super.desc, hex(COLORS.super)],
    ];
    blocks.forEach(([tag, title, desc, color], i) => {
      const by = y + 120 + i * 40;
      fitWidth(addText(this, tx, by, `${tag} — ${title}`, { size: 12.5, color }), tw);
      addText(this, tx, by + 15, desc, { size: 10.5, color: '#9aa6c8', bold: false, wrap: tw, lineSpacing: -1 });
    });
  }

  // ── Fusions possibles ──────────────────────────────────────

  drawFusions() {
    const def = CHARACTERS[this.selected];
    const x = 530;
    const y = 180;
    const w = 285;
    const h = 138;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.94);
    g.fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(1.5, COLORS.panelLine, 1);
    g.strokeRoundedRect(x, y, w, h, 14);
    addText(this, x + 14, y + 8, 'FUSIONS AVEC UN ALLIÉ', { size: 12.5, color: hex(COLORS.fusion) });
    addText(this, x + 14, y + 24, '2 supers chargés + être proches', { size: 10, color: '#9aa6c8', bold: false });

    fusionsFor(def.element).forEach(({ fusion, other }, i) => {
      const fy = y + 51 + i * 22.5;
      const el = ELEMENTS[other];
      this.add.image(x + 24, fy, 'fx', `em_${def.element}`).setScale(19 / EMBLEM);
      this.add.image(x + 40, fy, 'fx', `em_${other}`).setScale(19 / EMBLEM);
      addText(this, x + 56, fy, `+ ${el.name}`, { size: 11, oy: 0.5, color: hex(el.light) });
      fitWidth(addText(this, x + 116, fy, fusion.name, { size: 12.5, oy: 0.5 }), w - 126);
    });
  }

  // ── Bouton JOUER ───────────────────────────────────────────

  drawPlay() {
    const b = { x: 530, y: 326, w: 285, h: 56 };
    const g = this.add.graphics();
    const paint = (pressed) => {
      g.clear();
      g.fillStyle(0x8a5a00, 1);
      g.fillRoundedRect(b.x, b.y + 5, b.w, b.h, 16);
      g.fillGradientStyle(0xffe27a, 0xffe27a, pressed ? 0xe0a81e : 0xffbf2e, pressed ? 0xe0a81e : 0xffbf2e, 1);
      g.fillRoundedRect(b.x, b.y + (pressed ? 3 : 0), b.w, b.h, 16);
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(b.x + 8, b.y + 5 + (pressed ? 3 : 0), b.w - 16, 12, 6);
    };
    paint(false);
    const label = addText(this, b.x + b.w / 2, b.y + b.h / 2 + 1, 'JOUER', { size: 30, ox: 0.5, oy: 0.5, color: '#4a3200' });
    this.tweens.add({ targets: label, scale: 1.07, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.buttons.add({
      ...b,
      onPress: (pressed) => {
        paint(pressed);
        label.y = b.y + b.h / 2 + 1 + (pressed ? 3 : 0);
      },
      onTap: () => this.startMatch(),
    });
  }

  // ── Aide ───────────────────────────────────────────────────

  /** Panneau « Comment jouer » par-dessus le menu. */
  drawHelp() {
    this.buttons.clear(); // les boutons du menu sont inactifs tant que l'aide est ouverte
    const D = 100;
    const g = this.add.graphics().setDepth(D);
    g.fillStyle(0x05070f, 0.86);
    g.fillRect(-3000, -3000, 6844, 6390);
    const x = 72;
    const y = 14;
    const w = 700;
    const h = 362;
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(2, COLORS.gold, 0.9);
    g.strokeRoundedRect(x, y, w, h, 18);
    addText(this, REF_W / 2, y + 22, 'COMMENT JOUER', { size: 20, ox: 0.5, oy: 0.5, color: hex(COLORS.gold), depth: D });

    const touch = isTouchDevice();
    const lines = [
      [
        'COMMANDES',
        touch
          ? 'Pouce gauche : se déplacer. Pouce droit : viser, puis relâcher pour tirer (un simple tap = tir automatique).'
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
    if (isIOS() && !isStandalone()) {
      lines.push(['PLEIN ÉCRAN', 'Dans Safari : bouton Partager, puis « Sur l’écran d’accueil ». Lance ensuite le jeu depuis son icône.', 0x9fc6ff]);
    }
    let ly = y + 44;
    for (const [title, text, color] of lines) {
      addText(this, x + 22, ly, title, { size: 11.5, color: hex(color), depth: D });
      const t = addText(this, x + 132, ly, text, { size: 11.5, color: '#dfe6ff', bold: false, wrap: w - 154, lineSpacing: -1, depth: D });
      ly += Math.max(18, t.height) + 5;
    }

    const b = { x: REF_W / 2 - 110, y: y + h - 48, w: 220, h: 38 };
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
