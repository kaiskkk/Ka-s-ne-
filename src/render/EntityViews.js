// ─────────────────────────────────────────────────────────────
//  Vues des entités : projectiles, zones d'effet, frappes annoncées, cristaux.
//  Chaque « couche » synchronise ses objets Phaser avec la simulation.
// ─────────────────────────────────────────────────────────────
import { TEAM_NEUTRAL } from '../config/constants.js';
import { TEAM_COLORS } from '../config/elements.js';
import { TAU, lerp } from '../sim/mathx.js';
import { drawCrystal } from '../ui/shapes.js';
import { COLORS, addText } from '../ui/theme.js';
import { DEPTH } from './ArenaView.js';

/** Couleurs des projectiles et des effets, par type visuel. */
export const VISUALS = {
  feu: { color: 0xff7a2a, glow: 0xffc070 },
  eau: { color: 0x3fb0ff, glow: 0xb8e6ff },
  terre: { color: 0xc49a66, glow: 0xe8cfa8 },
  foudre: { color: 0xffe84d, glow: 0xffffff },
  vent: { color: 0x9df5dd, glow: 0xffffff },
  magma: { color: 0xff4a12, glow: 0xffb13a },
  plasma: { color: 0xd96bff, glow: 0xffd6ff },
  seisme: { color: 0xc49a66, glow: 0xffe84d },
  meteore: { color: 0xff4a12, glow: 0xffb13a },
};

export function visualOf(key) {
  return VISUALS[key] || VISUALS.feu;
}

// ── Projectiles ──────────────────────────────────────────────

export class ProjectileLayer {
  constructor(scene) {
    this.scene = scene;
    this.views = new Map();
    this.pool = [];
    this.frame = 0;
  }

