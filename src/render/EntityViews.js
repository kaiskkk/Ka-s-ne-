// ─────────────────────────────────────────────────────────────
//  Vues des entités : projectiles, zones d'effet, frappes annoncées, cristaux.
//  Chaque « couche » synchronise ses objets Phaser avec la simulation.
// ─────────────────────────────────────────────────────────────
import { FX_SCALE } from '../art/fxArt.js';
import { TEAM_NEUTRAL } from '../config/constants.js';
import { TEAM_COLORS } from '../config/elements.js';
import { TAU, lerp } from '../sim/mathx.js';
import { COLORS, addText } from '../ui/theme.js';
import { DEPTH } from './ArenaView.js';
import { ELEMENT_COLORS } from './Effects.js';

/** Apparence des projectiles : image, halo, rotation sur eux-mêmes (tours/s), scintillement. */
const PROJECTILES = {
  feu: { frame: 'p_feu', glow: 0xff8a2a, size: 1.15 },
  eau: { frame: 'p_eau', glow: 0x6cc6ff, size: 1.15 },
  terre: { frame: 'p_terre', glow: 0, spin: 11, size: 1.1 },
  foudre: { frame: 'p_foudre', glow: 0xfff27a, flicker: true, size: 1.15 },
  vent: { frame: 'p_vent', glow: 0xc4f7e8, spin: 20, size: 1.1 },
  magma: { frame: 'p_magma', glow: 0xff7a1f, spin: 4, size: 1.05 },
  plasma: { frame: 'p_plasma', glow: 0xd96bff, spin: 7, size: 1.05 },
};

export function visualColor(key) {
  return ELEMENT_COLORS[key] || ELEMENT_COLORS.feu;
}

// ── Projectiles ──────────────────────────────────────────────

export class ProjectileLayer {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.views = new Map();
    this.pool = [];
    this.frame = 0;
  }

  sync(projectiles, alpha, dt) {
    this.frame += 1;
    for (const p of projectiles) {
      let v = this.views.get(p.id);
      if (!v) {
        v = this.pool.pop() || this.create();
        const spec = PROJECTILES[p.visual] || PROJECTILES.feu;
        v.spec = spec;
        v.angle = Math.atan2(p.vy, p.vx);
        v.core.setFrame(spec.frame).setScale(spec.size / FX_SCALE).setRotation(v.angle).setVisible(true).setFlipY(false);
        v.glow.setVisible(!!spec.glow);
        if (spec.glow) v.glow.setTint(spec.glow).setDisplaySize(p.r * 6.5, p.r * 6.5);
        this.views.set(p.id, v);
      }
      v.frame = this.frame;
      const x = lerp(p.px, p.x, alpha);
      const y = lerp(p.py, p.y, alpha);
      v.core.setPosition(x, y);
      v.glow.setPosition(x, y);
      if (v.spec.spin) v.core.rotation += v.spec.spin * dt;
      if (v.spec.flicker) v.core.setFlipY(Math.random() < 0.5).setScale((v.spec.size / FX_SCALE) * (0.9 + Math.random() * 0.25));
      // Traînée de particules de l'élément
      if ((this.frame + p.id) % 2 === 0) this.effects.trailAt(p.visual, x, y);
    }
    for (const [id, v] of this.views) {
      if (v.frame === this.frame) continue;
      v.core.setVisible(false);
      v.glow.setVisible(false);
      this.pool.push(v);
      this.views.delete(id);
    }
  }

  create() {
    const glow = this.scene.add.image(0, 0, 'dot').setDepth(DEPTH.projectile).setBlendMode('ADD').setAlpha(0.7);
    const core = this.scene.add.image(0, 0, 'fx', 'p_feu').setDepth(DEPTH.projectile + 0.1);
    return { core, glow, frame: 0 };
  }
}

// ── Zones ────────────────────────────────────────────────────

/** Couleurs et particules de chaque type de zone : [émetteur, particules/s, teinte]. */
const ZONE_STYLE = {
  source: { fill: 0x4dffb8, alpha: 0.2, ring: 0x4dffb8, emit: [['plus', 7]] },
  brasier: { fill: 0xff6a1f, alpha: 0.3, ring: 0xffb13a, emit: [['flame', 16]] },
  lave: { fill: 0xff4a12, alpha: 0.5, ring: 0xffb13a, emit: [['flame', 9]] },
  marecage: { fill: 0x5d7030, alpha: 0.5, ring: 0x9bb84f, emit: [['bubble', 9, 0xb6d86a]] },
  maree: { fill: 0x2f7bff, alpha: 0.34, ring: 0xffe84d, emit: [['bolt', 9], ['drop', 5]] },
  vapeur: { fill: 0xe8eef5, alpha: 0.42, ring: 0xffffff, cloud: true, emit: [['puff', 18, 0xffffff]] },
  tornade: { fill: 0xff6a1f, alpha: 0.26, ring: 0xffd24a, cloud: true, emit: [['flame', 34], ['wind', 8, 0xffd9a0]] },
  blizzard: { fill: 0xbfe9ff, alpha: 0.28, ring: 0xffffff, cloud: true, emit: [['snow', 26]] },
  sable: { fill: 0xd9b36a, alpha: 0.34, ring: 0xf0d9a0, cloud: true, emit: [['sand', 30], ['dust', 6]] },
  cyclone: { fill: 0x7d6bff, alpha: 0.24, ring: 0xc4f7e8, cloud: true, emit: [['wind', 22, 0xe6dcff], ['bolt', 6]] },
};

