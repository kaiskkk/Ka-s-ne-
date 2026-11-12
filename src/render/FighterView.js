// ─────────────────────────────────────────────────────────────
//  FighterView — l'apparence d'un combattant en match : son pantin animé
//  (CharacterRig), l'anneau d'équipe au sol, la barre de vie, le nom,
//  les munitions (joueur), les états et la balise de porteur de cristal.
// ─────────────────────────────────────────────────────────────
import { COMBAT } from '../config/constants.js';
import { TEAM_COLORS } from '../config/elements.js';
import { lerp, rotateToward } from '../sim/mathx.js';
import { COLORS, addText, hex } from '../ui/theme.js';
import { DEPTH } from './ArenaView.js';
import { CharacterRig } from './CharacterRig.js';

const BAR_W = 62;
const BAR_H = 9;
/** Taille d'affichage des personnages par rapport à leur zone de collision. */
export const RIG_SCALE = 1.2;

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
    const team = TEAM_COLORS[f.team];
    this.alpha = f.alive ? 1 : 0;
    this.rot = f.facing;
    this.lastHp = f.hp;
    this.wasAlive = f.alive;
    this.statusText = '';
    this.lastCarry = -1;
    this.x = f.x;
    this.y = f.y;

    const scale = RIG_SCALE * (0.55 + 0.45 * (f.r / 26));
    this.footY = 21 * scale;

    // Au sol : ombre + anneau aux couleurs de l'équipe (blanc pour le joueur)
    this.shadow = scene.add.ellipse(f.x, f.y, f.r * 2.1, f.r * 0.95, 0x000000, 0.28).setDepth(DEPTH.shadow);
    this.ring = scene.add
      .ellipse(f.x, f.y, f.r * 2.5, f.r * 1.25, team.main, 0.22)
      .setStrokeStyle(isLocal ? 3.5 : 3, isLocal ? 0xffffff : team.main, 0.95)
      .setDepth(DEPTH.shadow - 0.5);
    this.aura = scene.add.graphics().setDepth(DEPTH.shadow + 0.5);

    this.rig = new CharacterRig(scene, f.charId, scale);
    this.ice = scene.add.image(f.x, f.y, 'fx', 'ice').setScale(0.36 * scale).setVisible(false);

    // Balise au-dessus du brouillard : porteur de cristal, étoiles d'étourdissement
    this.beacon = scene.add.graphics().setDepth(DEPTH.overhead - 1);
    this.stars = [0, 1, 2].map(() => scene.add.image(0, 0, 'fx', 'star').setScale(0.3).setDepth(DEPTH.overhead).setVisible(false));

    // Informations au-dessus de la tête
    const by = -(58 * scale) - 6;
    this.barY = by;
    this.over = scene.add.container(f.x, f.y).setDepth(DEPTH.overhead);
    const hpBack = scene.add.rectangle(0, by, BAR_W + 5, BAR_H + 5, 0x0a0d18, 0.92);
    this.hpGhost = scene.add.rectangle(-BAR_W / 2, by, BAR_W, BAR_H, 0xffffff, 0.9).setOrigin(0, 0.5);
    this.hpFill = scene.add
      .rectangle(-BAR_W / 2, by, BAR_W, BAR_H, isLocal ? COLORS.green : team.main)
      .setOrigin(0, 0.5);
    const shine = scene.add.rectangle(-BAR_W / 2, by - 2.5, BAR_W, 2, 0xffffff, 0.3).setOrigin(0, 0.5);
    this.name = addText(scene, 0, by - 8, f.def.name, {
      size: 13,
      color: hex(isLocal ? 0xffffff : team.light),
      ox: 0.5,
      oy: 1,
      stroke: '#0a0d18',
      strokeW: 4,
    });
    this.status = addText(scene, 0, this.footY + 8, '', {
      size: 11,
      color: '#ffe680',
      ox: 0.5,
      oy: 0,
      stroke: '#0a0d18',
      strokeW: 3,
    });
    this.over.add([hpBack, this.hpGhost, this.hpFill, shine, this.name, this.status]);
    this.ghost = 1;

    // Munitions (seulement pour le joueur)
    this.ammoFills = [];
    if (isLocal) {
      const segW = (BAR_W - 2 * 3) / COMBAT.maxAmmo;
      for (let i = 0; i < COMBAT.maxAmmo; i++) {
        const x = -BAR_W / 2 + i * (segW + 3);
        const back = scene.add.rectangle(x - 1, by + 11, segW + 2, 7, 0x0a0d18, 0.92).setOrigin(0, 0.5);
        const fill = scene.add.rectangle(x, by + 11, segW, 5, 0xffa531).setOrigin(0, 0.5);
        this.over.add([back, fill]);
        this.ammoFills.push(fill);
      }
    }

    // Icône de cristal + nombre porté
    this.crystalIcon = scene.add.image(0, by - 40, 'fx', 'crystal').setScale(0.2);
    this.crystalCount = addText(scene, 9, by - 40, '', { size: 14, color: '#bffcff', ox: 0, oy: 0.5, stroke: '#0a0d18' });
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
    this.x = x;
    this.y = y;
    const rig = this.rig;

    // Mort / réapparition
    if (this.wasAlive && !f.alive) rig.die();
    if (!this.wasAlive && f.alive) {
      rig.revive();
      this.ghost = 1;
    }
    this.wasAlive = f.alive;

    // Opacité : caché dans un buisson = translucide pour son équipe, invisible pour l'autre
    let target = 0;
    if (f.alive) {
      if (this.friendly) target = f.inBush || f.cloakT > 0 ? 0.62 : 1;
      else target = seen ? 1 : 0;
    }
    this.alpha += (target - this.alpha) * Math.min(1, dt * 14);
    if (Math.abs(target - this.alpha) < 0.02) this.alpha = target;
    const visible = this.alpha > 0.02;
    // Pendant l'animation de mort le pantin reste affiché, même si alive est déjà faux
    const dying = !f.alive && rig.dead && rig.deathT < 0.45 && (this.friendly || this.lastSeen);
    if (f.alive) this.lastSeen = visible;

    this.shadow.setVisible(visible);
    this.ring.setVisible(visible);
    this.aura.setVisible(visible);
    const showOver = visible && (this.friendly || this.alpha > 0.4);
    this.over.setVisible(showOver);
    this.beacon.clear();
    rig.setVisible(visible || dying);

    // Flash blanc quand il encaisse des dégâts
    if (f.hp < this.lastHp - 0.5 && f.alive) rig.flash();
    this.lastHp = f.hp;

    this.rot = rotateToward(this.rot, f.facing, dt * 16);
    const frozen = f.stunT > 0 && f.frozen;
    rig.setFrozen(frozen);
    rig.setAlpha(f.alive ? this.alpha * (f.invulnT > 0 ? 0.65 + 0.3 * Math.sin(time * 0.02) : 1) : 1);
    rig.setPosition(x, y).setDepth(DEPTH.fighter + y * 0.0002);
    const moving = f.alive && f.stunT <= 0;
    rig.update(dt, {
      aim: this.rot,
      moveX: moving ? f.vx / f.def.speed : 0,
      moveY: moving ? f.vy / f.def.speed : 0,
    });
    this.ice.setVisible(visible && frozen).setPosition(x, y - 8).setDepth(DEPTH.fighter + y * 0.0002 + 0.00005);
    for (const s of this.stars) s.setVisible(false);
    if (!visible) {
      this.rot = f.facing;
      return;
    }

    this.shadow.setPosition(x + 2, y + this.footY).setAlpha(this.alpha * 0.28);
    this.ring.setPosition(x, y + this.footY - 2).setAlpha(this.alpha);

    // Auras au sol
    const a = this.aura;
    a.clear();
    a.setPosition(x, y + this.footY - 2);
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.01);
    const rw = f.r * 1.25;
    const rh = f.r * 0.62;
    if (f.superReady) {
      a.lineStyle(4, COLORS.super, (0.6 + 0.4 * pulse) * this.alpha);
      a.strokeEllipse(0, 0, (rw + 7 + pulse * 3) * 2, (rh + 4 + pulse * 2) * 2);
    }
    if (f.invulnT > 0) {
      a.lineStyle(3, 0xffffff, 0.85);
      a.strokeEllipse(0, 0, (rw + 4) * 2, (rh + 3) * 2);
    }
    if (f.drT > 0) {
      a.lineStyle(4, 0xe0bd95, 0.9);
      a.strokeEllipse(0, 0, (rw + 2) * 2, (rh + 1) * 2);
    }
    if (f.hasteT > 0) {
      a.lineStyle(3, 0xc4f7e8, 0.75);
      a.strokeEllipse(-f.vx * 0.05, -f.vy * 0.03, rw * 2, rh * 2);
    }

    // Balise (dessinée au-dessus du brouillard)
    const b = this.beacon;
    b.setPosition(x, y);
    if (f.carrying > 0) {
      // Porteur de cristal : visible de tous
      b.lineStyle(3, COLORS.crystal, 0.9 - 0.5 * pulse);
      b.strokeEllipse(0, this.footY - 2, (rw + 12 + pulse * 9) * 2, (rh + 7 + pulse * 5) * 2);
      b.lineStyle(2, 0xffffff, 0.8);
      b.strokeEllipse(0, this.footY - 2, (rw + 10) * 2, (rh + 6) * 2);
    }
    if (f.stunT > 0 && !f.frozen) {
      this.stars.forEach((s, i) => {
        const ang = time * 0.008 + (i * Math.PI * 2) / 3;
        s.setVisible(true)
          .setPosition(x + Math.cos(ang) * 20, y + this.barY + 22 + Math.sin(ang) * 6)
          .setRotation(ang * 2);
      });
    }

    // Au-dessus de la tête
    if (showOver) {
      this.over.setPosition(x, y).setAlpha(this.friendly ? Math.max(this.alpha, 0.85) : this.alpha);
      const pct = Math.max(0, Math.min(1, f.hp / f.maxHp));
      this.hpFill.scaleX = pct;
      // Barre « fantôme » blanche : montre les dégâts qui viennent d'être subis
      this.ghost = pct > this.ghost ? pct : Math.max(pct, this.ghost - dt * 0.7);
      this.hpGhost.scaleX = this.ghost;
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
        this.crystalIcon.x = f.carrying > 1 ? -7 : 0;
      }
    }
  }

  destroy() {
    for (const o of [this.shadow, this.ring, this.aura, this.ice, this.beacon, this.over, ...this.stars]) o.destroy();
    this.rig.destroy();
  }
}