  sync(projectiles, alpha) {
    this.frame += 1;
    for (const p of projectiles) {
      let v = this.views.get(p.id);
      if (!v) {
        v = this.pool.pop() || this.create();
        const vis = visualOf(p.visual);
        const big = p.visual === 'magma' || p.visual === 'plasma';
        v.core.setTint(vis.color).setDisplaySize(p.r * (big ? 2.4 : 3.2), p.r * 2.2);
        v.glow.setTint(vis.glow).setDisplaySize(p.r * 5.5, p.r * 5.5);
        v.core.setRotation(Math.atan2(p.vy, p.vx)).setVisible(true);
        v.glow.setVisible(true);
        this.views.set(p.id, v);
      }
      v.frame = this.frame;
      const x = lerp(p.px, p.x, alpha);
      const y = lerp(p.py, p.y, alpha);
      v.core.setPosition(x, y);
      v.glow.setPosition(x, y);
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
    const glow = this.scene.add.image(0, 0, 'dot').setDepth(DEPTH.projectile).setBlendMode('ADD').setAlpha(0.75);
    const core = this.scene.add.image(0, 0, 'disc').setDepth(DEPTH.projectile + 0.1);
    return { core, glow, frame: 0 };
  }
}

// ── Zones ────────────────────────────────────────────────────

const ZONE_STYLE = {
  source: { fill: 0x4dffb8, alpha: 0.2, ring: 0x4dffb8 },
  brasier: { fill: 0xff6a1f, alpha: 0.3, ring: 0xffb13a },
  lave: { fill: 0xff4a12, alpha: 0.55, ring: 0xffb13a },
  marecage: { fill: 0x5d7030, alpha: 0.5, ring: 0x9bb84f },
  maree: { fill: 0x2f7bff, alpha: 0.34, ring: 0xffe84d },
  vapeur: { fill: 0xe8eef5, alpha: 0.42, ring: 0xffffff, cloud: true },
  tornade: { fill: 0xff6a1f, alpha: 0.28, ring: 0xffd24a, cloud: true },
  blizzard: { fill: 0xbfe9ff, alpha: 0.28, ring: 0xffffff, cloud: true },
  sable: { fill: 0xd9b36a, alpha: 0.36, ring: 0xf0d9a0, cloud: true },
  cyclone: { fill: 0x7d6bff, alpha: 0.24, ring: 0xc4f7e8, cloud: true },
};

function seeded(i, k) {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class ZoneLayer {
  constructor(scene, localTeam) {
    this.scene = scene;
    this.localTeam = localTeam;
    this.views = new Map();
    this.frame = 0;
  }

  sync(zones, alpha, time) {
    this.frame += 1;
    for (const z of zones) {
      let g = this.views.get(z.id);
      const style = ZONE_STYLE[z.kind] || ZONE_STYLE.brasier;
      if (!g) {
        g = this.scene.add.graphics().setDepth(style.cloud ? DEPTH.cloud : DEPTH.zone);
        this.views.set(z.id, g);
      }
      g.frame = this.frame;
      g.setPosition(lerp(z.px, z.x, alpha), lerp(z.py, z.y, alpha));
      this.draw(g, z, style, time);
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
          g.lineStyle(z.kind === 'tornade' ? 9 : 5, i % 2 ? style.ring : style.fill, 0.75 * fade);
          g.beginPath();
          g.arc(0, 0, rr, a0, a0 + 1.9);
          g.strokePath();
        }
        if (z.kind === 'tornade') {
          g.fillStyle(0xfff0a0, 0.7 * fade);
          g.fillCircle(0, 0, r * 0.22);
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
      case 'blizzard':
        for (let i = 0; i < 22; i++) {
          const a = seeded(i, 1) * TAU + t * 1.6;
          const d = r * Math.sqrt((seeded(i, 2) + t * 0.25) % 1);
          g.fillStyle(0xffffff, 0.85 * fade);
          g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, 2 + 2.5 * seeded(i, 3));
        }
        break;
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
      case 'source':
        // Petites croix de soin qui montent
        for (let i = 0; i < 6; i++) {
          const k = (t * 0.6 + seeded(i, 1)) % 1;
          const x = (seeded(i, 2) - 0.5) * r * 1.3;
          const y = (seeded(i, 3) - 0.5) * r * 1.1 - k * 30;
          g.fillStyle(0xd6ffe9, (1 - k) * 0.9 * fade);
          g.fillRect(x - 7, y - 2, 14, 4);
          g.fillRect(x - 2, y - 7, 4, 14);
        }
        break;
      case 'marecage':
        for (let i = 0; i < 9; i++) {
          const k = (t * 0.5 + seeded(i, 1)) % 1;
          g.fillStyle(0x9bb84f, (1 - k) * 0.7 * fade);
          g.fillCircle((seeded(i, 2) - 0.5) * r * 1.4, (seeded(i, 3) - 0.5) * r * 1.4, 4 + k * 9);
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
  constructor(scene, crystals) {
    this.scene = scene;
    this.views = crystals.map((c) => {
      const glow = scene.add.image(c.x, c.y, 'dot').setDepth(DEPTH.crystal).setTint(COLORS.crystal).setBlendMode('ADD');
      const g = scene.add.graphics().setDepth(DEPTH.crystal + 0.1);
      drawCrystal(g, 17, COLORS.crystal, COLORS.crystalDark);
      const label = addText(scene, c.x, c.y, '', {
        size: 16,
        color: '#bffcff',
        ox: 0.5,
        oy: 0.5,
        stroke: '#0a0d18',
        strokeW: 4,
        depth: DEPTH.crystal + 0.2,
      });
      return { c, g, glow, label, shown: '' };
    });
  }

  update(time, matchTime) {
    for (const v of this.views) {
      const c = v.c;
      if (!c.active) {
        // Pas encore apparu : silhouette + compte à rebours
        const left = Math.ceil(c.spawnAt - matchTime);
        v.g.setVisible(true).setPosition(c.x, c.y).setAlpha(0.22).setScale(0.9);
        v.glow.setVisible(false);
        const txt = left > 0 ? String(left) : '';
        if (txt !== v.shown) {
          v.shown = txt;
          v.label.setText(txt);
        }
        v.label.setVisible(true).setPosition(c.x, c.y);
        continue;
      }
      v.label.setVisible(false);
      if (c.carrierId >= 0) {
        // Porté : c'est l'icône au-dessus du porteur qui l'indique
        v.g.setVisible(false);
        v.glow.setVisible(false);
        continue;
      }
      const bob = Math.sin(time * 0.005 + c.id * 2) * 4;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.006 + c.id);
      v.g.setVisible(true).setPosition(c.x, c.y - 6 + bob).setAlpha(1).setScale(1);
      v.glow
        .setVisible(true)
        .setPosition(c.x, c.y - 4)
        .setDisplaySize(90 + pulse * 30, 90 + pulse * 30)
        .setAlpha(0.45 + 0.25 * pulse);
    }
  }
}