function seeded(i, k) {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class ZoneLayer {
  constructor(scene, localTeam, effects) {
    this.scene = scene;
    this.localTeam = localTeam;
    this.effects = effects;
    this.views = new Map();
    this.frame = 0;
  }

  sync(zones, alpha, time, dt) {
    this.frame += 1;
    for (const z of zones) {
      let g = this.views.get(z.id);
      const style = ZONE_STYLE[z.kind] || ZONE_STYLE.brasier;
      if (!g) {
        g = this.scene.add.graphics().setDepth(style.cloud ? DEPTH.cloud : DEPTH.zone);
        g.acc = 0;
        this.views.set(z.id, g);
      }
      g.frame = this.frame;
      const x = lerp(z.px, z.x, alpha);
      const y = lerp(z.py, z.y, alpha);
      g.setPosition(x, y);
      this.draw(g, z, style, time);
      // Particules propres à la zone
      g.acc += dt;
      if (g.acc >= 0.05) {
        for (const [kind, rate, tint] of style.emit) {
          let n = rate * g.acc;
          n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const d = Math.sqrt(Math.random()) * z.r * 0.92;
            this.effects.burst(kind, x + Math.cos(a) * d, y + Math.sin(a) * d, 1, tint ?? null);
          }
        }
        g.acc = 0;
      }
    }
    for (const [id, g] of this.views) {
      if (g.frame === this.frame) continue;
      g.destroy();
      this.views.delete(id);
    }
  }

  draw(g, z, style, time) {
    const hostile = z.team === TEAM_NEUTRAL || z.team !== this.localTeam;
    const t = time * 0.001;
    // Apparition / disparition en fondu
    const fade = Math.min(1, z.t / 0.25, Math.max(0, (z.dur - z.t) / 0.4));
    const r = z.r * (0.75 + 0.25 * Math.min(1, z.t / 0.2));
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    g.clear();
    g.fillStyle(style.fill, style.alpha * fade);
    g.fillCircle(0, 0, r);

    switch (z.kind) {
      case 'vapeur':
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + t * 0.25 * (i % 2 ? 1 : -1);
          const d = r * (0.3 + 0.45 * seeded(i, 1));
          g.fillStyle(0xffffff, 0.2 * fade);
          g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, r * (0.3 + 0.18 * seeded(i, 2)));
        }
        break;
      case 'tornade':
      case 'cyclone': {
        const spin = z.kind === 'tornade' ? 7 : -5;
        for (let i = 0; i < 4; i++) {
          const a0 = t * spin + (i / 4) * TAU;
          const rr = r * (0.35 + 0.2 * i);
          g.lineStyle(z.kind === 'tornade' ? 10 : 6, i % 2 ? style.ring : style.fill, 0.8 * fade);
          g.beginPath();
          g.arc(0, 0, rr, a0, a0 + 1.9);
          g.strokePath();
        }
        if (z.kind === 'tornade') {
          g.fillStyle(0xfff0a0, 0.75 * fade);
          g.fillCircle(0, 0, r * 0.24);
        } else {
          // Lignes d'aspiration vers le centre
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + t * 0.6;
            const k = 1 - ((t * 0.9 + seeded(i, 3)) % 1);
            g.fillStyle(0xffffff, 0.55 * fade);
            g.fillCircle(Math.cos(a) * r * k, Math.sin(a) * r * k, 4);
          }
        }
        break;
      }
      case 'sable':
        for (let i = 0; i < 5; i++) {
          const a0 = t * 2.6 + (i / 5) * TAU;
          g.lineStyle(7, 0xf0d9a0, 0.4 * fade);
          g.beginPath();
          g.arc(0, 0, r * (0.3 + 0.14 * i), a0, a0 + 1.4);
          g.strokePath();
        }
        break;
      case 'maree':
        // Éclairs qui crépitent à la surface de l'eau
        g.lineStyle(3, 0xffe84d, 0.9 * fade);
        for (let i = 0; i < 3; i++) {
          let a = Math.random() * TAU;
          let d = Math.random() * r * 0.8;
          g.beginPath();
          g.moveTo(Math.cos(a) * d, Math.sin(a) * d);
          for (let k = 0; k < 3; k++) {
            a += (Math.random() - 0.5) * 0.7;
            d = Math.min(r * 0.95, d + 18 + Math.random() * 22);
            g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
          }
          g.strokePath();
        }
        break;
      case 'brasier':
      case 'lave':
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + t * (i % 2 ? 0.8 : -0.6);
          g.fillStyle(0xffd24a, (0.3 + 0.25 * Math.sin(t * 9 + i)) * fade);
          g.fillCircle(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.2);
        }
        break;
      default:
        break;
    }

    // Contour : rouge épais si la zone est dangereuse pour le joueur, bleu clair si elle est alliée
    if (hostile) {
      g.lineStyle(4, TEAM_COLORS[1].main, (0.65 + 0.35 * pulse) * fade);
      g.strokeCircle(0, 0, r);
    } else {
      g.lineStyle(3, TEAM_COLORS[0].light, 0.75 * fade);
      g.strokeCircle(0, 0, r);
    }
  }
}

