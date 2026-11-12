// ─────────────────────────────────────────────────────────────
//  HudScene — interface de jeu, affichée par-dessus GameScene.
//
//  COMMANDES TACTILES (multi-touch) :
//   • moitié gauche de l'écran  → joystick de déplacement (il se place sous le pouce)
//   • moitié droite             → joystick de visée : on relâche pour tirer ;
//                                 un simple tap = tir à visée automatique
//   • bouton SUPER              → tap = visée auto ; glisser = viser puis relâcher
//   • bouton FUSION             → s'allume quand un allié prêt est à portée
//
//  CLAVIER / SOURIS (ordinateur) : ZQSD ou WASD ou flèches pour bouger,
//  souris pour viser, clic pour tirer, Espace = super, F = fusion, Échap = pause.
//
//  Toutes les positions sont en pixels CSS et tiennent compte des marges de
//  sécurité de l'iPhone (encoche, Dynamic Island, barre d'accueil).
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { music } from '../audio/Music.js';
import { sfx } from '../audio/Sfx.js';
import { ARENA_EVENT, CRYSTAL, MATCH } from '../config/constants.js';
import { ARENA_EVENTS } from '../config/arenaEvents.js';
import { ELEMENTS, TEAM_COLORS } from '../config/elements.js';
import { getFusion } from '../config/fusions.js';
import { TAU, clamp } from '../sim/mathx.js';
import { controls } from '../ui/controls.js';
import { COLORS, addText, fitWidth, formatTime, hex, textResFor } from '../ui/theme.js';
import { uiCamera, viewport } from '../ui/viewport.js';

