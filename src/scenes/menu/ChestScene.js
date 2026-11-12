// ─────────────────────────────────────────────────────────────
//  ChestScene — ouverture d'un coffre, par-dessus l'écran courant :
//  le coffre tombe, tremble, s'ouvre dans un éclat de lumière, puis les
//  récompenses en sortent UNE PAR UNE (toucher l'écran accélère).
//
//  Le contenu est déjà crédité sur le profil avant l'animation : fermer le
//  jeu au milieu ne fait rien perdre.
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { sfx } from '../../audio/Sfx.js';
import { CHESTS } from '../../config/meta.js';
import { Buttons } from '../../ui/Buttons.js';
import { REF_H, REF_W, button, fmt, icon } from '../../ui/kit.js';
import { addText, textResFor } from '../../ui/theme.js';
import { fitCamera } from '../../ui/viewport.js';

const KINDS = {
  coins: { frame: 'coin', name: 'PIÈCES', color: '#ffe27a' },
  gems: { frame: 'gem', name: 'GEMMES', color: '#ff9be6' },
  xp: { frame: 'xp', name: 'XP', color: '#9fe0ff' },
};
const CX = REF_W / 2;
const CHEST_Y = 246;

export class ChestScene extends Phaser.Scene {
  constructor() {
    super('Chest');
  }

  init(data) {
    this.cfg = data;
  }

  create() {
    const zoom = fitCamera(this, REF_W, REF_H);
    this.textRes = textResFor(zoom);
    this.buttons = new Buttons(this);
    this.state = 'drop';
    this.index = -1;
    this.shownItems = [];
    const def = CHESTS[this.cfg.type];

    this.shade = this.add.rectangle(-3000, -3000, 6844, 6390, 0x04060f, 1).setOrigin(0, 0).setAlpha(0);
    this.tweens.add({ targets: this.shade, alpha: 0.88, duration: 200 });
    this.title = addText(this, CX, 34, def.name.toUpperCase(), { size: 24, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 6, color: '#ffe27a' });
    this.rays = this.add.image(CX, CHEST_Y - 10, 'rays').setTint(0xfff3a0).setAlpha(0).setDisplaySize(620, 620).setBlendMode('ADD');
    this.tweens.add({ targets: this.rays, angle: 360, duration: 9000, repeat: -1 });
    this.glow = this.add.image(CX, CHEST_Y - 10, 'dot').setTint(0xfff3a0).setAlpha(0).setDisplaySize(300, 300).setBlendMode('ADD');

    // Le coffre tombe et rebondit
    this.chest = icon(this, `chest_${this.cfg.type}`, CX, -90, 150, 5);
    this.baseScale = this.chest.scale;
    this.tweens.add({
      targets: this.chest,
      y: CHEST_Y,
      duration: 520,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        sfx.play('thud');
        this.state = 'closed';
        this.wobble = this.tweens.add({ targets: this.chest, angle: { from: -5, to: 5 }, duration: 110, yoyo: true, repeat: -1, repeatDelay: 420 });
      },
    });
    this.hint = addText(this, CX, REF_H - 34, 'TOUCHE POUR OUVRIR', { size: 15, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 5 });
    this.tweens.add({ targets: this.hint, alpha: 0.35, duration: 520, yoyo: true, repeat: -1 });
    this.counter = addText(this, CX, 60, '', { size: 12, ox: 0.5, oy: 0.5, color: '#c9d3ee' });

    this.sparks = this.add
      .particles(0, 0, 'fx', { frame: 'star', speed: { min: 140, max: 420 }, lifespan: 900, gravityY: 300, scale: { start: 0.6, end: 0 }, rotate: { start: 0, end: 360 }, emitting: false })
      .setDepth(6);