// ── Frappes annoncées (météores, foudre) ─────────────────────

export class StrikeLayer {
  constructor(scene, localTeam) {
    this.scene = scene;
    this.localTeam = localTeam;
    this.g = scene.add.graphics().setDepth(DEPTH.strike);
  }

  sync(strikes) {
    const g = this.g;
    g.clear();
    for (const s of strikes) {
      const hostile = s.team === TEAM_NEUTRAL || s.team !== this.localTeam;
      const color = hostile ? (s.kind === 'foudre' ? 0xffe84d : 0xff5a36) : 0x7db8ff;
      const k = 1 - Math.max(0, s.delay) / s.total; // 0 → 1 jusqu'à l'impact
      g.fillStyle(color, 0.12 + 0.2 * k);
      g.fillCircle(s.x, s.y, s.r);
      g.fillStyle(color, 0.35);
      g.fillCircle(s.x, s.y, s.r * k);
      g.lineStyle(4, color, 0.95);
      g.strokeCircle(s.x, s.y, s.r);
    }
  }
}

// ── Cristaux ─────────────────────────────────────────────────

export class CrystalLayer {
  constructor(scene, crystals, effects) {
    this.scene = scene;
    this.effects = effects;
    this.views = crystals.map((c) => {
      const glow = scene.add.image(c.x, c.y, 'dot').setDepth(DEPTH.crystal).setTint(COLORS.crystal).setBlendMode('ADD');
      const img = scene.add.image(c.x, c.y, 'fx', 'crystal').setDepth(DEPTH.crystal + 0.1).setScale(0.74 / FX_SCALE);
      const label = addText(scene, c.x, c.y, '', {
        size: 17,
        color: '#bffcff',
        ox: 0.5,
        oy: 0.5,
        stroke: '#0a0d18',
        strokeW: 4,
        depth: DEPTH.crystal + 0.2,
      });
      return { c, img, glow, label, shown: '', spark: Math.random() };
    });
  }

  update(time, matchTime, dt) {
    for (const v of this.views) {
      const c = v.c;
      if (!c.active) {
        // Pas encore apparu : silhouette + compte à rebours
        const left = Math.ceil(c.spawnAt - matchTime);
        v.img.setVisible(true).setPosition(c.x, c.y - 6).setAlpha(0.25).setTint(0x224455);
        v.glow.setVisible(false);
        const txt = left > 0 ? String(left) : '';
        if (txt !== v.shown) {
          v.shown = txt;
          v.label.setText(txt);
        }
        v.label.setVisible(true).setPosition(c.x, c.y - 4);
        continue;
      }
      v.label.setVisible(false);
      if (c.carrierId >= 0) {
        // Porté : c'est l'icône au-dessus du porteur qui l'indique
        v.img.setVisible(false);
        v.glow.setVisible(false);
        continue;
      }
      const bob = Math.sin(time * 0.005 + c.id * 2) * 5;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.006 + c.id);
      v.img
        .setVisible(true)
        .clearTint()
        .setPosition(c.x, c.y - 10 + bob)
        .setAlpha(1)
        .setRotation(Math.sin(time * 0.003 + c.id) * 0.08);
      v.glow
        .setVisible(true)
        .setPosition(c.x, c.y - 6)
        .setDisplaySize(84 + pulse * 26, 84 + pulse * 26)
        .setAlpha(0.3 + 0.2 * pulse);
      // Petits éclats scintillants
      v.spark -= dt;
      if (v.spark <= 0) {
        v.spark = 0.25 + Math.random() * 0.4;
        this.effects.burst('shard', c.x + (Math.random() - 0.5) * 30, c.y - 10 + (Math.random() - 0.5) * 40, 1);
      }
    }
  }
}
