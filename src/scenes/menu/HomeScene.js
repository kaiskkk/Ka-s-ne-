// ─────────────────────────────────────────────────────────────
//  HomeScene — l'écran d'accueil.
//
//   ┌ profil + trophées ─────────────────────── pièces · gemmes · ⚙ ┐
//   │ Boutique                                                      │
//   │ Personnages            PERSONNAGE                  fiche du   │
//   │ Pass de saison         EN VEDETTE                  personnage │
//   │ Classement             (animé)                                │
//   └ Voie des Cristaux ──────────────── mode ──────── [ JOUER ] ───┘
// ─────────────────────────────────────────────────────────────
import { sfx } from '../../audio/Sfx.js';
import { CHARACTERS, CHARACTER_IDS } from '../../config/characters.js';
import { ELEMENTS } from '../../config/elements.js';
import { META } from '../../config/meta.js';
import { profile } from '../../meta/profile.js';
import { DIFFICULTIES } from '../../sim/BotAI.js';
import { INK, REF_H, REF_W, badge, bar, button, fmt, icon, panel, rewardFrame, rewardLabel, toast } from '../../ui/kit.js';
import { addText, fitWidth, hex, mix } from '../../ui/theme.js';
import { isIOS, isStandalone, isTouchDevice } from '../../ui/viewport.js';
import { MenuBase, RIG_ANIM } from './MenuBase.js';

const EMBLEM = 162;

export class HomeScene extends MenuBase {
  constructor() {
    super('Home');
  }

  create() {
    this.begin();
    const id = profile.data.selected;
    this.def = CHARACTERS[id];
    this.el = ELEMENTS[this.def.element];

    this.drawBackdrop(this.def.element, { cx: 430, cy: 190 });
    this.drawHero();
    this.drawProfile();
    this.drawCurrencies(true);
    this.drawSideButtons();
    this.drawCharacterCard();
    this.drawRoad();
    this.drawPlay();

    // Toute première visite : l'aide s'ouvre d'elle-même
    if (!profile.data.helpSeen) this.time.delayedCall(350, () => this.openHelp());
  }

  // ── Personnage en vedette ──────────────────────────────────

  drawHero() {
    const cx = 430;
    const cy = 196;
    const el = this.el;
    // Estrade
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(cx, cy + 66, 224, 44);
    g.fillStyle(mix(el.dark, 0x0a0d18, 0.35), 1);
    g.fillEllipse(cx, cy + 60, 236, 50);
    g.fillStyle(mix(el.color, 0xffffff, 0.12), 1);
    g.fillEllipse(cx, cy + 55, 222, 44);
    g.lineStyle(3, mix(el.light, 0xffffff, 0.4), 0.9);
    g.strokeEllipse(cx, cy + 55, 222, 44);
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(cx, cy + 56, 120, 22);

    const r = this.addRig(profile.data.selected, cx, cy, 2.45, RIG_ANIM.hero, 5);
    r.rig.spawnT = 0; // il surgit en rebondissant
    // Toucher le personnage ouvre sa fiche
    this.buttons.add({ id: 'hero', x: cx - 80, y: cy - 110, w: 160, h: 190, sound: 'pop', onTap: () => this.go('Chars', { sheet: profile.data.selected }) });

    // Flèches : changer de personnage sans quitter l'accueil
    const cycle = (step) => {
      const i = CHARACTER_IDS.indexOf(profile.data.selected);
      profile.select(CHARACTER_IDS[(i + step + CHARACTER_IDS.length) % CHARACTER_IDS.length]);
      this.scene.restart({ slide: step });
    };
    for (const [x, step, flip] of [[cx - 142, -1, false], [cx + 142, 1, true]]) {
      const b = button(this, this.buttons, { id: step < 0 ? 'prev' : 'next', x: x - 19, y: cy - 4, w: 38, h: 40, icon: 'back', iconSize: 20, color: 'dark', sound: 'pop', onTap: () => cycle(step) });
      if (flip) b.c.list[1].setFlipX(true);
    }
  }

  // ── Profil (en haut à gauche) ──────────────────────────────

