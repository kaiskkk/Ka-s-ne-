// ─────────────────────────────────────────────────────────────
//  CharsScene — les personnages.
//   • Grille : les 5 personnages avec niveau, trophées et stats.
//   • Fiche (data.sheet = id) : attaque, super, fusions possibles,
//     bouton « Améliorer » (coûte des pièces) et choix du personnage.
// ─────────────────────────────────────────────────────────────
import { sfx } from '../../audio/Sfx.js';
import { CHARACTERS, CHARACTER_IDS, STAT_MAX } from '../../config/characters.js';
import { TILE } from '../../config/constants.js';
import { ELEMENTS } from '../../config/elements.js';
import { fusionsFor } from '../../config/fusions.js';
import { META } from '../../config/meta.js';
import { profile } from '../../meta/profile.js';
import { INK, REF_W, badge, bar, button, fmt, icon, panel, toast } from '../../ui/kit.js';
import { addText, fitWidth, hex, mix } from '../../ui/theme.js';
import { MenuBase, RIG_ANIM } from './MenuBase.js';

const EMBLEM = 162;

/** Dégâts d'une attaque « pleine » (tous les projectiles touchent), pour la barre de stats. */
function burstDamage(def) {
  return def.attack.dmg * (def.attack.count || 1);
}

export class CharsScene extends MenuBase {
  constructor() {
    super('Chars');
  }

  create() {
    this.begin();
    const sheet = this.sceneData.sheet;
    if (sheet && CHARACTERS[sheet]) this.drawSheet(sheet);
    else this.drawGrid();
  }

  // ── Grille ─────────────────────────────────────────────────

  drawGrid() {
    this.drawBackdrop(CHARACTERS[profile.data.selected].element, { rays: 0.1 });
    this.drawHeader('PERSONNAGES', 'Touche un personnage pour voir sa fiche et l’améliorer');
    this.drawCurrencies();

    const cw = 154;
    const ch = 300;
    const gap = 10;
    const x0 = (REF_W - (cw * 5 + gap * 4)) / 2;
    const y0 = 62;
    CHARACTER_IDS.forEach((id, i) => {
      const def = CHARACTERS[id];
      const el = ELEMENTS[def.element];
      const st = profile.char(id);
      const power = profile.power(id);
      const x = x0 + i * (cw + gap);
      const on = id === profile.data.selected;
      panel(this, x, y0, cw, ch, { fill: mix(0x18204a, el.color, on ? 0.3 : 0.1), header: mix(el.dark, 0x18204a, 0.2), headerH: 30 });
      if (on) {
        const g = this.add.graphics().setDepth(1);
        g.lineStyle(3, 0xffe27a, 1);
        g.strokeRoundedRect(x + 1, y0 + 1, cw - 2, ch - 2, 15);
      }
      // En-tête AU-DESSUS du personnage : la flamme de Braz ne doit pas cacher son nom
      this.add.image(x + 17, y0 + 15, 'fx', `em_${def.element}`).setScale(24 / EMBLEM).setDepth(7);
      fitWidth(addText(this, x + 33, y0 + 15, def.name, { size: 16, oy: 0.5, stroke: '#0a0d18', strokeW: 4, depth: 7 }), cw - 76);
      // Niveau (pastille en haut à droite)
      const g2 = this.add.graphics().setDepth(7);
      g2.fillStyle(INK, 1);
      g2.fillRoundedRect(x + cw - 42, y0 + 4, 36, 22, 11);
      g2.fillStyle(0x2f8be6, 1);
      g2.fillRoundedRect(x + cw - 40, y0 + 6, 32, 18, 9);
      addText(this, x + cw - 24, y0 + 15, `Niv. ${st.level}`, { size: 9.5, ox: 0.5, oy: 0.5, depth: 8 });

      // Personnage sur son estrade
      const g3 = this.add.graphics().setDepth(1);
      g3.fillStyle(0x000000, 0.3);
      g3.fillEllipse(x + cw / 2, y0 + 142, 96, 22);
      g3.fillStyle(el.color, 0.45);
      g3.fillEllipse(x + cw / 2, y0 + 139, 108, 26);
      this.addRig(id, x + cw / 2, y0 + 110, 1.34, on ? RIG_ANIM.hero : RIG_ANIM.idle);

      // Trophées
      icon(this, 'trophy', x + cw / 2 - 18, y0 + 166, 22, 2);
      addText(this, x + cw / 2 - 4, y0 + 166, fmt(st.trophies), { size: 14, oy: 0.5, color: '#ffe27a', depth: 2 });

      // Stats (avec le bonus de niveau)
      const stats = [
        ['PV', (def.hp * power) / (STAT_MAX.hp * 1.4), 0x5df27a],
        ['Dégâts', (burstDamage(def) * power) / (1450 * 1.4), 0xff7a5a],
        ['Vitesse', def.speed / STAT_MAX.speed, 0x6cc0ff],
      ];
      stats.forEach(([label, pct, color], k) => {
        const sy = y0 + 190 + k * 17;
        addText(this, x + 12, sy, label, { size: 9.5, oy: 0.5, color: '#c9d3ee', depth: 2 });
        bar(this, x + 54, sy - 4, cw - 68, 8, pct, color, { depth: 2 });
      });

      button(this, this.buttons, {
        id: `char-${id}`,
        x: x + 12,
        y: y0 + ch - 50,
        w: cw - 24,
        h: 34,
        label: on ? 'CHOISI' : 'VOIR',
        icon: on ? 'check' : null,
        iconSize: 18,
        size: 14,
        color: on ? 'green' : 'blue',
        onTap: () => this.go('Chars', { sheet: id }),
      });
      if (profile.canUpgrade(id)) badge(this, x + cw - 4, y0 + ch - 50, 1);
      this.buttons.add({ x, y: y0, w: cw, h: ch - 56, sound: 'pop', onTap: () => this.go('Chars', { sheet: id }) });
    });
  }

