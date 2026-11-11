// ─────────────────────────────────────────────────────────────
//  FighterView — l'apparence d'un combattant : forme géométrique colorée,
//  barre de vie, nom, munitions (joueur), états, balise de porteur de cristal.
// ─────────────────────────────────────────────────────────────
import { COMBAT } from '../config/constants.js';
import { ELEMENTS, TEAM_COLORS } from '../config/elements.js';
import { lerp, rotateToward } from '../sim/mathx.js';
import { drawCharacter, drawCrystal } from '../ui/shapes.js';
import { COLORS, addText, hex } from '../ui/theme.js';
import { DEPTH } from './ArenaView.js';

const BAR_W = 58;
const BAR_H = 8;

export class FighterView {
  /**
   * @param {Phaser.Scene} scene
   * @param {Fighter} fighter
   * @param {boolean} isLocal    vrai pour le personnage du joueur
   * @param {number} localTeam   équipe du joueur (détermine qui est « allié »)
   */
  constructor(scene, fighter, isLocal, localTeam) {
    const f = fighter;
    this.scene = scene;
    this.f = fighter;
    this.isLocal = isLocal;
    this.friendly = f.team === localTeam;
    const el = ELEMENTS[f.element];
    const team = TEAM_COLORS[f.team];
    this.teamColor = team.main;
    this.alpha = f.alive ? 1 : 0;
    this.rot = f.facing;
    this.lastHp = f.hp;
    this.flashT = 0;
    this.statusText = '';
    this.lastCarry = -1;

    this.shadow = scene.add.ellipse(f.x, f.y, f.r * 2.1, f.r * 1.15, 0x000000, 0.3).setDepth(DEPTH.shadow);
    this.aura = scene.add.graphics().setDepth(DEPTH.shadow + 0.5);
    this.body = scene.add.graphics().setDepth(DEPTH.fighter);
    drawCharacter(this.body, f.def.shape, f.r, el.color, isLocal ? 0xffffff : team.main, 3.5, el.light);
    this.flash = scene.add
      .circle(f.x, f.y, f.r * 1.2, 0xffffff, 1)
      .setDepth(DEPTH.fighter + 0.5)
      .setVisible(false);

    // Balise au-dessus du brouillard : porteur de cristal, étoiles d'étourdissement
    this.beacon = scene.add.graphics().setDepth(DEPTH.overhead - 1);

    // Informations au-dessus de la tête
    const by = -f.r - 20;
    this.over = scene.add.container(f.x, f.y).setDepth(DEPTH.overhead);
    const hpBack = scene.add.rectangle(0, by, BAR_W + 4, BAR_H + 4, 0x0a0d18, 0.9);
    this.hpFill = scene.add
      .rectangle(-BAR_W / 2, by, BAR_W, BAR_H, isLocal ? COLORS.green : team.main)
      .setOrigin(0, 0.5);
    this.name = addText(scene, 0, by - 7, f.def.name, {
      size: 12,
      color: hex(isLocal ? 0xffffff : team.light),
      ox: 0.5,
      oy: 1,
      stroke: '#0a0d18',
      strokeW: 3,
    });
    this.status = addText(scene, 0, f.r + 6, '', {
      size: 10,
      color: '#ffe680',
      ox: 0.5,
      oy: 0,
      stroke: '#0a0d18',
      strokeW: 3,
    });
    this.over.add([hpBack, this.hpFill, this.name, this.status]);

    // Munitions (seulement pour le joueur)
    this.ammoFills = [];
    if (isLocal) {
      const segW = (BAR_W - 2 * 3) / COMBAT.maxAmmo;
      for (let i = 0; i < COMBAT.maxAmmo; i++) {
        const x = -BAR_W / 2 + i * (segW + 3);
        const back = scene.add.rectangle(x - 1, by + 10, segW + 2, 7, 0x0a0d18, 0.9).setOrigin(0, 0.5);
        const fill = scene.add.rectangle(x, by + 10, segW, 5, 0xffa531).setOrigin(0, 0.5);
        this.over.add([back, fill]);
        this.ammoFills.push(fill);
      }
    }

    // Icône de cristal + nombre porté
    this.crystalIcon = scene.add.graphics();
    drawCrystal(this.crystalIcon, 9, COLORS.crystal, COLORS.crystalDark);
    this.crystalIcon.setPosition(-8, by - 34);
    this.crystalCount = addText(scene, 4, by - 34, '', { size: 13, color: '#bffcff', ox: 0, oy: 0.5, stroke: '#0a0d18' });
    this.over.add([this.crystalIcon, this.crystalCount]);
  }