  drawProfile() {
    const d = profile.data;
    const x = 14;
    const y = 8;
    const w = 186;
    panel(this, x, y, w, 38, { radius: 14, fill: 0x18204a, depth: 28 });
    // Avatar : la tête du personnage choisi, dans un médaillon
    const g = this.add.graphics().setDepth(29);
    g.fillStyle(INK, 1);
    g.fillCircle(x + 22, y + 19, 24);
    g.fillStyle(mix(this.el.color, 0xffffff, 0.15), 1);
    g.fillCircle(x + 22, y + 19, 21);
    this.add.image(x + 22, y + 21, `char_${d.selected}`, 'head').setScale(0.118).setDepth(29.5);
    for (const s of [-1, 1]) {
      this.add.image(x + 22 + s * 3.7 + 0.4, y + 24.6, `char_${d.selected}`, 'pupil').setScale(0.118).setDepth(29.6);
    }
    // Niveau
    g.fillStyle(INK, 1);
    g.fillCircle(x + 40, y + 34, 10.5);
    g.fillStyle(0x2f8be6, 1);
    g.fillCircle(x + 40, y + 34, 8.5);
    addText(this, x + 40, y + 33.5, String(d.level), { size: 11, ox: 0.5, oy: 0.5, depth: 30 });
    // Pseudo + barre d'XP
    fitWidth(addText(this, x + 56, y + 11, d.name, { size: 14, oy: 0.5, depth: 30 }), w - 66);
    const need = profile.xpNeeded();
    bar(this, x + 56, y + 23, w - 68, 8, d.xp / need, 0x4db4ff, { depth: 29 });
    addText(this, x + 56 + (w - 68) / 2, y + 27, `${d.xp} / ${need} XP`, { size: 7.5, ox: 0.5, oy: 0.5, depth: 30, stroke: '#0a0d18', strokeW: 2 });
    this.buttons.add({ id: 'profile', x, y, w, h: 44, onTap: () => this.openSettings() });

    // Trophées
    const tx = x + w + 12;
    panel(this, tx, y + 4, 82, 30, { radius: 15, fill: 0x18204a, depth: 28 });
    icon(this, 'trophy', tx + 8, y + 19, 34, 31);
    fitWidth(addText(this, tx + 28, y + 19, fmt(profile.totalTrophies), { size: 16, oy: 0.5, color: '#ffe27a', depth: 31 }), 48);
    this.buttons.add({ id: 'trophies', x: tx - 4, y, w: 90, h: 44, onTap: () => this.go('Track', { kind: 'road' }) });
  }

  // ── Colonne de boutons (à gauche) ──────────────────────────

  drawSideButtons() {
    const pend = profile.pending();
    const items = [
      ['Boutique', 'shop', 'red', 'Shop', pend.shop],
      ['Personnages', 'chars', 'blue', 'Chars', pend.chars],
      ['Pass de saison', 'pass', 'purple', 'Track', pend.pass, { kind: 'pass' }],
      ['Classement', 'ranks', 'green', 'Ranks', 0],
    ];
    items.forEach(([label, ic, color, key, n, data], i) => {
      const y = 62 + i * 60;
      button(this, this.buttons, {
        id: ic,
        x: 14,
        y,
        w: 96,
        h: 46,
        label,
        icon: ic,
        layout: 'col',
        size: 10.5,
        strokeW: 3,
        iconSize: 27,
        color,
        onTap: () => this.go(key, data || {}),
      });
      badge(this, 14 + 92, y + 3, n);
    });
  }

  // ── Fiche rapide du personnage (à droite) ──────────────────