    this.input.on('pointerup', () => this.advance());
    // Le coffre s'ouvre tout seul si l'on ne touche rien
    this.auto = this.time.delayedCall(1700, () => this.advance());
    this.onViewport = () => fitCamera(this, REF_W, REF_H);
    this.game.events.on('viewport-changed', this.onViewport);
    this.events.once('shutdown', () => this.game.events.off('viewport-changed', this.onViewport));
  }

  advance() {
    if (this.state === 'closed') this.open();
    else if (this.state === 'reveal') this.next();
  }

  open() {
    this.state = 'opening';
    if (this.auto) this.auto.remove();
    if (this.wobble) this.wobble.stop();
    this.chest.setAngle(0).setFrame(`chest_${this.cfg.type}_open`);
    sfx.play('chest');
    this.cameras.main.flash(180, 255, 255, 255);
    this.cameras.main.shake(160, 0.008);
    this.sparks.explode(34, CX, CHEST_Y - 20);
    this.tweens.add({ targets: this.chest, scale: this.baseScale * 1.15, duration: 110, yoyo: true });
    this.tweens.add({ targets: this.rays, alpha: 0.5, duration: 260 });
    this.tweens.add({ targets: this.glow, alpha: 0.6, duration: 260 });
    this.hint.setVisible(false);
    this.time.delayedCall(380, () => this.next());
  }

  /** Fait sortir la récompense suivante (ou termine). */
  next() {
    if (this.auto) this.auto.remove();
    const loot = this.cfg.loot;
    // La récompense affichée rejoint la rangée du bas
    if (this.current) this.shelve(this.current, this.index);
    this.index += 1;
    if (this.index >= loot.length) {
      this.finish();
      return;
    }
    this.state = 'reveal';
    const item = loot[this.index];
    const kind = KINDS[item.kind] || KINDS.coins;
    const last = this.index === loot.length - 1;
    this.counter.setText(`Récompense ${this.index + 1} / ${loot.length}`);

    const c = this.add.container(CX, CHEST_Y - 20).setDepth(10).setScale(0.2);
    const halo = this.add.image(0, 0, 'dot').setTint(0xffffff).setAlpha(0.5).setDisplaySize(170, 170).setBlendMode('ADD');
    const img = this.add.image(0, 0, 'ui', kind.frame);
    img.setScale(84 / img.frame.width);
    const amount = addText(this, 0, 62, `+${fmt(item.amount)}`, { size: last ? 34 : 30, ox: 0.5, oy: 0.5, color: kind.color, stroke: '#0a0d18', strokeW: 7 });
    const name = addText(this, 0, 90, kind.name, { size: 13, ox: 0.5, oy: 0.5, color: '#ffffff', stroke: '#0a0d18', strokeW: 4 });
    c.add([halo, img, amount, name]);
    this.current = c;
    sfx.play(last ? 'reward-big' : 'reward');
    this.sparks.explode(last ? 26 : 12, CX, CHEST_Y - 30);
    this.tweens.add({ targets: c, y: 112, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.chest, scale: this.baseScale * 1.08, duration: 90, yoyo: true });
    this.auto = this.time.delayedCall(last ? 1500 : 1150, () => this.next());
  }

  /** Range une récompense déjà vue dans la rangée du bas. */
  shelve(c, i) {
    const n = this.cfg.loot.length;
    const step = Math.min(84, 640 / n);
    const x = CX - ((n - 1) * step) / 2 + i * step;
    this.tweens.add({ targets: c, x, y: 328, scale: 0.34, duration: 260, ease: 'Cubic.easeOut' });
    this.shownItems.push(c);
    this.current = null;
  }

  finish() {
    this.state = 'done';
    this.counter.setText('');
    this.tweens.add({ targets: [this.chest, this.rays, this.glow], alpha: 0.25, duration: 300 });
    addText(this, CX, 150, 'TOUT EST À TOI !', { size: 26, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 6, color: '#b8ff9a' });
    const b = button(this, this.buttons, {
      id: 'collect',
      x: CX - 110,
      y: 196,
      w: 220,
      h: 50,
      label: 'RÉCUPÉRER',
      size: 22,
      strokeW: 5,
      color: 'yellow',
      sound: 'reward',
      onTap: () => this.close(),
    });
    b.c.setScale(0.3);
    this.tweens.add({ targets: b.c, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  close() {
    if (this.state === 'closing') return;
    this.state = 'closing';
    this.cameras.main.fadeOut(140, 8, 12, 28);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const done = this.cfg.onDone;
      this.scene.stop();
      if (done) done();
    });
  }
}