  // ── Fiche d'un personnage ──────────────────────────────────

  back() {
    if (this.sceneData.sheet) this.go('Chars', {}, -1);
    else super.back();
  }

  drawSheet(id) {
    const def = CHARACTERS[id];
    const el = ELEMENTS[def.element];
    const st = profile.char(id);
    const power = profile.power(id);
    const selected = profile.data.selected === id;
    this.drawBackdrop(def.element, { cx: 150, cy: 190 });
    this.drawHeader(def.name.toUpperCase(), `${el.name} · ${def.role} — ${def.tagline}`);
    this.drawCurrencies();

    // Grand personnage à gauche
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(150, 268, 200, 40);
    g.fillStyle(mix(el.color, 0xffffff, 0.12), 1);
    g.fillEllipse(150, 262, 208, 42);
    g.lineStyle(3, mix(el.light, 0xffffff, 0.4), 0.9);
    g.strokeEllipse(150, 262, 208, 42);
    const hero = this.addRig(id, 150, 204, 2.3, RIG_ANIM.hero);
    hero.rig.spawnT = 0;
    this.add.image(46, 78, 'fx', `em_${def.element}`).setScale(44 / EMBLEM).setDepth(3);
    // Niveau et trophées
    panel(this, 30, 300, 240, 34, { radius: 14, fill: 0x18204a });
    addText(this, 44, 317, `NIVEAU ${st.level}`, { size: 15, oy: 0.5, color: '#9fe0ff', depth: 2 });
    icon(this, 'trophy', 206, 317, 24, 2);
    addText(this, 220, 317, fmt(st.trophies), { size: 15, oy: 0.5, color: '#ffe27a', depth: 2 });

    // ── Colonne centrale : stats, attaque, super ──
    const x = 292;
    const y = 58;
    const w = 286;
    panel(this, x, y, w, 276, { fill: 0x18204a });
    const next = st.level < META.maxCharLevel;
    const stats = [
      ['PV', Math.round(def.hp * power), (def.hp * power) / (STAT_MAX.hp * 1.4), 0x5df27a, true],
      ['Dégâts', Math.round(burstDamage(def) * power), (burstDamage(def) * power) / (1450 * 1.4), 0xff7a5a, true],
      ['Vitesse', def.speed, def.speed / STAT_MAX.speed, 0x6cc0ff, false],
      ['Portée', `${(def.attack.range / TILE).toFixed(1).replace('.', ',')} cases`, def.attack.range / STAT_MAX.range, 0xffd24a, false],
    ];
    stats.forEach(([label, value, pct, color, grows], k) => {
      const sy = y + 20 + k * 21;
      addText(this, x + 14, sy, label, { size: 11, oy: 0.5, color: '#c9d3ee', depth: 2 });
      bar(this, x + 66, sy - 4.5, 120, 9, pct, color, { depth: 2 });
      addText(this, x + 196, sy, String(value), { size: 11, oy: 0.5, depth: 2 });
      // Aperçu du gain au niveau suivant
      if (grows && next) addText(this, x + w - 12, sy, '+5 %', { size: 10, ox: 1, oy: 0.5, color: '#b8ff9a', depth: 2 });
    });
    const blocks = [
      ['ATTAQUE', def.attack.name, def.attack.desc, '#ffffff'],
      ['SUPER', def.super.name, def.super.desc, '#ffd24a'],
    ];
    let by = y + 110;
    for (const [tag, title, desc, color] of blocks) {
      fitWidth(addText(this, x + 14, by, `${tag} — ${title}`, { size: 13, color, depth: 2 }), w - 28);
      const t = addText(this, x + 14, by + 17, desc, { size: 10.5, color: '#b9c4e4', bold: false, wrap: w - 28, lineSpacing: -1, depth: 2 });
      by += 24 + t.height + 10;
    }

    // ── Colonne de droite : fusions ──
    const fx = 592;
    const fw = 238;
    panel(this, fx, y, fw, 168, { fill: 0x18204a, header: 0x6a2f8a, headerH: 28 });
    addText(this, fx + 12, y + 14, 'FUSIONS POSSIBLES', { size: 12.5, oy: 0.5, color: '#ffd9fb', depth: 2 });
    fusionsFor(def.element).forEach(({ fusion, other }, i) => {
      const fy = y + 46 + i * 31;
      this.add.image(fx + 22, fy, 'fx', `em_${def.element}`).setScale(22 / EMBLEM).setDepth(2);
      this.add.image(fx + 40, fy, 'fx', `em_${other}`).setScale(22 / EMBLEM).setDepth(2.1);
      fitWidth(addText(this, fx + 58, fy - 6, fusion.name, { size: 12.5, oy: 0.5, depth: 2 }), fw - 66);
      fitWidth(addText(this, fx + 58, fy + 8, `avec ${ELEMENTS[other].name}`, { size: 9.5, oy: 0.5, color: hex(ELEMENTS[other].light), bold: false, depth: 2 }), fw - 66);
    });

    // ── Boutons : améliorer / choisir ──
    const cost = profile.upgradeCost(id);
    if (cost == null) {
      panel(this, fx, 238, fw, 42, { fill: 0x3a2f10, radius: 14 });
      addText(this, fx + fw / 2, 259, 'NIVEAU MAXIMUM', { size: 15, ox: 0.5, oy: 0.5, color: '#ffe27a', depth: 2 });
    } else {
      button(this, this.buttons, {
        id: 'upgrade',
        x: fx,
        y: 236,
        w: fw,
        h: 44,
        label: `AMÉLIORER  ${fmt(cost)}`,
        suffix: 'coin',
        suffixSize: 24,
        size: 15,
        color: 'green',
        enabled: profile.canUpgrade(id),
        sound: 'upgrade',
        onDenied: () => toast(this, `Il te manque ${fmt(cost - profile.data.coins)} pièces`, '#ff9aa5'),
        onTap: () => {
          profile.upgrade(id);
          this.scene.restart({ sheet: id, slide: 0, upgraded: true });
        },
      });
    }
    button(this, this.buttons, {
      id: 'select',
      x: fx,
      y: 292,
      w: fw,
      h: 42,
      label: selected ? 'PERSONNAGE CHOISI' : 'CHOISIR CE PERSONNAGE',
      icon: selected ? 'check' : null,
      iconSize: 20,
      size: 13.5,
      color: selected ? 'dark' : 'yellow',
      onTap: () => {
        if (!selected) {
          profile.select(id);
          sfx.play('reward');
        }
        this.go('Home', {}, -1);
      },
    });

    if (this.sceneData.upgraded) {
      this.time.delayedCall(80, () => hero.rig.superPose());
      const p = this.add
        .particles(150, 190, 'fx', { frame: 'star', speed: { min: 120, max: 340 }, lifespan: 800, scale: { start: 0.6, end: 0 }, rotate: { start: 0, end: 360 }, emitting: false })
        .setDepth(6);
      p.explode(26);
      toast(this, `Niveau ${st.level} ! +5 % de PV et de dégâts`, '#b8ff9a');
    }
  }
}