  drawCharacterCard() {
    const id = profile.data.selected;
    const def = this.def;
    const el = this.el;
    const ch = profile.char(id);
    const x = 618;
    const y = 62;
    const w = 212;
    panel(this, x, y, w, 170, { fill: 0x18204a, header: mix(el.dark, 0x18204a, 0.25), headerH: 42 });
    this.add.image(x + 24, y + 21, 'fx', `em_${def.element}`).setScale(30 / EMBLEM).setDepth(2);
    fitWidth(addText(this, x + 44, y + 15, def.name.toUpperCase(), { size: 19, oy: 0.5, stroke: '#0a0d18', strokeW: 5, depth: 2 }), w - 52);
    fitWidth(addText(this, x + 45, y + 32, `${el.name} · ${def.role}`, { size: 10.5, oy: 0.5, color: hex(el.light), depth: 2 }), w - 52);

    // Niveau et trophées du personnage
    addText(this, x + 14, y + 58, `NIVEAU ${ch.level}`, { size: 14, oy: 0.5, color: '#9fe0ff', depth: 2 });
    icon(this, 'trophy', x + w - 62, y + 58, 22, 2);
    addText(this, x + w - 48, y + 58, fmt(ch.trophies), { size: 14, oy: 0.5, color: '#ffe27a', depth: 2 });
    // Puissance : part du chemin vers le niveau maximum
    bar(this, x + 14, y + 72, w - 28, 10, (ch.level - 1) / (META.maxCharLevel - 1), el.color, { depth: 2 });
    const bonus = Math.round((profile.power(id) - 1) * 100);
    addText(this, x + 14, y + 94, bonus > 0 ? `+${bonus} % de PV et de dégâts` : def.tagline, {
      size: 10.5,
      oy: 0.5,
      color: '#c9d3ee',
      bold: false,
      depth: 2,
      wrap: w - 28,
    });

    // Amélioration rapide
    const cost = profile.upgradeCost(id);
    if (cost == null) {
      addText(this, x + w / 2, y + 138, 'NIVEAU MAXIMUM', { size: 14, ox: 0.5, oy: 0.5, color: '#ffe27a', depth: 2 });
    } else {
      button(this, this.buttons, {
        id: 'upgrade',
        x: x + 12,
        y: y + 116,
        w: w - 24,
        h: 38,
        label: `AMÉLIORER  ${fmt(cost)}`,
        suffix: 'coin',
        suffixSize: 22,
        size: 14,
        color: 'green',
        enabled: profile.canUpgrade(id),
        sound: 'upgrade',
        onDenied: () => toast(this, 'Pas assez de pièces !', '#ff9aa5'),
        onTap: () => {
          profile.upgrade(id);
          this.scene.restart({ slide: 0, upgraded: true });
        },
      });
    }
    if (this.sceneData.upgraded) {
      // Petit feu d'artifice après une amélioration
      const r = this.rigs[0];
      this.time.delayedCall(60, () => r.rig.superPose());
      const p = this.add.particles(430, 190, 'fx', { frame: 'star', speed: { min: 120, max: 320 }, lifespan: 700, scale: { start: 0.55, end: 0 }, rotate: { start: 0, end: 360 }, emitting: false }).setDepth(6);
      p.explode(22);
      toast(this, `${def.name} passe au niveau ${ch.level} !`, '#b8ff9a');
    }
  }

  // ── Voie des Cristaux (en bas à gauche) ────────────────────