const DEAD_ZONE = 0.28; // en dessous, le joystick de visée est considéré « au repos »
const KEY_MOVES = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    this.gs = this.scene.get('Game');
    this.match = this.gs.match;
    this.player = this.gs.player;
    uiCamera(this);
    this.textRes = textResFor(viewport.dpr);

    this.keys = new Set();
    this.mouse = { seen: false, x: 0, y: 0 };
    this.moveStick = { pointer: null, ox: 0, oy: 0, vx: 0, vy: 0 };
    this.aimStick = { pointer: null, ox: 0, oy: 0, vx: 0, vy: 0, everActive: false };
    this.superTouch = null;
    this.mouseAim = null;
    this.fusionPartner = null;
    this.shown = {};
    this.feed = [];
    this.pauseButtons = [];

    this.build();
    this.layout();

    // Entrées
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.onKeyDown = (e) => this.keyDown(e);
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    // Événements venus de la partie
    this.gs.events.on('fx', this.onFx, this);
    this.gs.events.on('paused', this.onPaused, this);
    this.gs.events.on('playerHurt', this.onHurt, this);
    this.onViewport = () => this.layout();
    this.game.events.on('viewport-changed', this.onViewport);

    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      this.gs.events.off('fx', this.onFx, this);
      this.gs.events.off('paused', this.onPaused, this);
      this.gs.events.off('playerHurt', this.onHurt, this);
      this.game.events.off('viewport-changed', this.onViewport);
      controls.reset();
    });

    this.showBig(String(MATCH.countdown), 0xffffff);
    this.hint.setText('Gardez les 3 cristaux pendant 15 s pour gagner !');
  }

  // ── Construction ───────────────────────────────────────────

  build() {
    const D = { hud: 10, top: 20, banner: 30, pause: 50 };

    // Bords d'écran rouges : flash quand on est touché, pulsation quand la vie est basse
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0, 0).setTint(0xff2433).setAlpha(0).setDepth(D.hud - 2);
    this.hurt = 0;

    // Indicateurs hors écran (cristaux, porteurs)
    this.arrows = this.add.graphics().setDepth(D.hud - 1);

    // Joysticks
    const stick = () => ({
      base: this.add.circle(0, 0, 10, 0xffffff, 0.07).setStrokeStyle(2, 0xffffff, 0.35).setDepth(D.hud),
      knob: this.add.circle(0, 0, 10, 0xffffff, 0.3).setDepth(D.hud),
    });
    Object.assign(this.moveStick, stick());
    Object.assign(this.aimStick, stick());
    this.aimStick.knob.setFillStyle(0xff6b6b, 0.55);
    this.moveLabel = addText(this, 0, 0, 'DÉPLACER', { size: 10, ox: 0.5, oy: 0.5, alpha: 0.55, depth: D.hud });
    this.aimLabel = addText(this, 0, 0, 'VISER\nRELÂCHER = TIRER', {
      size: 10,
      ox: 0.5,
      oy: 0.5,
      align: 'center',
      alpha: 0.55,
      depth: D.hud,
    });

    // Boutons Super et Fusion
    this.buttonsG = this.add.graphics().setDepth(D.hud);
    this.superIcon = this.add.image(0, 0, 'fx', `em_${this.player.element}`).setDepth(D.hud + 0.5);
    this.fusionIconA = this.add.image(0, 0, 'fx', `em_${this.player.element}`).setDepth(D.hud + 0.5).setVisible(false);
    this.fusionIconB = this.add.image(0, 0, 'fx', 'em_feu').setDepth(D.hud + 0.6).setVisible(false);
    this.superLabel = addText(this, 0, 0, 'SUPER', { size: 11, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 3, depth: D.hud + 1 });
    this.fusionLabel = addText(this, 0, 0, 'FUSION', { size: 11, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 3, depth: D.hud + 1 });
    this.fusionName = addText(this, 0, 0, '', {
      size: 13,
      ox: 0.5,
      oy: 1,
      color: '#ffd9fb',
      stroke: '#0a0d18',
      strokeW: 4,
      align: 'center',
      depth: D.hud + 1,
    });

    // Bandeau du haut : cristaux bleus | chrono | cristaux rouges
    this.topG = this.add.graphics().setDepth(D.top);
    this.timer = addText(this, 0, 0, formatTime(MATCH.duration), { size: 19, ox: 0.5, oy: 0.5, depth: D.top + 1 });
    this.holdText = addText(this, 0, 0, '', {
      size: 15,
      ox: 0.5,
      oy: 0,
      stroke: '#0a0d18',
      strokeW: 4,
      depth: D.top + 1,
    });
    this.eventChip = addText(this, 0, 0, '', {
      size: 12,
      ox: 0.5,
      oy: 0,
      stroke: '#0a0d18',
      strokeW: 3,
      depth: D.top + 1,
    });

    // Bouton pause
    this.pauseG = this.add.graphics().setDepth(D.top);

    // Annonces
    this.big = addText(this, 0, 0, '', { size: 64, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 8, depth: D.banner });
    this.big.setVisible(false);
    this.hint = addText(this, 0, 0, '', {
      size: 15,
      ox: 0.5,
      oy: 0.5,
      stroke: '#0a0d18',
      strokeW: 4,
      align: 'center',
      depth: D.banner,
    });
    this.bannerBg = this.add.graphics().setDepth(D.banner);
    this.bannerTitle = addText(this, 0, 0, '', {
      size: 24,
      ox: 0.5,
      oy: 0.5,
      stroke: '#0a0d18',
      strokeW: 5,
      depth: D.banner + 1,
    });
    this.bannerSub = addText(this, 0, 0, '', { size: 13, ox: 0.5, oy: 0.5, color: '#e6ecff', depth: D.banner + 1 });
    this.bannerT = 0;
    this.respawnText = addText(this, 0, 0, '', {
      size: 22,
      ox: 0.5,
      oy: 0.5,
      stroke: '#0a0d18',
      strokeW: 5,
      depth: D.banner,
    });
    this.flashRect = this.add.rectangle(0, 0, 10, 10, 0xffffff, 1).setOrigin(0, 0).setDepth(D.banner - 1).setAlpha(0);

    // Grande annonce de FUSION : les emblèmes des deux éléments se percutent
    this.fxBand = this.add.graphics().setDepth(D.banner + 2).setAlpha(0);
    this.fxA = this.add.image(0, 0, 'fx', 'em_feu').setDepth(D.banner + 4).setVisible(false);
    this.fxB = this.add.image(0, 0, 'fx', 'em_eau').setDepth(D.banner + 4).setVisible(false);
    this.fxTag = addText(this, 0, 0, '', { size: 15, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 4, depth: D.banner + 3 });
    this.fxName = addText(this, 0, 0, '', { size: 34, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 7, depth: D.banner + 3 });
    this.fxTag.setAlpha(0);
    this.fxName.setAlpha(0);

    // Journal des éliminations (en haut à droite)
    this.feedTexts = [0, 1, 2].map(() =>
      addText(this, 0, 0, '', { size: 12, ox: 1, oy: 0, stroke: '#0a0d18', strokeW: 3, depth: D.top }),
    );

    // Menu pause
    this.pauseLayer = this.add.container(0, 0).setDepth(D.pause).setVisible(false);
  }

  /** Place tous les éléments selon la taille de l'écran et les zones sûres. */
  layout() {
    uiCamera(this);
    const W = viewport.width;
    const H = viewport.height;
    const s = viewport.safe;
    const u = clamp(H / 390, 0.85, 1.4);
    const m = 14 * u;
    this.W = W;
    this.H = H;
    this.u = u;
    this.R = 54 * u;

    const stickY = H - s.bottom - m - this.R - 8 * u;
    this.moveRest = { x: s.left + m + this.R + 22 * u, y: stickY };
    this.aimRest = { x: W - s.right - m - this.R - 22 * u, y: stickY };
    for (const st of [this.moveStick, this.aimStick]) {
      st.base.setRadius(this.R);
      st.knob.setRadius(24 * u);
    }
    if (!this.moveStick.pointer) this.placeStick(this.moveStick, this.moveRest.x, this.moveRest.y);
    if (!this.aimStick.pointer) this.placeStick(this.aimStick, this.aimRest.x, this.aimRest.y);
    this.moveLabel.setPosition(this.moveRest.x, this.moveRest.y - this.R - 12 * u);
    this.aimLabel.setPosition(this.aimRest.x, this.aimRest.y - this.R - 18 * u);

    this.superBtn = { x: this.aimRest.x - 124 * u, y: this.aimRest.y + 18 * u, r: 33 * u };
    this.fusionBtn = { x: this.aimRest.x - 78 * u, y: this.aimRest.y - 114 * u, r: 36 * u };
    this.superLabel.setPosition(this.superBtn.x, this.superBtn.y + this.superBtn.r - 7);
    this.fusionLabel.setPosition(this.fusionBtn.x, this.fusionBtn.y + this.fusionBtn.r - 7);
    this.superIcon.setPosition(this.superBtn.x, this.superBtn.y - 3);
    this.iconScale = (this.superBtn.r * 1.25) / 162; // l'emblème fait 162 px dans l'atlas
    this.vignette.setDisplaySize(W, H);
    this.fusionName.setPosition(this.fusionBtn.x, this.fusionBtn.y - this.fusionBtn.r - 6);

    this.topY = s.top + 24;
    this.timer.setPosition(W / 2, this.topY);
    this.holdText.setPosition(W / 2, this.topY + 22);
    this.eventChip.setPosition(W / 2, this.topY + 22);
    this.pauseBtn = { x: s.left + 12, y: s.top + 8, w: 38, h: 34 };
    this.drawPauseButton();
    this.drawTop(true);

    this.big.setPosition(W / 2, H * 0.4);
    this.hint.setPosition(W / 2, H * 0.4 + 62);
    this.bannerY = Math.max(this.topY + 80, H * 0.27);
    this.bannerTitle.setPosition(W / 2, this.bannerY - 9);
    this.bannerSub.setPosition(W / 2, this.bannerY + 16);
    this.respawnText.setPosition(W / 2, H * 0.62);
    this.flashRect.setSize(W, H);
    this.feedTexts.forEach((t, i) => t.setPosition(W - s.right - 12, s.top + 10 + i * 17));

    if (this.pauseLayer.visible) this.buildPauseMenu();
  }

  placeStick(st, x, y) {
    st.ox = x;
    st.oy = y;
    st.base.setPosition(x, y);
    st.knob.setPosition(x + st.vx * this.R, y + st.vy * this.R);
  }

  drawPauseButton() {
    const b = this.pauseBtn;
    const g = this.pauseG;
    g.clear();
    g.fillStyle(0x0a0d18, 0.55);
    g.fillRoundedRect(b.x, b.y, b.w, b.h, 9);
    g.lineStyle(2, 0xffffff, 0.35);
    g.strokeRoundedRect(b.x, b.y, b.w, b.h, 9);
    g.fillStyle(0xffffff, 0.9);
    g.fillRoundedRect(b.x + 12, b.y + 9, 5, b.h - 18, 2);
    g.fillRoundedRect(b.x + b.w - 17, b.y + 9, 5, b.h - 18, 2);
  }

  /** Bandeau du haut : chrono et cristaux de chaque équipe. */
  drawTop(force = false) {
    const cm = this.match.crystalMode;
    const key = `${cm.teamCount[0]}-${cm.teamCount[1]}`;
    if (!force && key === this.shown.top) return;
    this.shown.top = key;
    const g = this.topG;
    const cx = this.W / 2;
    const y = this.topY;
    g.clear();
    // Fond : pastille centrale + deux ailes aux couleurs des équipes
    g.fillStyle(TEAM_COLORS[0].dark, 0.85);
    g.fillRoundedRect(cx - 122, y - 15, 84, 30, { tl: 15, bl: 15, tr: 0, br: 0 });
    g.fillStyle(TEAM_COLORS[1].dark, 0.85);
    g.fillRoundedRect(cx + 38, y - 15, 84, 30, { tl: 0, bl: 0, tr: 15, br: 15 });
    g.fillStyle(0x0a0d18, 0.9);
    g.fillRoundedRect(cx - 42, y - 18, 84, 36, 10);
    g.lineStyle(2, 0xffffff, 0.25);
    g.strokeRoundedRect(cx - 42, y - 18, 84, 36, 10);
    // Cristaux portés (pleins) ou non (silhouettes)
    for (let team = 0; team < 2; team++) {
      for (let i = 0; i < CRYSTAL.count; i++) {
        const x = team === 0 ? cx - 58 - i * 22 : cx + 58 + i * 22;
        const has = i < cm.teamCount[team];
        g.fillStyle(has ? 0xffffff : 0x0a0d18, has ? 1 : 0.45);
        diamond(g, x, y, 7.5, 11);
        if (has) {
          g.fillStyle(COLORS.crystal, 1);
          diamond(g, x, y, 5.5, 9);
        }
      }
    }
  }

  // ── Entrées tactiles / souris ──────────────────────────────

  toUi(pointer) {
    return { x: pointer.x / viewport.dpr, y: pointer.y / viewport.dpr };
  }

  onDown(pointer) {
    sfx.unlock();
    const { x, y } = this.toUi(pointer);
    const g = this.gs;

    if (this.pauseLayer.visible) {
      for (const b of this.pauseButtons) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          sfx.play('click');
          b.action();
          return;
        }
      }
      return;
    }
    const pb = this.pauseBtn;
    if (x >= pb.x - 8 && x <= pb.x + pb.w + 8 && y >= pb.y - 8 && y <= pb.y + pb.h + 8) {
      sfx.play('click');
      g.setPaused(true);
      return;
    }
    if (g.ended) return;

    // Boutons d'action (prioritaires sur le joystick de visée)
    if (this.fusionPartner && Math.hypot(x - this.fusionBtn.x, y - this.fusionBtn.y) <= this.fusionBtn.r * 1.25) {
      controls.actions.push({ type: 'fusion' });
      return;
    }
    if (Math.hypot(x - this.superBtn.x, y - this.superBtn.y) <= this.superBtn.r * 1.25) {
      if (!this.superTouch) this.superTouch = { pointer, ox: x, oy: y, vx: 0, vy: 0, everActive: false };
      return;
    }

    if (!pointer.wasTouch) {
      // Souris : on vise directement vers le curseur, on relâche pour tirer
      this.mouseAim = { pointer };
      this.updateMouseAim(pointer);
      return;
    }
    if (x >= this.W * 0.5) {
      if (!this.aimStick.pointer) this.grabStick(this.aimStick, pointer, x, y);
    } else if (!this.moveStick.pointer) {
      this.grabStick(this.moveStick, pointer, x, y);
    }
  }

  grabStick(st, pointer, x, y) {
    st.pointer = pointer;
    st.vx = 0;
    st.vy = 0;
    st.everActive = false;
    // Le joystick apparaît sous le doigt, sans sortir de l'écran
    const s = viewport.safe;
    this.placeStick(
      st,
      clamp(x, s.left + this.R * 0.6, this.W - s.right - this.R * 0.6),
      clamp(y, s.top + this.R * 0.6, this.H - s.bottom - this.R * 0.6),
    );
    this.moveLabel.setVisible(false);
    this.aimLabel.setVisible(false);
  }

  onMove(pointer) {
    if (!pointer.wasTouch) {
      const p = this.toUi(pointer);
      this.mouse.seen = true;
      this.mouse.x = pointer.x;
      this.mouse.y = pointer.y;
      if (this.mouseAim && this.mouseAim.pointer === pointer) this.updateMouseAim(pointer);
      if (this.superTouch && this.superTouch.pointer === pointer) this.dragVector(this.superTouch, p.x, p.y, 60 * this.u);
      return;
    }
    const { x, y } = this.toUi(pointer);
    if (this.moveStick.pointer === pointer) this.dragVector(this.moveStick, x, y, this.R);
    else if (this.aimStick.pointer === pointer) this.dragVector(this.aimStick, x, y, this.R);
    else if (this.superTouch && this.superTouch.pointer === pointer) this.dragVector(this.superTouch, x, y, 60 * this.u);
  }

  /** Met à jour le vecteur (−1…1) d'un joystick à partir de la position du doigt. */
  dragVector(st, x, y, radius) {
    let vx = (x - st.ox) / radius;
    let vy = (y - st.oy) / radius;
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    st.vx = vx;
    st.vy = vy;
    if (Math.hypot(vx, vy) >= DEAD_ZONE) st.everActive = true;
  }

  updateMouseAim(pointer) {
    const cam = this.gs.cameras.main;
    const wp = cam.getWorldPoint(pointer.x, pointer.y);
    this.mouseAim.angle = Math.atan2(wp.y - this.player.y, wp.x - this.player.x);
  }

  mouseAngle() {
    if (!this.mouse.seen) return null;
    const wp = this.gs.cameras.main.getWorldPoint(this.mouse.x, this.mouse.y);
    return Math.atan2(wp.y - this.player.y, wp.x - this.player.x);
  }

  onUp(pointer) {
    if (this.moveStick.pointer === pointer) this.releaseMove();
    if (this.aimStick.pointer === pointer) this.releaseAim(true);
    if (this.superTouch && this.superTouch.pointer === pointer) this.releaseSuper(true);
    if (this.mouseAim && this.mouseAim.pointer === pointer) {
      controls.actions.push({ type: 'attack', angle: this.mouseAim.angle });
      this.mouseAim = null;
    }
  }

  releaseMove() {
    const st = this.moveStick;
    st.pointer = null;
    st.vx = 0;
    st.vy = 0;
    this.placeStick(st, this.moveRest.x, this.moveRest.y);
  }

  /** Relâcher le joystick de visée = tirer (tap = visée auto ; retour au centre = annuler). */
  releaseAim(fire) {
    const st = this.aimStick;
    const len = Math.hypot(st.vx, st.vy);
    if (fire && !this.gs.paused) {
      if (len >= DEAD_ZONE) controls.actions.push({ type: 'attack', angle: Math.atan2(st.vy, st.vx) });
      else if (!st.everActive) controls.actions.push({ type: 'attack', angle: null });
    }
    st.pointer = null;
    st.vx = 0;
    st.vy = 0;
    st.everActive = false;
    this.placeStick(st, this.aimRest.x, this.aimRest.y);
  }

  releaseSuper(fire) {
    const st = this.superTouch;
    this.superTouch = null;
    if (!fire || this.gs.paused) return;
    const len = Math.hypot(st.vx, st.vy);
    if (len >= DEAD_ZONE) controls.actions.push({ type: 'super', angle: Math.atan2(st.vy, st.vx), power: len });
    else if (!st.everActive) controls.actions.push({ type: 'super', angle: null, power: 1 });
  }

  keyDown(e) {
    if (e.repeat) return;
    sfx.unlock();
    this.keys.add(e.code);
    if (e.code === 'Escape' || e.code === 'KeyP') {
      this.gs.setPaused(!this.gs.paused);
      return;
    }
    if (this.gs.paused || this.gs.ended) return;
    if (e.code === 'Space' || e.code === 'KeyE') {
      e.preventDefault();
      controls.actions.push({ type: 'super', angle: this.mouseAngle(), power: 1 });
    } else if (e.code === 'KeyF') {
      controls.actions.push({ type: 'fusion' });
    }
  }

  // ── Mise à jour ────────────────────────────────────────────

  /**
   * Calcule l'état des commandes (déplacement, visée en cours).
   * Appelé par GameScene juste avant d'avancer la simulation, pour qu'il n'y
   * ait aucune image de retard entre le doigt et le personnage.
   */
  computeControls() {
    const { player } = this;
    const g = this.gs;

    // Filet de sécurité : un doigt levé sans événement (appel entrant, geste système…)
    if (this.moveStick.pointer && !this.moveStick.pointer.isDown) this.releaseMove();
    if (this.aimStick.pointer && !this.aimStick.pointer.isDown) this.releaseAim(false);
    if (this.superTouch && !this.superTouch.pointer.isDown) this.releaseSuper(false);
    if (this.mouseAim && !this.mouseAim.pointer.isDown) this.mouseAim = null;

    // Déplacement : joystick, sinon clavier
    let mx = this.moveStick.vx;
    let my = this.moveStick.vy;
    if (!this.moveStick.pointer) {
      mx = 0;
      my = 0;
      for (const code of this.keys) {
        const k = KEY_MOVES[code];
        if (k) {
          mx += k[0];
          my += k[1];
        }
      }
      const len = Math.hypot(mx, my);
      if (len > 1) {
        mx /= len;
        my /= len;
      }
    } else if (Math.hypot(mx, my) < 0.12) {
      mx = 0;
      my = 0;
    }
    controls.moveX = g.paused ? 0 : mx;
    controls.moveY = g.paused ? 0 : my;

    // Visée en cours (pour l'aperçu dessiné par GameScene)
    let aiming = null;
    if (this.superTouch) {
      const len = Math.hypot(this.superTouch.vx, this.superTouch.vy);
      aiming = {
        kind: 'super',
        angle: Math.atan2(this.superTouch.vy, this.superTouch.vx),
        power: len,
        active: len >= DEAD_ZONE && player.superReady,
      };
    } else if (this.aimStick.pointer) {
      const len = Math.hypot(this.aimStick.vx, this.aimStick.vy);
      aiming = { kind: 'attack', angle: Math.atan2(this.aimStick.vy, this.aimStick.vx), power: len, active: len >= DEAD_ZONE };
    } else if (this.mouseAim) {
      aiming = { kind: 'attack', angle: this.mouseAim.angle, power: 1, active: true };
    }
    controls.aiming = aiming;
  }

  update(time, delta) {
    const dt = delta / 1000;
    const { match, player } = this;

    // Joysticks
    for (const st of [this.moveStick, this.aimStick]) {
      st.knob.setPosition(st.ox + st.vx * this.R, st.oy + st.vy * this.R);
      st.base.setAlpha(st.pointer ? 1 : 0.7);
    }

    this.fusionPartner = match.phase === 'playing' ? match.findFusionPartner(player) : null;
    this.drawButtons(time);
    this.drawTop();
    this.updateTexts(dt);
    this.drawArrows();
  }

  drawButtons(time) {
    const g = this.buttonsG;
    const p = this.player;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.012);
    g.clear();

    // SUPER : anneau de charge, plein et doré quand il est prêt
    const sb = this.superBtn;
    const ready = p.superReady && p.alive;
    g.fillStyle(0x0a0d18, 0.55);
    g.fillCircle(sb.x, sb.y, sb.r);
    if (ready) {
      g.fillStyle(COLORS.super, 0.85 + 0.15 * pulse);
      g.fillCircle(sb.x, sb.y, sb.r - 4);
      g.lineStyle(3, 0xffffff, 0.6 + 0.4 * pulse);
      g.strokeCircle(sb.x, sb.y, sb.r + 2 + pulse * 3);
    } else {
      g.lineStyle(6, COLORS.super, 0.95);
      g.beginPath();
      g.arc(sb.x, sb.y, sb.r - 5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.superCharge, 0.001, 1));
      g.strokePath();
      g.lineStyle(2, 0xffffff, 0.3);
      g.strokeCircle(sb.x, sb.y, sb.r);
    }
    this.superLabel.setAlpha(ready ? 1 : 0.7);
    this.superIcon
      .setScale(this.iconScale * (ready ? 1.05 + 0.08 * pulse : 0.92))
      .setAlpha(ready ? 1 : 0.45);

    // FUSION : s'allume aux couleurs des deux éléments quand elle est possible
    const fb = this.fusionBtn;
    const partner = this.fusionPartner;
    if (partner) {
      const fu = getFusion(p.element, partner.element);
      g.fillStyle(0xffffff, 0.25 + 0.25 * pulse);
      g.fillCircle(fb.x, fb.y, fb.r + 6 + pulse * 5);
      g.fillStyle(ELEMENTS[p.element].color, 1);
      g.slice(fb.x, fb.y, fb.r, Math.PI / 2, Math.PI * 1.5);
      g.fillPath();
      g.fillStyle(ELEMENTS[partner.element].color, 1);
      g.slice(fb.x, fb.y, fb.r, -Math.PI / 2, Math.PI / 2);
      g.fillPath();
      g.lineStyle(3, 0xffffff, 1);
      g.strokeCircle(fb.x, fb.y, fb.r);
      // Les emblèmes des deux éléments, côte à côte
      const k = this.iconScale * (0.78 + 0.06 * pulse);
      this.fusionIconA.setVisible(true).setPosition(fb.x - fb.r * 0.36, fb.y - 4).setScale(k);
      this.setShown('fusionIconB', partner.element, (el) => this.fusionIconB.setFrame(`em_${el}`));
      this.fusionIconB.setVisible(true).setPosition(fb.x + fb.r * 0.36, fb.y - 4).setScale(k);
      this.setShown('fusionName', `${fu.name}\navec ${partner.def.name}`, (t) => this.fusionName.setText(t));
      this.fusionName.setVisible(true);
      this.fusionLabel.setAlpha(1);
    } else {
      g.fillStyle(0x0a0d18, 0.4);
      g.fillCircle(fb.x, fb.y, fb.r);
      g.lineStyle(2, 0xffffff, 0.18);
      g.strokeCircle(fb.x, fb.y, fb.r);
      // Aide : super prêt, et un allié prêt lui aussi mais trop loin
      const mate = ready && this.match.fighters.find((o) => o !== p && o.team === p.team && o.alive && o.superReady);
      this.setShown('fusionName', mate ? `Rapproche-toi\nde ${mate.def.name} !` : '', (t) => this.fusionName.setText(t));
      this.fusionName.setVisible(!!mate);
      this.fusionLabel.setAlpha(0.35);
      this.fusionIconA.setVisible(false);
      this.fusionIconB.setVisible(false);
    }
  }

  /** N'appelle `apply` que si la valeur a changé (évite de régénérer les textes à chaque image). */
  setShown(key, value, apply) {
    if (this.shown[key] === value) return;
    this.shown[key] = value;
    apply(value);
  }

  updateTexts(dt) {
    const { match, player } = this;
    const cm = match.crystalMode;

    this.setShown('timer', formatTime(match.timeLeft), (t) => this.timer.setText(t));
    this.setShown('timerColor', match.timeLeft <= 10 ? '#ff6b6b' : '#ffffff', (c) => this.timer.setColor(c));

    // Compte à rebours de victoire (une équipe porte les 3 cristaux)
    let hold = '';
    if (cm.holdTeam >= 0 && match.phase === 'playing') {
      const left = Math.ceil(cm.holdLeft);
      hold = cm.holdTeam === player.team ? `Victoire dans ${left} s — tenez bon !` : `L’ennemi gagne dans ${left} s !`;
      this.setShown('holdColor', cm.holdTeam === player.team ? '#8fd0ff' : '#ff8088', (c) => this.holdText.setColor(c));
      this.setShown('holdTick', left, () => {
        if (left <= 5) sfx.play('tick');
      });
    }
    this.setShown('hold', hold, (t) => this.holdText.setText(t));

    // Événement d'arène en cours
    const ev = match.director.current;
    let chip = '';
    if (ev && ev.phase === 'active') chip = `${ev.def.name} — ${Math.ceil(ARENA_EVENT.duration - ev.t)} s`;
    this.setShown('chip', chip, (t) => this.eventChip.setText(t));
    this.eventChip.y = this.topY + (hold ? 42 : 22);

    // Bannière temporaire
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      const a = clamp(this.bannerT / 0.4, 0, 1);
      this.bannerBg.setAlpha(a);
      this.bannerTitle.setAlpha(a);
      this.bannerSub.setAlpha(a);
      if (this.bannerT <= 0) {
        this.bannerBg.clear();
        this.bannerTitle.setText('');
        this.bannerSub.setText('');
      }
    }

    // Vignette rouge : flash des dégâts + pulsation quand la vie est basse
    this.hurt = Math.max(0, this.hurt - dt * 2.6);
    const low = player.alive && player.hp / player.maxHp < 0.3 ? 0.22 + 0.14 * Math.sin(this.time.now * 0.008) : 0;
    this.vignette.setAlpha(Math.min(0.85, Math.max(this.hurt, low)));

    // Réapparition
    let respawn = '';
    if (!player.alive && match.phase === 'playing') respawn = `Réapparition dans ${Math.max(1, Math.ceil(player.respawnT))}…`;
    this.setShown('respawn', respawn, (t) => this.respawnText.setText(t));

    // Journal des éliminations
    for (const f of this.feed) f.t -= dt;
    if (this.feed.length > 0 && this.feed[0].t <= 0) {
      this.feed.shift();
      this.refreshFeed();
    }
  }

  /** Flèches au bord de l'écran vers les cristaux et les porteurs hors champ. */
  drawArrows() {
    const g = this.arrows;
    g.clear();
    if (this.match.phase !== 'playing') return;
    const view = this.gs.cameras.main.worldView;
    if (view.width <= 0) return;
    const s = viewport.safe;
    const pad = 26;
    const minX = s.left + pad;
    const maxX = this.W - s.right - pad;
    const minY = s.top + pad + 34;
    const maxY = this.H - s.bottom - pad;
    for (const c of this.match.crystals) {
      if (!c.active) continue;
      const sx = ((c.x - view.x) / view.width) * this.W;
      const sy = ((c.y - view.y) / view.height) * this.H;
      if (sx >= 0 && sx <= this.W && sy >= 0 && sy <= this.H) continue;
      let color = COLORS.crystal;
      if (c.carrierId >= 0) color = TEAM_COLORS[this.match.fighters[c.carrierId].team].main;
      const x = clamp(sx, minX, maxX);
      const y = clamp(sy, minY, maxY);
      const ang = Math.atan2(sy - y, sx - x);
      g.fillStyle(0x0a0d18, 0.7);
      g.fillCircle(x, y, 15);
      g.fillStyle(color, 1);
      g.fillTriangle(
        x + Math.cos(ang) * 24,
        y + Math.sin(ang) * 24,
        x + Math.cos(ang + 2.3) * 13,
        y + Math.sin(ang + 2.3) * 13,
        x + Math.cos(ang - 2.3) * 13,
        y + Math.sin(ang - 2.3) * 13,
      );
      g.fillStyle(0xffffff, 1);
      diamond(g, x, y, 5.5, 8.5);
      g.fillStyle(color, 1);
      diamond(g, x, y, 3.5, 6.5);
    }
  }

  // ── Annonces ───────────────────────────────────────────────

  showBig(text, color = 0xffffff, hold = 700) {
    this.tweens.killTweensOf(this.big);
    this.big.setText(text).setColor(hex(color)).setVisible(true).setAlpha(1).setScale(1.5);
    this.tweens.add({ targets: this.big, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: this.big,
      alpha: 0,
      delay: hold,
      duration: 250,
      onComplete: () => this.big.setVisible(false),
    });
  }

  showBanner(title, sub, color, duration = 2.6) {
    const w = Math.min(this.W - 120, 460);
    const g = this.bannerBg;
    g.clear();
    g.setAlpha(1);
    g.fillStyle(0x0a0d18, 0.78);
    g.fillRoundedRect(this.W / 2 - w / 2, this.bannerY - 30, w, 60, 14);
    g.lineStyle(3, color, 0.95);
    g.strokeRoundedRect(this.W / 2 - w / 2, this.bannerY - 30, w, 60, 14);
    this.bannerTitle.setText(title).setColor(hex(color)).setAlpha(1);
    this.bannerSub.setText(sub).setAlpha(1);
    this.bannerT = duration;
  }

  flash(color, alpha = 0.35) {
    this.flashRect.setFillStyle(color, 1).setAlpha(alpha);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: 320 });
  }

  onHurt(amount) {
    this.hurt = Math.min(0.9, Math.max(this.hurt, 0.45 + amount / 2000));
  }

  /**
   * Grande annonce de FUSION : un bandeau traverse l'écran, les emblèmes des
   * deux éléments foncent l'un vers l'autre, se percutent dans un flash, et le
   * nom du combo jaillit. (Le monde, lui, passe au ralenti : voir GameScene.)
   */
  playFusion(e) {
    const { match, player } = this;
    const ally = e.team === player.team;
    const a = match.fighters[e.a];
    const b = match.fighters[e.b];
    const W = this.W;
    const y = Math.max(this.topY + 86, this.H * 0.3);
    const color = ally ? COLORS.fusion : TEAM_COLORS[1].main;
    const parts = [this.fxBand, this.fxA, this.fxB, this.fxTag, this.fxName];
    this.tweens.killTweensOf(parts);

    // Bandeau incliné
    const g = this.fxBand;
    g.clear();
    g.fillStyle(0x0a0d18, 0.93);
    g.fillPoints(
      [
        { x: -20, y: y - 34 },
        { x: W + 20, y: y - 48 },
        { x: W + 20, y: y + 34 },
        { x: -20, y: y + 48 },
      ],
      true,
    );
    g.lineStyle(4, ELEMENTS[a.element].color, 1);
    g.lineBetween(-20, y - 34, W + 20, y - 48);
    g.lineStyle(4, ELEMENTS[b.element].color, 1);
    g.lineBetween(-20, y + 48, W + 20, y + 34);
    g.setAlpha(0);
    this.tweens.add({ targets: g, alpha: 1, duration: 120 });

    const k = 64 / 162;
    this.fxA.setFrame(`em_${a.element}`).setPosition(-70, y).setScale(k).setAlpha(1).setVisible(true).setRotation(0);
    this.fxB.setFrame(`em_${b.element}`).setPosition(W + 70, y).setScale(k).setAlpha(1).setVisible(true).setRotation(0);
    this.fxName.setText(e.name.toUpperCase()).setColor(hex(color)).setPosition(W / 2, y + 8).setAlpha(0).setScale(0.2);
    fitWidth(this.fxName, W - 280);
    const nameScale = this.fxName.scale;
    this.fxName.setScale(0.2);
    this.fxTag
      .setText(ally ? `FUSION !  ${a.def.name} + ${b.def.name}` : `FUSION ENNEMIE !  ${a.def.name} + ${b.def.name}`)
      .setPosition(W / 2, y - 26)
      .setAlpha(0);

    // 1. Les emblèmes foncent l'un vers l'autre…
    this.tweens.add({ targets: this.fxA, x: W / 2 - 22, rotation: Math.PI * 2, duration: 300, ease: 'Cubic.easeIn' });
    this.tweens.add({
      targets: this.fxB,
      x: W / 2 + 22,
      rotation: -Math.PI * 2,
      duration: 300,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        // 2. … se percutent : flash, puis s'écartent pour laisser jaillir le nom
        this.flash(ally ? 0xffffff : TEAM_COLORS[1].main, ally ? 0.55 : 0.35);
        const half = (this.fxName.width * nameScale) / 2 + 46;
        this.tweens.add({ targets: this.fxA, x: W / 2 - half, scale: k * 1.15, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.fxB, x: W / 2 + half, scale: k * 1.15, duration: 260, ease: 'Back.easeOut' });
        this.fxName.setAlpha(1);
        this.tweens.add({ targets: this.fxName, scale: nameScale, duration: 280, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.fxTag, alpha: 1, duration: 160 });
        // 3. Tout s'efface
        this.tweens.add({
          targets: parts,
          alpha: 0,
          delay: 1250,
          duration: 280,
          onComplete: () => {
            this.fxA.setVisible(false);
            this.fxB.setVisible(false);
          },
        });
      },
    });
  }

  refreshFeed() {
    this.feedTexts.forEach((t, i) => {
      const f = this.feed[i];
      t.setText(f ? f.text : '');
      if (f) t.setColor(f.color);
    });
  }

  onFx(e) {
    const { match, player } = this;
    switch (e.type) {
      case 'countdown':
        this.showBig(String(e.n));
        break;
      case 'go':
        this.showBig('GO !', COLORS.gold, 600);
        this.tweens.add({ targets: this.hint, alpha: 0, delay: 2200, duration: 500 });
        break;
      case 'fusion':
        this.playFusion(e);
        break;
      case 'arenaEvent': {
        const def = ARENA_EVENTS[e.id];
        if (e.phase === 'warning') this.showBanner(`ARÈNE VIVANTE : ${def.name.toUpperCase()}`, def.hint, def.color, 3.4);
        break;
      }
      case 'crystalSpawn':
        if (match.time > 1) this.showBanner('NOUVEAU CRISTAL', 'Un cristal vient d’apparaître au centre !', COLORS.crystal, 2.2);
        break;
      case 'holdStart':
        this.flash(TEAM_COLORS[e.team].main, 0.2);
        break;
      case 'death': {
        const victim = match.fighters[e.id];
        const killer = e.by >= 0 ? match.fighters[e.by] : null;
        this.feed.push({
          text: killer ? `${killer.def.name} ✕ ${victim.def.name}` : `${victim.def.name} ✕ arène`,
          color: TEAM_COLORS[1 - victim.team].css,
          t: 4,
        });
        if (this.feed.length > 3) this.feed.shift();
        this.refreshFeed();
        break;
      }
      case 'end': {
        const r = match.result;
        const text = r.winner < 0 ? 'ÉGALITÉ' : r.winner === player.team ? 'VICTOIRE !' : 'DÉFAITE';
        const color = r.winner < 0 ? 0xffffff : r.winner === player.team ? COLORS.gold : TEAM_COLORS[1].main;
        this.showBig(text, color, 5000);
        break;
      }
      default:
        break;
    }
  }

  // ── Pause ──────────────────────────────────────────────────

  onPaused(paused) {
    this.keys.clear();
    if (paused) {
      // On lâche toutes les commandes en cours
      if (this.moveStick.pointer) this.releaseMove();
      if (this.aimStick.pointer) this.releaseAim(false);
      this.superTouch = null;
      this.mouseAim = null;
      this.buildPauseMenu();
    }
    this.pauseLayer.setVisible(paused);
  }

  buildPauseMenu() {
    const layer = this.pauseLayer;
    layer.removeAll(true);
    this.pauseButtons = [];
    const { W, H } = this;
    const pw = 300;
    const ph = 290;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    layer.add(this.add.rectangle(0, 0, W, H, 0x05070f, 0.72).setOrigin(0, 0));
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(px, py, pw, ph, 18);
    g.lineStyle(2, COLORS.panelLine, 1);
    g.strokeRoundedRect(px, py, pw, ph, 18);
    layer.add(g);
    layer.add(addText(this, W / 2, py + 30, 'PAUSE', { size: 24, ox: 0.5, oy: 0.5 }));

    const button = (i, label, color, action) => {
      const b = { x: px + 30, y: py + 62 + i * 54, w: pw - 60, h: 44, action };
      g.fillStyle(color, 1);
      g.fillRoundedRect(b.x, b.y, b.w, b.h, 12);
      layer.add(addText(this, b.x + b.w / 2, b.y + b.h / 2, label, { size: 16, ox: 0.5, oy: 0.5 }));
      this.pauseButtons.push(b);
    };
    button(0, 'Reprendre', 0x2f7bd6, () => this.gs.setPaused(false));
    button(1, sfx.muted ? 'Son : coupé' : 'Son : activé', COLORS.panelLight, () => {
      sfx.toggle();
      this.buildPauseMenu();
    });
    button(2, music.enabled ? 'Musique : activée' : 'Musique : coupée', COLORS.panelLight, () => {
      music.toggle();
      this.buildPauseMenu();
    });
    button(3, 'Quitter le match', 0xa83246, () => {
      music.stop();
      this.scene.stop('Game');
      this.scene.start('Menu');
    });
  }
}

/** Petit losange plein (icône de cristal). */
function diamond(g, x, y, w, h) {
  g.beginPath();
  g.moveTo(x, y - h);
  g.lineTo(x + w, y);
  g.lineTo(x, y + h);
  g.lineTo(x - w, y);
  g.closePath();
  g.fillPath();
}