  /**
   * @param {number} alpha interpolation entre deux pas de simulation (0…1)
   * @param {number} time  horloge (ms)
   * @param {number} dt    durée de l'image (s)
   * @param {boolean} seen le joueur voit-il ce combattant ?
   */
  update(alpha, time, dt, seen) {
    const f = this.f;
    const x = lerp(f.px, f.x, alpha);
    const y = lerp(f.py, f.y, alpha);

    // Opacité : caché dans un buisson = translucide pour son équipe, invisible pour l'autre
    let target = 0;
    if (f.alive) {
      if (this.friendly) target = f.inBush || f.cloakT > 0 ? 0.55 : 1;
      else target = seen ? 1 : 0;
    }
    this.alpha += (target - this.alpha) * Math.min(1, dt * 14);
    if (Math.abs(target - this.alpha) < 0.02) this.alpha = target;
    const visible = this.alpha > 0.02;

    this.body.setVisible(visible);
    this.shadow.setVisible(visible);
    this.aura.setVisible(visible);
    const showOver = visible && (this.friendly || this.alpha > 0.4);
    this.over.setVisible(showOver);
    this.beacon.clear();
    if (!visible) {
      this.flash.setVisible(false);
      this.lastHp = f.hp;
      this.rot = f.facing;
      return;
    }

    this.rot = rotateToward(this.rot, f.facing, dt * 16);
    this.body.setPosition(x, y).setRotation(this.rot).setAlpha(this.alpha);
    this.shadow.setPosition(x + 3, y + f.r * 0.55).setAlpha(this.alpha * 0.3);

    // Flash blanc quand il encaisse des dégâts
    if (f.hp < this.lastHp - 0.5) this.flashT = 0.12;
    this.lastHp = f.hp;
    if (this.flashT > 0 || (f.stunT > 0 && f.frozen)) {
      this.flashT -= dt;
      const frozen = f.stunT > 0 && f.frozen;
      this.flash
        .setVisible(true)
        .setPosition(x, y)
        .setFillStyle(frozen ? 0xa8e8ff : 0xffffff, frozen ? 0.6 : Math.max(0, this.flashT / 0.12) * 0.75);
    } else {
      this.flash.setVisible(false);
    }

    // Auras au sol
    const a = this.aura;
    a.clear();
    a.setPosition(x, y);
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.01);
    if (this.isLocal) {
      a.lineStyle(2, 0xffffff, 0.35 * this.alpha);
      a.strokeCircle(0, 0, f.r + 8);
    }
    if (f.superReady) {
      a.lineStyle(4, COLORS.super, (0.55 + 0.45 * pulse) * this.alpha);
      a.strokeCircle(0, 0, f.r + 11 + pulse * 3);
    }
    if (f.invulnT > 0) {
      a.fillStyle(0xffffff, 0.16);
      a.fillCircle(0, 0, f.r + 9);
      a.lineStyle(3, 0xffffff, 0.85);
      a.strokeCircle(0, 0, f.r + 9);
    }
    if (f.drT > 0) {
      a.lineStyle(4, 0xe0bd95, 0.9);
      a.strokeCircle(0, 0, f.r + 6);
    }
    if (f.hasteT > 0) {
      a.lineStyle(3, 0xc4f7e8, 0.7);
      a.strokeCircle(-Math.cos(this.rot) * 8, -Math.sin(this.rot) * 8, f.r + 4);
    }

    // Balise (dessinée au-dessus du brouillard)
    const b = this.beacon;
    b.setPosition(x, y);
    if (f.carrying > 0) {
      // Porteur de cristal : visible de tous
      b.lineStyle(3, COLORS.crystal, 0.9 - 0.5 * pulse);
      b.strokeCircle(0, 0, f.r + 14 + pulse * 8);
      b.lineStyle(2, 0xffffff, 0.8);
      b.strokeCircle(0, 0, f.r + 13);
    }
    if (f.stunT > 0 && !f.frozen) {
      for (let i = 0; i < 3; i++) {
        const ang = time * 0.008 + (i * Math.PI * 2) / 3;
        b.fillStyle(0xffe14d, 1);
        b.fillCircle(Math.cos(ang) * 16, -f.r - 4 + Math.sin(ang) * 5, 4);
      }
    }

    // Au-dessus de la tête
    if (showOver) {
      this.over.setPosition(x, y).setAlpha(this.friendly ? Math.max(this.alpha, 0.8) : this.alpha);
      this.hpFill.scaleX = Math.max(0, Math.min(1, f.hp / f.maxHp));
      for (let i = 0; i < this.ammoFills.length; i++) {
        const fill = Math.max(0, Math.min(1, f.ammo - i));
        this.ammoFills[i].scaleX = fill;
        this.ammoFills[i].setFillStyle(fill >= 1 ? 0xffa531 : 0x8a6a3a);
      }
      let st = '';
      if (f.stunT > 0) st = f.frozen ? 'GELÉ' : 'ÉTOURDI';
      else if (f.rootT > 0) st = 'IMMOBILISÉ';
      else if (f.blindT > 0) st = 'AVEUGLÉ';
      else if (f.zoneSlow < 1 || f.slowT > 0) st = 'RALENTI';
      else if (f.invulnT > 0) st = 'PROTÉGÉ';
      if (st !== this.statusText) {
        this.statusText = st;
        this.status.setText(st);
      }
      if (f.carrying !== this.lastCarry) {
        this.lastCarry = f.carrying;
        this.crystalIcon.setVisible(f.carrying > 0);
        this.crystalCount.setVisible(f.carrying > 0).setText(f.carrying > 1 ? `×${f.carrying}` : '');
        this.crystalIcon.x = f.carrying > 1 ? -8 : 0;
      }
    }
  }

  destroy() {
    for (const o of [this.shadow, this.aura, this.body, this.flash, this.beacon, this.over]) o.destroy();
  }
}