  drawRoad() {
    const { next, prevAt, best } = profile.roadProgress();
    const ready = profile.pending().road;
    const x = 14;
    const y = 318;
    const w = 330;
    const h = 56;
    panel(this, x, y, w, h, { fill: 0x18204a });
    addText(this, x + 12, y + 12, 'VOIE DES CRISTAUX', { size: 11.5, oy: 0.5, color: '#7df9ff', depth: 2 });
    icon(this, 'trophy', x + 22, y + 36, 26, 3);
    const bw = w - 100;
    if (next) {
      const pct = (best - prevAt) / (next.at - prevAt);
      bar(this, x + 40, y + 30, bw, 13, pct, 0xffc21f, { depth: 2 });
      // La Voie avance avec le RECORD de trophées : on le précise s'il diffère du total affiché en haut
      const record = best !== profile.totalTrophies ? 'Record ' : '';
      addText(this, x + 40 + bw / 2, y + 36.5, `${record}${best} / ${next.at}`, { size: 9.5, ox: 0.5, oy: 0.5, depth: 3, stroke: '#0a0d18', strokeW: 3 });
      const rw = icon(this, rewardFrame(next.reward), x + w - 34, y + 30, next.reward.chest ? 44 : 32, 3);
      this.tweens.add({ targets: rw, y: rw.y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      addText(this, x + w - 34, y + 48, rewardLabel(next.reward), { size: 9, ox: 0.5, oy: 0.5, depth: 3, stroke: '#0a0d18', strokeW: 3 });
    } else {
      bar(this, x + 40, y + 30, bw, 13, 1, 0xffc21f, { depth: 2 });
      addText(this, x + 40 + bw / 2, y + 36.5, 'Tous les paliers atteints !', { size: 9.5, ox: 0.5, oy: 0.5, depth: 3, stroke: '#0a0d18', strokeW: 3 });
    }
    if (ready) {
      addText(this, x + w - 12, y + 12, 'RÉCOMPENSE À RÉCUPÉRER !', { size: 10, ox: 1, oy: 0.5, color: '#b8ff9a', depth: 2 });
      badge(this, x + w - 2, y + 2, ready);
    }
    this.buttons.add({ id: 'road', x, y, w, h: h + 6, onTap: () => this.go('Track', { kind: 'road' }) });
  }

  // ── Mode de jeu + JOUER (en bas à droite) ──────────────────

  drawPlay() {
    const diff = DIFFICULTIES.find((d) => d.id === profile.data.difficulty) || DIFFICULTIES[0];
    // Mode sélectionné : toucher pour changer
    const mx = 356;
    const my = 322;
    const mw = 252;
    const mode = button(this, this.buttons, { id: 'mode', x: mx, y: my, w: mw, h: 48, color: 'dark', onTap: () => this.openModes() });
    const crystal = this.add.image(-mw / 2 + 26, -2, 'fx', 'crystal').setScale(0.2);
    mode.c.add([
      crystal,
      addText(this, -mw / 2 + 48, -13, 'MODE', { size: 9.5, oy: 0.5, color: '#9fc6ff' }),
      fitWidth(addText(this, -mw / 2 + 48, 2, 'Cristal d’élément', { size: 15, oy: 0.5 }), mw - 96),
      addText(this, -mw / 2 + 48, 16, `Bots : ${diff.name}`, { size: 9.5, oy: 0.5, color: '#c9d3ee', bold: false }),
      this.add.image(mw / 2 - 18, -1, 'ui', 'back').setScale(0.13).setFlipX(true),
    ]);

    // Énorme bouton JOUER, qui rebondit légèrement
    const play = button(this, this.buttons, {
      id: 'play',
      x: 618,
      y: 312,
      w: 212,
      h: 58,
      lip: 8,
      radius: 20,
      label: 'JOUER',
      size: 32,
      strokeW: 7,
      color: 'yellow',
      sound: 'play',
      onTap: () => this.startMatch(),
    });
    const y0 = play.c.y;
    this.tweens.add({ targets: play.c, y: y0 - 4, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: play.label, scale: play.label.scale * 1.06, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Fenêtre de choix du mode et de la difficulté des bots. */
  openModes() {
    this.openPopup('MODE DE JEU', 620, 300, (x, y, w) => {
      const cards = [
        { title: 'Cristal d’élément', desc: '3 contre 3 · gardez les 3 cristaux pendant 15 s', on: true },
        { title: 'Bientôt', desc: 'D’autres modes arriveront avec les prochaines mises à jour', on: false },
      ];
      cards.forEach((c, i) => {
        const cx = x + 20 + i * 296;
        const cw = 284;
        panel(this, cx, y + 54, cw, 96, { fill: c.on ? 0x23408a : 0x161d3a, radius: 14 });
        if (c.on) {
          this.add.image(cx + 34, y + 100, 'fx', 'crystal').setScale(0.34);
          icon(this, 'check', cx + cw - 20, y + 72, 24);
        } else icon(this, 'lock', cx + 34, y + 100, 38).setAlpha(0.7);
        fitWidth(addText(this, cx + 66, y + 80, c.title, { size: 17, oy: 0.5, color: c.on ? '#ffffff' : '#93a0c4' }), cw - 96);
        addText(this, cx + 66, y + 96, c.desc, { size: 10.5, color: c.on ? '#c9d3ee' : '#7f8aae', bold: false, wrap: cw - 80, lineSpacing: -1 });
      });
      addText(this, x + 22, y + 178, 'DIFFICULTÉ DES BOTS ADVERSES', { size: 12, oy: 0.5, color: '#9fc6ff' });
      addText(this, x + w - 22, y + 178, 'Plus c’est dur, plus ça rapporte', { size: 10.5, ox: 1, oy: 0.5, color: '#c9d3ee', bold: false });
      DIFFICULTIES.forEach((d, i) => {
        const on = d.id === profile.data.difficulty;
        const mul = META.match.difficultyMul[d.id] || 1;
        button(this, this.buttons, {
          id: `difficulty-${d.id}`,
          x: x + 20 + i * 196,
          y: y + 196,
          w: 186,
          h: 50,
          label: d.name,
          sub: mul > 1 ? `Trophées et pièces ×${String(mul).replace('.', ',')}` : 'Pour découvrir le jeu',
          size: 17,
          color: on ? 'yellow' : 'dark',
          onTap: () => {
            profile.setDifficulty(d.id);
            this.closePopup();
            this.scene.restart({ slide: 0 });
          },
        });
      });
    });
  }

  startMatch() {
    // Android / ordinateur tactile : plein écran + verrouillage paysage quand c'est possible.
    // (Sur iPhone, le plein écran s'obtient en ajoutant le jeu à l'écran d'accueil.)
    if (isTouchDevice() && !isIOS() && !isStandalone() && this.scale.fullscreen.available && !this.scale.isFullscreen) {
      try {
        this.scale.once('enterfullscreen', () => {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        });
        this.scale.startFullscreen();
      } catch {
        /* refusé : on joue dans la fenêtre */
      }
    }
    if (this.leaving) return;
    this.leaving = true;
    this.buttons.enabled = false;
    sfx.play('play');
    const cam = this.cameras.main;
    cam.fadeOut(220, 8, 12, 28);
    cam.once('camerafadeoutcomplete', () =>
      this.scene.start('Game', { charId: profile.data.selected, difficulty: profile.data.difficulty }),
    );
  }
}

export { REF_H, REF_W };
