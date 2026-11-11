// ─────────────────────────────────────────────────────────────
//  Effects — effets visuels éphémères : étincelles, ondes de choc,
//  rayons, souffles, chiffres de dégâts flottants.
// ─────────────────────────────────────────────────────────────
import { addText, hex } from '../ui/theme.js';
import { DEPTH } from './ArenaView.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;

    this.sparks = scene.add
      .particles(0, 0, 'dot', {
        lifespan: { min: 220, max: 520 },
        speed: { min: 50, max: 260 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(DEPTH.cloud);

    this.ringPool = [];
    this.textPool = [];
    /** Traits éphémères (rayons, arcs électriques, souffles), redessinés chaque image. */
    this.lines = [];
    this.g = scene.add.graphics().setDepth(DEPTH.cloud + 1);
  }

  /** Gerbe d'étincelles colorées. */
  burst(x, y, color, count = 10) {
    this.sparks.setParticleTint(color);
    this.sparks.explode(count, x, y);
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

  /** Chiffre flottant (dégâts, soins). */
  number(x, y, text, color = 0xffffff, size = 18) {
    let t = this.textPool.pop();
    if (!t) {
      t = addText(this.scene, 0, 0, '', { size: 18, ox: 0.5, oy: 0.5, stroke: '#0a0d18', strokeW: 4, depth: DEPTH.number });
    }
    t.setText(text)
      .setFontSize(size)
      .setColor(hex(color))
      .setPosition(x + (Math.random() - 0.5) * 18, y)
      .setAlpha(1)
      .setScale(1.25)
      .setVisible(true);
    this.scene.tweens.add({
      targets: t,
      y: y - 46,
      alpha: 0,
      scale: 0.9,
      duration: 750,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        t.setVisible(false);
        this.textPool.push(t);
      },
    });
  }

  /** Rayon épais (super de Volta). */
  beam(x0, y0, x1, y1, width, color) {
    this.lines.push({ kind: 'beam', x0, y0, x1, y1, width, color, t: 0, dur: 0.28 });
  }

  /** Arc électrique en zigzag (rebond de l'éclair). */
  zap(x0, y0, x1, y1, color) {
    this.lines.push({ kind: 'zap', x0, y0, x1, y1, color, t: 0, dur: 0.2 });
  }

  /** Cône de souffle (super d'Alizé). */
  cone(x, y, angle, range, halfAngle, color) {
    this.lines.push({ kind: 'cone', x, y, angle, range, halfAngle, color, t: 0, dur: 0.35 });
  }

  update(dt) {
    const g = this.g;
    g.clear();
    if (this.lines.length === 0) return;
    for (const l of this.lines) {
      l.t += dt;
      const k = Math.max(0, 1 - l.t / l.dur);
      if (l.kind === 'beam') {
        g.lineStyle(l.width * (0.4 + 0.9 * k), l.color, 0.55 * k);
        g.lineBetween(l.x0, l.y0, l.x1, l.y1);
        g.lineStyle(l.width * 0.35 * k + 2, 0xffffff, 0.95 * k);
        g.lineBetween(l.x0, l.y0, l.x1, l.y1);
      } else if (l.kind === 'zap') {
        const dx = l.x1 - l.x0;
        const dy = l.y1 - l.y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        g.lineStyle(4, l.color, k);
        g.beginPath();
        g.moveTo(l.x0, l.y0);
        const n = Math.max(2, Math.round(len / 28));
        for (let i = 1; i < n; i++) {
          const off = (Math.random() - 0.5) * 22;
          g.lineTo(l.x0 + (dx * i) / n + nx * off, l.y0 + (dy * i) / n + ny * off);
        }
        g.lineTo(l.x1, l.y1);
        g.strokePath();
      } else if (l.kind === 'cone') {
        // Arcs concentriques qui s'éloignent
        for (let i = 0; i < 3; i++) {
          const r = l.range * Math.min(1, (1 - k) * 1.3 + i * 0.18);
          g.lineStyle(7 - i * 1.5, l.color, 0.8 * k);
          g.beginPath();
          g.arc(l.x, l.y, r, l.angle - l.halfAngle, l.angle + l.halfAngle);
          g.strokePath();
        }
      }
    }
    this.lines = this.lines.filter((l) => l.t < l.dur);
  }
}
