// ─────────────────────────────────────────────────────────────
//  Effects — tout ce qui donne du « jus » à l'écran :
//  particules propres à chaque élément (flammes, gouttes, éclats de roche,
//  étincelles, souffles de vent), ondes de choc, éclairs, traces au sol,
//  chiffres de dégâts, et la grande animation de FUSION.
// ─────────────────────────────────────────────────────────────
import { addText, hex } from '../ui/theme.js';
import { DEPTH } from './ArenaView.js';

/** Particules lancées pour chaque type visuel : [émetteur, proportion]. */
const ELEMENT_MIX = {
  feu: [['flame', 1], ['glow', 0.4]],
  magma: [['flame', 1], ['rock', 0.5]],
  meteore: [['flame', 1], ['rock', 0.6], ['smoke', 0.4]],
  eau: [['drop', 1], ['bubble', 0.5]],
  terre: [['rock', 1], ['dust', 0.5]],
  seisme: [['rock', 1], ['dust', 0.8]],
  foudre: [['spark', 1], ['bolt', 0.4]],
  vent: [['wind', 1], ['puff', 0.3]],
  plasma: [['plasma', 1], ['bolt', 0.3]],
};

export const ELEMENT_COLORS = {
  feu: 0xff7a2a,
  magma: 0xff5a1f,
  meteore: 0xff5a1f,
  eau: 0x3fb0ff,
  terre: 0xc49a66,
  seisme: 0xc49a66,
  foudre: 0xffe84d,
  vent: 0x9df5dd,
  plasma: 0xd96bff,
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const mk = (frame, config, depth = DEPTH.cloud, texture = 'fx') => {
      const cfg = { emitting: false, maxAliveParticles: 140, ...config };
      if (frame) cfg.frame = frame;
      return scene.add.particles(0, 0, texture, cfg).setDepth(depth);
    };
    const all = { min: 0, max: 360 };

    this.em = {
      flame: mk('flame', {
        lifespan: { min: 320, max: 620 },
        speed: { min: 20, max: 150 },
        angle: all,
        gravityY: -260,
        scale: { start: 0.42, end: 0.08 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -25, max: 25 },
        blendMode: 'ADD',
      }),
      drop: mk('drop', {
        lifespan: { min: 320, max: 560 },
        speed: { min: 90, max: 260 },
        angle: all,
        gravityY: 520,
        scale: { start: 0.42, end: 0.16 },
        alpha: { start: 1, end: 0 },
      }),
      bubble: mk('bubble', {
        lifespan: { min: 400, max: 800 },
        speed: { min: 20, max: 90 },
        angle: all,
        gravityY: -120,
        scale: { start: 0.28, end: 0.55 },
        alpha: { start: 0.9, end: 0 },
      }),
      rock: mk('rock', {
        lifespan: { min: 380, max: 680 },
        speed: { min: 90, max: 280 },
        angle: all,
        gravityY: 460,
        scale: { start: 0.46, end: 0.26 },
        alpha: { start: 1, end: 0 },
        rotate: { start: 0, end: 360 },
      }),
      spark: mk('spark', {
        lifespan: { min: 140, max: 380 },
        speed: { min: 110, max: 360 },
        angle: all,
        scale: { start: 0.5, end: 0 },
        rotate: all,
        blendMode: 'ADD',
      }),
      plasma: mk('spark', {
        lifespan: { min: 200, max: 460 },
        speed: { min: 80, max: 300 },
        angle: all,
        scale: { start: 0.55, end: 0 },
        rotate: all,
        tint: 0xe08bff,
        blendMode: 'ADD',
      }),
      bolt: mk('bolt', {
        lifespan: { min: 90, max: 200 },
        speed: { min: 30, max: 160 },
        angle: all,
        scale: { start: 0.55, end: 0.2 },
        rotate: all,
        alpha: { start: 1, end: 0 },
        blendMode: 'ADD',
      }),
      wind: mk('wind', {
        lifespan: { min: 260, max: 520 },
        speed: { min: 110, max: 320 },
        angle: all,
        scale: { start: 0.55, end: 0.1 },
        alpha: { start: 0.9, end: 0 },
        rotate: all,
      }),
      puff: mk('smoke', {
        lifespan: { min: 300, max: 600 },
        speed: { min: 20, max: 110 },
        angle: all,
        scale: { start: 0.2, end: 0.6 },
        alpha: { start: 0.55, end: 0 },
      }),
      dust: mk('smoke', {
        lifespan: { min: 380, max: 760 },
        speed: { min: 20, max: 120 },
        angle: all,
        scale: { start: 0.25, end: 0.75 },
        alpha: { start: 0.6, end: 0 },
        tint: 0xc9ab82,
      }),
      smoke: mk('smoke', {
        lifespan: { min: 500, max: 1000 },
        speed: { min: 15, max: 70 },
        angle: all,
        gravityY: -60,
        scale: { start: 0.3, end: 0.95 },
        alpha: { start: 0.5, end: 0 },
        tint: 0x6b6f7a,
      }),
      leaf: mk('leaf', {
        lifespan: { min: 500, max: 900 },
        speed: { min: 40, max: 160 },
        angle: all,
        gravityY: 180,
        scale: { start: 0.5, end: 0.3 },
        alpha: { start: 1, end: 0 },
        rotate: { start: 0, end: 300 },
      }, DEPTH.bush + 1),
      shard: mk('shard', {
        lifespan: { min: 350, max: 700 },
        speed: { min: 80, max: 260 },
        angle: all,
        scale: { start: 0.5, end: 0.1 },
        alpha: { start: 1, end: 0 },
        rotate: { start: 0, end: 280 },
        blendMode: 'ADD',
      }),
      plus: mk('plus', {
        lifespan: { min: 600, max: 1000 },
        speedY: { min: -90, max: -40 },
        speedX: { min: -25, max: 25 },
        scale: { start: 0.5, end: 0.25 },
        alpha: { start: 1, end: 0 },
      }),
      snow: mk('snow', {
        lifespan: { min: 500, max: 1000 },
        speed: { min: 20, max: 110 },
        angle: all,
        scale: { start: 0.5, end: 0.2 },
        alpha: { start: 1, end: 0 },
        rotate: { start: 0, end: 200 },
      }),
      sand: mk('sand', {
        lifespan: { min: 350, max: 800 },
        speed: { min: 60, max: 220 },
        angle: all,
        scale: { start: 0.5, end: 0.15 },
        alpha: { start: 0.9, end: 0 },
      }),
      star: mk('star', {
        lifespan: { min: 400, max: 700 },
        speed: { min: 60, max: 200 },
        angle: all,
        scale: { start: 0.4, end: 0 },
        rotate: { start: 0, end: 360 },
      }),
      glow: mk(undefined, {
        lifespan: { min: 220, max: 520 },
        speed: { min: 40, max: 240 },
        angle: all,
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: 'ADD',
      }, DEPTH.cloud, 'dot'),
    };
    // Traînées derrière les projectiles (particules presque immobiles)
    this.trail = {
      feu: mk('flame', { lifespan: 320, speed: { min: 5, max: 30 }, angle: all, gravityY: -120, scale: { start: 0.34, end: 0 }, alpha: { start: 0.9, end: 0 }, blendMode: 'ADD' }, DEPTH.projectile - 0.2),
      eau: mk('bubble', { lifespan: 380, speed: { min: 5, max: 30 }, angle: all, scale: { start: 0.22, end: 0.4 }, alpha: { start: 0.8, end: 0 } }, DEPTH.projectile - 0.2),
      terre: mk('smoke', { lifespan: 300, speed: { min: 5, max: 25 }, angle: all, scale: { start: 0.14, end: 0.3 }, alpha: { start: 0.45, end: 0 }, tint: 0xc9ab82 }, DEPTH.projectile - 0.2),
      foudre: mk('spark', { lifespan: 180, speed: { min: 10, max: 70 }, angle: all, scale: { start: 0.3, end: 0 }, rotate: all, blendMode: 'ADD' }, DEPTH.projectile - 0.2),
      vent: mk('wind', { lifespan: 240, speed: { min: 5, max: 30 }, angle: all, scale: { start: 0.3, end: 0.05 }, alpha: { start: 0.6, end: 0 }, rotate: all }, DEPTH.projectile - 0.2),
      magma: mk('flame', { lifespan: 420, speed: { min: 10, max: 50 }, angle: all, gravityY: -140, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD' }, DEPTH.projectile - 0.2),
      plasma: mk('spark', { lifespan: 260, speed: { min: 5, max: 40 }, angle: all, scale: { start: 0.36, end: 0 }, rotate: all, tint: 0xe08bff, blendMode: 'ADD' }, DEPTH.projectile - 0.2),
    };

    this.ringPool = [];
    this.flashPool = [];
    this.decalPool = [];
    this.textPool = [];
    this.orbPool = [];
    /** Traits éphémères (rayons, arcs électriques, souffles), redessinés chaque image. */
    this.lines = [];
    this.g = scene.add.graphics().setDepth(DEPTH.cloud + 1);
  }

  /** Gerbe d'un type de particules. `tint` optionnel (0xRRGGBB). */
  burst(kind, x, y, count = 8, tint = null) {
    const e = this.em[kind];
    if (!e) return;
    if (tint != null) e.setParticleTint(tint);
    e.explode(count, x, y);
  }

  /** Gerbe aux couleurs d'un élément (feu → flammes, eau → gouttes…). */
  element(visual, x, y, count = 10) {
    const mix = ELEMENT_MIX[visual] || ELEMENT_MIX.feu;
    for (const [kind, share] of mix) {
      const n = Math.max(1, Math.round(count * share));
      if (kind === 'glow') this.burst('glow', x, y, n, ELEMENT_COLORS[visual]);
      else this.burst(kind, x, y, n);
    }
  }

  /** Une particule de traînée derrière un projectile. */
  trailAt(visual, x, y) {
    const e = this.trail[visual];
    if (e) e.emitParticleAt(x, y, 1);
  }

  /** Onde circulaire qui s'élargit en s'effaçant. */
  ring(x, y, radius, color, duration = 420, width = 6, fillAlpha = 0) {
    const arc = this.ringPool.pop() || this.scene.add.circle(0, 0, 10).setDepth(DEPTH.cloud);
    arc.setRadius(radius);
    arc.setPosition(x, y).setVisible(true).setAlpha(1).setScale(0.15);
    arc.setStrokeStyle(width, color, 1);
    if (fillAlpha > 0) arc.setFillStyle(color, fillAlpha);
    else arc.setFillStyle();
    this.scene.tweens.add({
      targets: arc,
      scale: 1,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        arc.setVisible(false);
        this.ringPool.push(arc);
      },
    });
  }

  /** Éclair de lumière bref (cœur d'une explosion). */
  flash(x, y, radius, color = 0xffffff, duration = 200) {
    const img = this.flashPool.pop() || this.scene.add.image(0, 0, 'dot').setDepth(DEPTH.cloud + 0.5).setBlendMode('ADD');
    img.setPosition(x, y).setTint(color).setVisible(true).setAlpha(1).setDisplaySize(radius * 1.2, radius * 1.2);
    this.scene.tweens.add({
      targets: img,
      displayWidth: radius * 3.4,
      displayHeight: radius * 3.4,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        img.setVisible(false);
        this.flashPool.push(img);
      },
    });
  }

  /** Trace sombre laissée au sol par une explosion (s'efface en quelques secondes). */
  scorch(x, y, radius) {
    const e = this.decalPool.pop() || this.scene.add.ellipse(0, 0, 10, 10, 0x1a1208, 1).setDepth(DEPTH.ground + 0.5);
    e.setPosition(x, y).setSize(radius * 1.5, radius * 1.1).setVisible(true).setAlpha(0.38);
    this.scene.tweens.add({
      targets: e,
      alpha: 0,
      delay: 1200,
      duration: 2600,
      onComplete: () => {
        e.setVisible(false);
        this.decalPool.push(e);
      },
    });
  }

  /** Chiffre flottant (dégâts, soins) : il jaillit, grossit puis retombe en s'effaçant. */
  number(x, y, text, color = 0xffffff, size = 20) {
    let t = this.textPool.pop();
    if (!t) {
      t = addText(this.scene, 0, 0, '', { size: 20, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 5, depth: DEPTH.number });
    }
    const dx = (Math.random() - 0.5) * 44;
    t.setText(text)
      .setFontSize(size)
      .setColor(hex(color))
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(0.4)
      .setVisible(true);
    this.scene.tweens.add({ targets: t, scale: 1.25, duration: 110, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, x: x + dx, duration: 800, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: t, y: y - 54, duration: 800, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      scale: 0.85,
      delay: 480,
      duration: 320,
      onComplete: () => {
        t.setVisible(false);
        this.textPool.push(t);
      },
    });
  }

  /** Rayon épais (super de Volta). */
  beam(x0, y0, x1, y1, width, color) {
    this.lines.push({ kind: 'beam', x0, y0, x1, y1, width, color, t: 0, dur: 0.32 });
  }

  /** Arc électrique en zigzag. */
  zap(x0, y0, x1, y1, color, dur = 0.22) {
    this.lines.push({ kind: 'zap', x0, y0, x1, y1, color, t: 0, dur });
  }

  /** Cône de souffle (super d'Alizé). */
  cone(x, y, angle, range, halfAngle, color) {
    this.lines.push({ kind: 'cone', x, y, angle, range, halfAngle, color, t: 0, dur: 0.38 });
    for (let i = 0; i < 16; i++) {
      const a = angle + (Math.random() - 0.5) * halfAngle * 2;
      const d = Math.random() * range * 0.5;
      this.em.wind.setParticleTint(0xffffff);
      this.em.wind.emitParticleAt(x + Math.cos(a) * d, y + Math.sin(a) * d, 1);
    }
  }

  /**
   * GRANDE ANIMATION DE FUSION : deux flux d'énergie partent des deux
   * combattants, se rejoignent au point d'impact et explosent.
   */
  fusion(ax, ay, bx, by, tx, ty, colorA, colorB) {
    const scene = this.scene;
    // 1. Les deux combattants se chargent
    for (const [x, y, col] of [[ax, ay, colorA], [bx, by, colorB]]) {
      this.ring(x, y, 95, col, 520, 9, 0.22);
      this.flash(x, y, 70, col, 320);
      this.burst('glow', x, y, 22, col);
    }
    // 2. Orbes d'énergie qui filent vers le point de fusion
    const travel = 330;
    for (let i = 0; i < 14; i++) {
      const fromA = i % 2 === 0;
      const sx = fromA ? ax : bx;
      const sy = fromA ? ay : by;
      const orb = this.orbPool.pop() || scene.add.image(0, 0, 'dot').setDepth(DEPTH.cloud + 2).setBlendMode('ADD');
      orb
        .setPosition(sx + (Math.random() - 0.5) * 30, sy + (Math.random() - 0.5) * 30)
        .setTint(fromA ? colorA : colorB)
        .setVisible(true)
        .setAlpha(1)
        .setDisplaySize(34, 34);
      scene.tweens.add({
        targets: orb,
        x: tx,
        y: ty,
        displayWidth: 12,
        displayHeight: 12,
        delay: i * 16,
        duration: travel - i * 6,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          orb.setVisible(false);
          this.orbPool.push(orb);
        },
      });
    }
    this.lines.push({ kind: 'link', x0: ax, y0: ay, x1: tx, y1: ty, color: colorA, t: 0, dur: 0.42 });
    this.lines.push({ kind: 'link', x0: bx, y0: by, x1: tx, y1: ty, color: colorB, t: 0, dur: 0.42 });
    // 3. Explosion au point de rencontre
    scene.time.delayedCall(travel, () => {
      this.flash(tx, ty, 190, 0xffffff, 380);
      this.ring(tx, ty, 300, 0xffffff, 700, 16, 0.12);
      this.ring(tx, ty, 240, colorA, 620, 14);
      scene.time.delayedCall(90, () => this.ring(tx, ty, 270, colorB, 680, 14));
      this.burst('glow', tx, ty, 40, colorA);
      this.burst('glow', tx, ty, 40, colorB);
      this.burst('star', tx, ty, 14);
      // Rayons qui partent en étoile
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        this.lines.push({
          kind: 'ray',
          x0: tx,
          y0: ty,
          angle: a,
          len: 210,
          color: i % 2 ? colorA : colorB,
          t: 0,
          dur: 0.45,
        });
      }
    });
  }

  update(dt) {
    const g = this.g;
    g.clear();
    if (this.lines.length === 0) return;
    for (const l of this.lines) {
      l.t += dt;
      const k = Math.max(0, 1 - l.t / l.dur);
      if (l.kind === 'beam') {
        g.lineStyle(l.width * (0.5 + 1.1 * k), l.color, 0.5 * k);
        g.lineBetween(l.x0, l.y0, l.x1, l.y1);
        g.lineStyle(l.width * 0.4 * k + 2, 0xffffff, 0.95 * k);
        g.lineBetween(l.x0, l.y0, l.x1, l.y1);
        this.zigzag(g, l, 3, l.color, k, 26);
      } else if (l.kind === 'zap') {
        this.zigzag(g, l, 5, l.color, k, 22);
        this.zigzag(g, l, 2, 0xffffff, k, 14);
      } else if (l.kind === 'link') {
        g.lineStyle(14 * k + 2, l.color, 0.35 * k);
        g.lineBetween(l.x0, l.y0, l.x1, l.y1);
        this.zigzag(g, l, 4, 0xffffff, k, 18);
      } else if (l.kind === 'ray') {
        const p = 1 - k;
        const r0 = 30 + p * l.len * 0.6;
        const r1 = 60 + p * l.len;
        g.lineStyle(9 * k + 1, l.color, 0.85 * k);
        g.lineBetween(
          l.x0 + Math.cos(l.angle) * r0,
          l.y0 + Math.sin(l.angle) * r0,
          l.x0 + Math.cos(l.angle) * r1,
          l.y0 + Math.sin(l.angle) * r1,
        );
      } else if (l.kind === 'cone') {
        for (let i = 0; i < 3; i++) {
          const r = l.range * Math.min(1, (1 - k) * 1.3 + i * 0.18);
          g.lineStyle(8 - i * 1.5, l.color, 0.8 * k);
          g.beginPath();
          g.arc(l.x, l.y, r, l.angle - l.halfAngle, l.angle + l.halfAngle);
          g.strokePath();
        }
      }
    }
    this.lines = this.lines.filter((l) => l.t < l.dur);
  }

  zigzag(g, l, width, color, k, amp) {
    const dx = l.x1 - l.x0;
    const dy = l.y1 - l.y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    g.lineStyle(width, color, k);
    g.beginPath();
    g.moveTo(l.x0, l.y0);
    const n = Math.max(2, Math.round(len / 30));
    for (let i = 1; i < n; i++) {
      const off = (Math.random() - 0.5) * amp;
      g.lineTo(l.x0 + (dx * i) / n + nx * off, l.y0 + (dy * i) / n + ny * off);
    }
    g.lineTo(l.x1, l.y1);
    g.strokePath();
  }
}
