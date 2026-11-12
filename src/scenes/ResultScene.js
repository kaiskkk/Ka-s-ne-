// ─────────────────────────────────────────────────────────────
//  ResultScene — écran de victoire / défaite / égalité,
//  avec le tableau des scores des deux équipes.
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { CHARACTERS } from '../config/characters.js';
import { CRYSTAL } from '../config/constants.js';
import { ELEMENTS, TEAM_COLORS } from '../config/elements.js';
import { CharacterRig } from '../render/CharacterRig.js';
import { Buttons } from '../ui/Buttons.js';
import { COLORS, addText, fitWidth, hex, textResFor } from '../ui/theme.js';
import { fitCamera } from '../ui/viewport.js';

const REF_W = 844;
const REF_H = 390;

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  init(data) {
    this.data_ = data;
  }

  create() {
    this.rigs = [];
    this.buttons = new Buttons(this);
    this.rebuild();
    this.onViewport = () => this.rebuild();
    this.game.events.on('viewport-changed', this.onViewport);
    this.events.once('shutdown', () => this.game.events.off('viewport-changed', this.onViewport));
  }

  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    const t = time / 1000;
    for (const r of this.rigs) {
      // Les vainqueurs sautent de joie, les perdants regardent leurs pieds
      const hop = r.happy ? Math.abs(Math.sin(t * 5 + r.phase)) * r.jump : 0;
      r.rig.setPosition(r.x, r.y - hop);
      r.rig.update(dt, {
        aim: r.happy ? Math.PI / 2 + Math.sin(t * 2 + r.phase) * 0.9 : Math.PI / 2,
        moveX: 0,
        moveY: 0,
      });
    }
  }

  addRig(id, x, y, scale, happy, jump) {
    const rig = new CharacterRig(this, id, scale);
    rig.setPosition(x, y).setDepth(5);
    this.rigs.push({ rig, x, y, happy, jump, phase: this.rigs.length * 1.3 });
    return rig;
  }

  rebuild() {
    this.tweens.killAll();
    this.children.removeAll(true);
    this.rigs = [];
    this.buttons.clear();
    const zoom = fitCamera(this, REF_W, REF_H);
    this.textRes = textResFor(zoom);

    const { outcome, result, fighters } = this.data_;
    const playerTeam = fighters.find((f) => f.isPlayer)?.team ?? 0;
    const win = outcome === 'win';
    const draw = outcome === 'draw';
    const accent = draw ? 0xffffff : win ? COLORS.gold : TEAM_COLORS[1].main;

    // Fond
    const bg = this.add.graphics().setDepth(-10);
    bg.fillGradientStyle(0x16224a, 0x16224a, 0x0a0f22, 0x0a0f22, 1);
    bg.fillRect(-3000, -3000, 6844, 6390);
    this.add.image(REF_W / 2, 40, 'dot').setTint(accent).setAlpha(0.32).setDisplaySize(900, 420).setBlendMode('ADD').setDepth(-9);

    // Le personnage du joueur, à côté du titre
    const me = fighters.find((f) => f.isPlayer);
    if (me) {
      this.addRig(me.charId, 150, 58, 1.0, win, 9);
      this.addRig(me.charId, REF_W - 150, 58, 1.0, win, 9);
    }
    // Confettis de victoire
    if (win) {
      this.add
        .particles(0, 0, 'fx', {
          frame: 'confetti',
          x: { min: 0, max: REF_W },
          y: -20,
          lifespan: 4200,
          speedY: { min: 90, max: 190 },
          speedX: { min: -40, max: 40 },
          rotate: { start: 0, end: 540 },
          scale: { min: 0.35, max: 0.6 },
          tint: [0xff5533, 0x2f9bff, 0xffd400, 0x52e0b8, 0xffffff, 0xff7bf0],
          frequency: 55,
          advance: 1500,
        })
        .setDepth(20);
    }

    // Titre
    const title = addText(this, REF_W / 2, 38, draw ? 'ÉGALITÉ' : win ? 'VICTOIRE !' : 'DÉFAITE', {
      size: 46,
      ox: 0.5,
      oy: 0.5,
      color: hex(accent),
      stroke: '#05070f',
      strokeW: 8,
    });
    title.setScale(0.4);
    this.tweens.add({ targets: title, scale: 1, duration: 450, ease: 'Back.easeOut' });
    addText(this, REF_W / 2, 78, this.reasonText(result, playerTeam), { size: 14, ox: 0.5, oy: 0.5, color: '#e6ecff' });

    // Tableau des deux équipes
    this.drawTeam(40, 98, playerTeam, 'VOTRE ÉQUIPE', result);
    this.drawTeam(432, 98, 1 - playerTeam, 'ÉQUIPE ADVERSE', result);

    // Boutons
    this.button(232, 322, 240, 52, 'REJOUER', COLORS.gold, 0x8a5a00, '#3a2a00', () =>
      this.scene.start('Game', { charId: this.data_.charId, difficulty: this.data_.difficulty }),
    );
    this.button(488, 322, 124, 52, 'MENU', COLORS.panelLight, 0x0a0d18, '#ffffff', () => this.scene.start('Menu'));
  }

  reasonText(result, playerTeam) {
    const mine = result.crystals[playerTeam];
    const theirs = result.crystals[1 - playerTeam];
    switch (result.reason) {
      case 'hold':
        return result.winner === playerTeam
          ? `Votre équipe a gardé les ${CRYSTAL.count} cristaux pendant ${CRYSTAL.holdToWin} s !`
          : `L’équipe adverse a gardé les ${CRYSTAL.count} cristaux pendant ${CRYSTAL.holdToWin} s.`;
      case 'crystals':
        return `Temps écoulé — cristaux : ${mine} contre ${theirs}`;
      case 'kills':
        return `Temps écoulé, cristaux à égalité — éliminations : ${result.kills[playerTeam]} contre ${result.kills[1 - playerTeam]}`;
      default:
        return 'Temps écoulé — égalité parfaite !';
    }
  }

  drawTeam(x, y, team, label, result) {
    const w = 372;
    const h = 212;
    const col = TEAM_COLORS[team];
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1);
    g.fillRoundedRect(x, y, w, h, 14);
    g.fillStyle(col.dark, 1);
    g.fillRoundedRect(x, y, w, 34, { tl: 14, tr: 14, bl: 0, br: 0 });
    g.lineStyle(2, result.winner === team ? COLORS.gold : COLORS.panelLine, 1);
    g.strokeRoundedRect(x, y, w, h, 14);

    addText(this, x + 14, y + 17, label, { size: 14, oy: 0.5 });
    addText(this, x + w - 14, y + 17, `${result.crystals[team]} ${result.crystals[team] > 1 ? 'cristaux' : 'cristal'} · ${result.kills[team]} élim.`, {
      size: 12,
      ox: 1,
      oy: 0.5,
      color: hex(col.light),
    });

    // En-têtes de colonnes
    const cols = [x + 214, x + 282, x + 346];
    ['Élim.', 'Dégâts', 'Cristaux'].forEach((t, i) =>
      addText(this, cols[i], y + 48, t, { size: 10, ox: 0.5, oy: 0.5, color: '#9aa6c8', bold: false }),
    );

    const rows = this.data_.fighters.filter((f) => f.team === team);
    const best = Math.max(...this.data_.fighters.map((f) => f.damage));
    rows.forEach((f, i) => {
      const def = CHARACTERS[f.charId];
      const el = ELEMENTS[def.element];
      const ry = y + 84 + i * 46;
      if (f.isPlayer) {
        g.fillStyle(0xffffff, 0.07);
        g.fillRoundedRect(x + 8, ry - 20, w - 16, 40, 10);
      }
      this.addRig(f.charId, x + 32, ry - 3, 0.5, result.winner === team, 4);
      fitWidth(addText(this, x + 58, ry - 7, def.name + (f.isPlayer ? ' (toi)' : ''), { size: 14, oy: 0.5 }), 126);
      addText(this, x + 58, ry + 10, `${el.name} · ${def.role}`, { size: 10, oy: 0.5, color: hex(el.light), bold: false });
      addText(this, cols[0], ry, `${f.kills}`, { size: 15, ox: 0.5, oy: 0.5 });
      addText(this, cols[1], ry, `${f.damage}`, {
        size: 13,
        ox: 0.5,
        oy: 0.5,
        color: f.damage === best && best > 0 ? hex(COLORS.gold) : '#ffffff',
      });
      addText(this, cols[2], ry, `${f.crystals}`, { size: 15, ox: 0.5, oy: 0.5, color: '#bffcff' });
    });
  }

  button(x, y, w, h, label, color, shade, textColor, onTap) {
    const g = this.add.graphics();
    const paint = (pressed) => {
      g.clear();
      g.fillStyle(shade, 1);
      g.fillRoundedRect(x, y + 4, w, h, 14);
      g.fillStyle(color, pressed ? 0.8 : 1);
      g.fillRoundedRect(x, y + (pressed ? 3 : 0), w, h, 14);
    };
    paint(false);
    const t = addText(this, x + w / 2, y + h / 2, label, { size: 20, ox: 0.5, oy: 0.5, color: textColor });
    this.buttons.add({
      x,
      y,
      w,
      h,
      onPress: (pressed) => {
        paint(pressed);
        t.y = y + h / 2 + (pressed ? 3 : 0);
      },
      onTap,
    });
  }
}
