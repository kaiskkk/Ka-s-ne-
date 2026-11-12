// ─────────────────────────────────────────────────────────────
//  CharacterRig — le « pantin » animé d'un personnage.
//
//  Il assemble les pièces dessinées par art/characterArt.js et les anime
//  par le code (animation procédurale, pas d'images clés) :
//   • repos : respiration, clignement des yeux, accessoire qui bouge ;
//   • marche : pieds alternés, corps qui rebondit, tête qui penche ;
//   • visée : les pupilles et l'arme suivent la direction visée ;
//   • tir : recul de l'arme et écrasement du corps (coup de poing pour Dolmen) ;
//   • touché : flash blanc ; gel : teinte glacée ;
//   • mort : bascule et disparaît ; réapparition : surgit en rebondissant.
//
//  Utilisé en match (FighterView), dans le menu et sur l'écran de résultat.
// ─────────────────────────────────────────────────────────────
import { CHAR_SCALE, RIGS } from '../art/characterArt.js';

const K = 1 / CHAR_SCALE;
// Repères verticaux (le point (0, 0) est le centre de la zone de collision du combattant)
const FOOT_Y = 21;
const FOOT_DX = 8.5;
const BODY_Y = 8;
const HEAD_Y = -15; // centre du visage
const FACE_OFFSET = 6; // le visage est dessiné 6 px sous le centre de l'image « head »
const EYE_DX = 7.8;
const EYE_DY = 7.5;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutBack(t) {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export class CharacterRig {
  /**
   * @param {Phaser.Scene} scene
   * @param {string} charId   'braz' | 'ondine' | 'dolmen' | 'volta' | 'alize'
   * @param {number} scale    taille d'affichage (1 = taille « monde »)
   */
  constructor(scene, charId, scale = 1) {
    this.scene = scene;
    this.id = charId;
    this.spec = RIGS[charId];
    this.baseScale = scale;
    const key = `char_${charId}`;
    const part = (frame, z) => {
      const img = scene.make.image({ key, frame, add: false }).setScale(K);
      // Rang d'empilement. (On n'utilise pas la propriété « z » de Phaser :
      // setPosition() la remet à zéro à chaque appel.)
      img.rank0 = z;
      img.rank = z;
      return img;
    };

    this.c = scene.add.container(0, 0).setScale(scale);
    this.parts = [];
    const add = (img) => {
      this.parts.push(img);
      this.c.add(img);
      return img;
    };

    // Ordre d'empilement (z) : pieds < corps < tête < yeux ; l'arme passe devant ou derrière selon la visée
    if (this.spec.extra === 'scarf') {
      this.scarf = [add(part('scarf', 0)), add(part('scarf', 0.1))];
      for (const s of this.scarf) s.setOrigin(0.05, 0.5);
    }
    this.footL = add(part('foot', 2));
    this.footR = add(part('foot', 2.1));
    this.body = add(part('body', 3));
    if (this.spec.extra === 'flame') this.flame = add(part('flame', 3.5)).setOrigin(0.5, 0.92);
    this.head = add(part('head', 4));
    this.pupilL = add(part('pupil', 5));
    this.pupilR = add(part('pupil', 5.1));
    this.lids = add(part('lids', 6)).setVisible(false);
    if (this.spec.extra === 'leaf') this.leaf = add(part('leaf', 6.5)).setOrigin(0.5, 0.95);
    if (this.spec.weapon) this.weapon = add(part('weapon', 8));
    if (this.spec.extra === 'orb') this.orb = add(part('orb', 8.1));
    if (this.spec.extra === 'spark') this.spark = add(part('spark', 8.1));
    this.handB = add(part('hand', 8.4));
    this.handA = add(part('hand', 8.5));

    // État d'animation
    this.t = Math.random() * 10;
    this.phase = Math.random() * 6;
    this.walk = 0;
    this.recoil = 0;
    this.superT = 0;
    this.punchSide = 1;
    this.flip = false;
    this.aimUp = null;
    this.blinkT = 1 + Math.random() * 3;
    this.hitT = 0;
    this.frozen = false;
    this.tintState = 'none';
    this.dead = false;
    this.deathT = 0;
    this.spawnT = 1;
    this.alpha = 1;
    this.setLayer(false);
  }

  setPosition(x, y) {
    this.c.setPosition(x, y);
    return this;
  }

  setDepth(d) {
    this.c.setDepth(d);
    return this;
  }

  setVisible(v) {
    this.c.setVisible(v);
    return this;
  }

  setAlpha(a) {
    this.alpha = a;
    return this;
  }

  /** L'arme et les mains passent derrière le corps quand on vise vers le haut. */
  setLayer(up) {
    if (this.aimUp === up) return;
    this.aimUp = up;
    const shift = up ? -7 : 0; // rang 8.x → 1.x : derrière les pieds et le corps
    for (const p of [this.weapon, this.orb, this.spark, this.handA, this.handB]) {
      if (p) p.rank = p.rank0 + shift;
    }
    this.c.sort('rank');
  }

  /** Déclenche l'animation de tir. */
  attack() {
    this.recoil = 1;
    this.punchSide *= -1;
  }

  /** Déclenche l'animation de super (gonflement). */
  superPose() {
    this.superT = 1;
    this.recoil = 1;
  }

  /** Flash blanc (le personnage vient d'être touché). */
  flash() {
    this.hitT = 0.11;
  }

  setFrozen(frozen) {
    this.frozen = frozen;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deathT = 0;
  }

  revive() {
    this.dead = false;
    this.spawnT = 0;
    this.hitT = 0;
    this.c.setVisible(true);
  }

  applyTint() {
    const want = this.hitT > 0 ? 'white' : this.frozen ? 'frozen' : 'none';
    if (want === this.tintState) return;
    this.tintState = want;
    for (const p of this.parts) {
      if (want === 'white') p.setTintFill(0xffffff);
      else if (want === 'frozen') p.setTint(0x9fdcff);
      else p.clearTint();
    }
  }

  /**
   * @param {number} dt  secondes
   * @param {object} st  { aim: angle visé, moveX, moveY: déplacement (−1…1) }
   */
  update(dt, st) {
    const t = (this.t += dt);
    const c = this.c;

    // ── Mort / réapparition ──
    if (this.dead) {
      this.deathT += dt;
      const k = Math.min(1, this.deathT / 0.45);
      c.setRotation(k * 1.5 * (this.flip ? -1 : 1));
      c.setScale(this.baseScale * (1 - 0.55 * k));
      c.setAlpha(this.alpha * (1 - k * k));
      if (k >= 1) c.setVisible(false);
      this.hitT = Math.max(0, this.hitT - dt);
      this.applyTint();
      return;
    }
    let pop = 1;
    if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt / 0.35);
      pop = easeOutBack(this.spawnT);
    }
    if (this.superT > 0) this.superT = Math.max(0, this.superT - dt * 3);
    c.setRotation(0);
    c.setScale(this.baseScale * pop * (1 + this.superT * 0.16));
    c.setAlpha(this.alpha);

    // ── Marche ──
    const speed = Math.min(1, Math.hypot(st.moveX, st.moveY));
    this.walk = lerp(this.walk, speed, Math.min(1, dt * 12));
    const w = this.walk;
    if (w > 0.05) this.phase += dt * (6 + 8 * w);
    const sw = Math.sin(this.phase);
    const cw = Math.cos(this.phase);
    const mdx = speed > 0.01 ? st.moveX / speed : 0;
    const mdy = speed > 0.01 ? st.moveY / speed : 0;
    const stride = 5.5 * w;
    this.footL.setPosition(-FOOT_DX + mdx * sw * stride, FOOT_Y + mdy * sw * stride * 0.7 - Math.max(0, cw) * 3 * w);
    this.footR.setPosition(FOOT_DX - mdx * sw * stride, FOOT_Y - mdy * sw * stride * 0.7 - Math.max(0, -cw) * 3 * w);

    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 6);
    const bob = -Math.abs(sw) * 2.4 * w;
    const breath = Math.sin(t * 3.2) * 0.022;
    const squash = this.recoil * 0.08;
    this.body.setPosition(0, BODY_Y + bob).setScale(K * (1 + squash), K * (1 + breath - squash));

    // ── Tête, yeux ──
    const ax = Math.cos(st.aim);
    const ay = Math.sin(st.aim);
    if (ax > 0.25) this.flip = false;
    else if (ax < -0.25) this.flip = true;
    const hx = mdx * 1.6 * w;
    const hy = HEAD_Y - FACE_OFFSET + bob * 1.4 + Math.sin(t * 3.2 + 0.6) * 0.7 + squash * 6;
    this.head.setPosition(hx, hy).setRotation(mdx * 0.07 * w + Math.sin(t * 1.7) * 0.015).setFlipX(this.flip);
    const px = ax * 2.5;
    const py = ay * 2.2;
    this.pupilL.setPosition(hx - EYE_DX + px, hy + EYE_DY + py);
    this.pupilR.setPosition(hx + EYE_DX + px, hy + EYE_DY + py);

    // Clignement
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3.5;
    const blinking = this.blinkT < 0;
    this.lids.setVisible(blinking).setPosition(hx, hy + EYE_DY);
    this.pupilL.setVisible(!blinking);
    this.pupilR.setVisible(!blinking);

    // ── Accessoires de tête ──
    if (this.flame) {
      this.flame
        .setPosition(hx, hy - 9)
        .setScale(K * (1 + Math.sin(t * 13) * 0.07), K * (1 + Math.sin(t * 9.5 + 1) * 0.1 + w * 0.08))
        .setRotation(-mdx * 0.25 * w + Math.sin(t * 6) * 0.05);
    }
    if (this.leaf) {
      this.leaf.setPosition(hx + (this.flip ? -4 : 4), hy - 17).setRotation(Math.sin(t * 3) * 0.22 - mdx * 0.3 * w);
    }

    // ── Arme et mains ──
    this.setLayer(this.aimUp ? ay < -0.25 : ay < -0.45);
    const pvx = 0;
    const pvy = BODY_Y - 2 + bob;
    const perpX = -ay;
    const perpY = ax;
    const SQ = 0.85; // légère perspective : les distances verticales sont un peu écrasées
    // Quand on vise vers le haut, l'arme est tenue sur le côté de la tête pour rester visible
    const up = Math.max(0, -ay);
    const side = (this.flip ? -1 : 1) * 17 * up;
    if (this.weapon) {
      const d = this.spec.weapon.dist - this.recoil * 6 + up * 6;
      const kick = this.recoil * 0.28 * (ax < 0 ? 1 : -1);
      const wx = pvx + ax * d + side;
      const wy = pvy + ay * d * SQ;
      this.weapon.setPosition(wx, wy).setRotation(st.aim + kick).setFlipY(ax < 0);
      this.handA.setPosition(pvx + ax * (d - 13) + side, pvy + ay * (d - 13) * SQ);
      if (this.id === 'alize') {
        // L'autre main se balance le long du corps
        this.handB.setPosition(pvx - ax * 4 + perpX * 13 * (ax < 0 ? 1 : -1), pvy + 3 - sw * 2 * w);
      } else {
        this.handB.setPosition(pvx + ax * (d - 2) + perpX * 2.5 + side, pvy + ay * (d - 2) * SQ + perpY * 2.5);
      }
      const tip = this.spec.weapon.tip - this.recoil * 6 + up * 6;
      if (this.orb) {
        this.orb
          .setPosition(pvx + ax * tip + side, pvy + ay * tip * SQ + Math.sin(t * 4) * 1.4)
          .setScale(K * (1 + this.recoil * 0.35));
      }
      if (this.spark) {
        const f = 0.75 + Math.random() * 0.5 + this.recoil;
        this.spark
          .setPosition(pvx + ax * tip + side, pvy + ay * tip * SQ)
          .setScale(K * f * 0.8)
          .setRotation(Math.random() * 6.28)
          .setAlpha(0.65 + Math.random() * 0.35);
      }
    } else {
      // Dolmen : deux gros poings, celui qui frappe part en avant
      const reachA = 15 + (this.punchSide > 0 ? this.recoil * 15 : 0);
      const reachB = 15 + (this.punchSide < 0 ? this.recoil * 15 : 0);
      const swing = sw * 2.5 * w;
      const gap = 14 + up * 9; // poings plus écartés quand ils passent derrière la tête
      this.handA.setPosition(pvx + ax * reachA + perpX * gap, pvy + (ay * reachA + perpY * gap) * SQ + swing);
      this.handB.setPosition(pvx + ax * reachB - perpX * gap, pvy + (ay * reachB - perpY * gap) * SQ - swing);
    }

    // ── Écharpe d'Alizé : flotte à l'opposé du mouvement ──
    if (this.scarf) {
      const base = w > 0.1 ? Math.atan2(-mdy, -mdx) : this.flip ? 0 : Math.PI;
      this.scarfAngle = this.scarfAngle === undefined ? base : rotateToward(this.scarfAngle, base, dt * 7);
      this.scarf.forEach((s, i) => {
        s.setPosition(i ? -3 : 3, BODY_Y - 9 + bob + i * 2.5).setRotation(
          this.scarfAngle + Math.sin(t * (7 + i * 1.5) + i * 1.3) * (0.22 + w * 0.2) + (i ? 0.28 : -0.2),
        );
      });
    }

    // ── Teintes ──
    if (this.hitT > 0) this.hitT = Math.max(0, this.hitT - dt);
    this.applyTint();
  }

  /** Position (monde) de la bouche de l'arme pour une visée donnée : départ des étincelles de tir. */
  muzzle(aim) {
    const ax = Math.cos(aim);
    const ay = Math.sin(aim);
    const up = Math.max(0, -ay);
    const reach = (this.spec.weapon ? this.spec.weapon.tip : 26) + up * 6;
    const side = this.spec.weapon ? (this.flip ? -1 : 1) * 17 * up : 0;
    const s = this.baseScale;
    return { x: this.c.x + (ax * reach + side) * s, y: this.c.y + (BODY_Y - 2 + ay * reach * 0.85) * s };
  }

  destroy() {
    this.c.destroy();
  }
}

function rotateToward(from, to, maxStep) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}
