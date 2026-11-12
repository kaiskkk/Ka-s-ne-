// ─────────────────────────────────────────────────────────────
//  MenuBase — socle commun de tous les écrans de menu : mise à l'échelle
//  (rectangle de référence 844 × 390 centré dans la zone sûre), fond animé,
//  barre des monnaies, fenêtres (pop-ups), transitions entre écrans et
//  animation des personnages.
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { music } from '../../audio/Music.js';
import { sfx } from '../../audio/Sfx.js';
import { ELEMENTS } from '../../config/elements.js';
import { profile } from '../../meta/profile.js';
import { CharacterRig } from '../../render/CharacterRig.js';
import { Buttons } from '../../ui/Buttons.js';
import { INK, REF_H, REF_W, button, countUp, fmt, icon, panel } from '../../ui/kit.js';
import { addText, fitWidth, mix, textResFor } from '../../ui/theme.js';
import { fitCamera, isIOS, isStandalone, isTouchDevice } from '../../ui/viewport.js';

const FADE = [8, 12, 28];

/** Façons d'animer un personnage dans les menus. */
export const RIG_ANIM = {
  /** Au repos : il respire, cligne des yeux et regarde autour de lui. */
  idle(r, dt, t) {
    r.rig.update(dt, { aim: 0.45 + Math.sin(t * 0.9 + r.phase) * 0.45, moveX: 0, moveY: 0 });
  },
  /** Vedette de l'accueil : prend une petite pose de temps en temps (tir, puis gonflement). */
  hero(r, dt, t) {
    const beat = Math.floor((t + r.phase) / 3.2);
    if (beat !== r.beat) {
      if (r.beat !== -1) {
        if (beat % 2) r.rig.attack();
        else r.rig.superPose();
      }
      r.beat = beat;
    }
    r.rig.update(dt, { aim: 0.55 + Math.sin(t * 0.7) * 0.95, moveX: 0, moveY: 0 });
  },
  /** Trottine sur place. */
  walk(r, dt, t) {
    r.rig.update(dt, { aim: Math.sin(t * 1.1) * 0.5, moveX: 0.9, moveY: 0 });
  },
  /** Saute de joie. */
  happy(r, dt, t) {
    r.rig.setPosition(r.x, r.y - Math.abs(Math.sin(t * 5 + r.phase)) * (r.jump ?? 8));
    r.rig.update(dt, { aim: Math.PI / 2 + Math.sin(t * 2 + r.phase) * 0.9, moveX: 0, moveY: 0 });
  },
  /** Regarde ses pieds. */
  sad(r, dt) {
    r.rig.update(dt, { aim: Math.PI / 2, moveX: 0, moveY: 0 });
  },
};

export class MenuBase extends Phaser.Scene {
  init(data) {
    this.sceneData = data || {};
  }

  /** À appeler au début de create(). */
  begin() {
    const zoom = fitCamera(this, REF_W, REF_H);
    this.textRes = textResFor(zoom);
    this.buttons = new Buttons(this);
    this.rigs = [];
    this.leaving = false;
    this.popup = null;
    this.toastText = null;

    // Transition d'entrée : fondu + léger glissement dans le sens de la navigation
    const cam = this.cameras.main;
    cam.fadeIn(170, ...FADE);
    const dir = this.sceneData.slide || 0;
    if (dir) {
      const target = cam.scrollX;
      cam.scrollX = target - dir * 44;
      this.tweens.add({ targets: cam, scrollX: target, duration: 220, ease: 'Cubic.easeOut' });
    }

    // Rotation / redimensionnement : on reconstruit l'écran
    this.onViewport = () => this.scene.restart({ ...this.sceneData, slide: 0 });
    this.game.events.on('viewport-changed', this.onViewport);
    this.events.once('shutdown', () => this.game.events.off('viewport-changed', this.onViewport));
    music.play('menu');
  }

  /** Change d'écran avec une transition. `dir` : 1 = on avance, −1 = on revient. */
  go(key, data = {}, dir = 1) {
    if (this.leaving) return;
    this.leaving = true;
    this.buttons.enabled = false;
    const cam = this.cameras.main;
    cam.fadeOut(110, ...FADE);
    this.tweens.add({ targets: cam, scrollX: cam.scrollX + dir * 36, duration: 110, ease: 'Quad.easeIn' });
    cam.once('camerafadeoutcomplete', () => this.scene.start(key, { ...data, slide: dir }));
  }

  back() {
    this.go('Home', {}, -1);
  }

  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    const t = time / 1000;
    for (const r of this.rigs) r.tick(r, dt, t);
  }

  addRig(id, x, y, scale, tick = RIG_ANIM.idle, depth = 5) {
    const rig = new CharacterRig(this, id, scale);
    rig.setPosition(x, y).setDepth(depth);
    const r = { rig, x, y, tick, phase: this.rigs.length * 1.7, beat: -1 };
    this.rigs.push(r);
    return r;
  }

  // ── Fond animé, coloré selon un élément ────────────────────

  drawBackdrop(elementId, o = {}) {
    const el = ELEMENTS[elementId] || ELEMENTS.eau;
    const top = mix(el.color, 0x18245a, 0.6);
    const bottom = mix(el.dark, 0x060a1a, 0.72);
    const g = this.add.graphics().setDepth(-30);
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(-3000, -3000, 6844, 6390);

    const cx = o.cx ?? REF_W / 2;
    const cy = o.cy ?? REF_H * 0.52;
    // Rayons de lumière qui tournent lentement
    const rays = this.add
      .image(cx, cy, 'rays')
      .setTint(el.light)
      .setAlpha(o.rays ?? 0.17)
      .setDisplaySize(1040, 1040)
      .setDepth(-28)
      .setBlendMode('ADD');
    this.tweens.add({ targets: rays, angle: 360, duration: 70000, repeat: -1 });
    const glow = this.add.image(cx, cy, 'dot').setTint(el.color).setAlpha(0.5).setDisplaySize(540, 540).setDepth(-27).setBlendMode('ADD');
    this.tweens.add({ targets: glow, alpha: 0.32, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Particules de l'élément qui montent
    const frame = { feu: 'flame', eau: 'bubble', terre: 'rock', foudre: 'spark', vent: 'wind' }[elementId] || 'spark';
    this.add
      .particles(0, 0, 'fx', {
        frame,
        x: { min: -40, max: REF_W + 40 },
        y: REF_H + 30,
        lifespan: { min: 6000, max: 9500 },
        speedY: { min: -72, max: -34 },
        speedX: { min: -16, max: 16 },
        scale: { start: 0.6, end: 0.25 },
        alpha: { start: 0.6, end: 0 },
        rotate: { min: -40, max: 40 },
        frequency: 380,
        advance: 8000,
        blendMode: frame === 'flame' || frame === 'spark' ? 'ADD' : 'NORMAL',
      })
      .setDepth(-26);

    // Bords assombris : le regard reste au centre
    this.add
      .image(REF_W / 2, REF_H / 2, 'vignette')
      .setTint(0x000000)
      .setAlpha(0.6)
      .setDisplaySize(REF_W * 1.7, REF_H * 1.7)
      .setDepth(-25);
  }

  // ── Barre du haut ──────────────────────────────────────────

  /** Pastilles « pièces » et « gemmes » (toucher le + ouvre la boutique). */
  drawCurrencies(withGear = false) {
    const right = REF_W - 14 - (withGear ? 42 : 0);
    const gemX = right - 102;
    const coinX = gemX - 10 - 116;
    this.shown = { coins: profile.data.coins, gems: profile.data.gems };
    this.coinText = this.currencyPill(coinX, 116, 'coin', profile.data.coins);
    this.gemText = this.currencyPill(gemX, 102, 'gem', profile.data.gems);
    this.coinPos = { x: coinX + 6, y: 26 };
    this.gemPos = { x: gemX + 6, y: 26 };
    if (withGear) {
      button(this, this.buttons, {
        id: 'settings',
        x: REF_W - 14 - 34,
        y: 10,
        w: 34,
        h: 30,
        icon: 'gear',
        iconSize: 22,
        color: 'dark',
        depth: 30,
        onTap: () => this.openSettings(),
      });
    }
  }

  currencyPill(x, w, frame, value) {
    const g = this.add.graphics().setDepth(30);
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(x - 2, 14, w + 4, 34, 17);
    g.fillStyle(INK, 1);
    g.fillRoundedRect(x - 3, 9, w + 6, 34, 17);
    g.fillStyle(0x141c3c, 1);
    g.fillRoundedRect(x, 12, w, 28, 14);
    icon(this, frame, x + 6, 26, 36, 31);
    const t = addText(this, x + 28, 26, fmt(value), { size: 15, oy: 0.5, depth: 31 });
    fitWidth(t, w - 58);
    const plus = icon(this, 'plus', x + w - 13, 26, 24, 31);
    const s0 = plus.scale;
    if (this.scene.key !== 'Shop') {
      this.buttons.add({
        id: `more-${frame}`,
        x: x - 3,
        y: 4,
        w: w + 6,
        h: 44,
        onPress: (p) => plus.setScale(p ? s0 * 0.82 : s0),
        onTap: () => this.go('Shop'),
      });
    }
    return t;
  }

  /** Fait défiler les compteurs vers les nouvelles valeurs (après un gain ou une dépense). */
  refreshCurrencies() {
    if (!this.coinText) return;
    const d = profile.data;
    if (d.coins !== this.shown.coins) {
      countUp(this, this.coinText, this.shown.coins, d.coins, 500);
      this.tweens.add({ targets: this.coinText, scale: this.coinText.scale * 1.25, duration: 110, yoyo: true });
    }
    if (d.gems !== this.shown.gems) {
      countUp(this, this.gemText, this.shown.gems, d.gems, 500);
      this.tweens.add({ targets: this.gemText, scale: this.gemText.scale * 1.25, duration: 110, yoyo: true });
    }
    this.shown = { coins: d.coins, gems: d.gems };
  }

  /** En-tête des sous-écrans : bouton retour + titre. */
  drawHeader(title, sub = '') {
    button(this, this.buttons, {
      id: 'back',
      x: 14,
      y: 9,
      w: 50,
      h: 32,
      icon: 'back',
      iconSize: 22,
      color: 'red',
      depth: 30,
      onTap: () => this.back(),
    });
    const t = addText(this, 78, 20, title, { size: 23, oy: 0.5, stroke: '#0a0d18', strokeW: 6, depth: 30 });
    if (sub) fitWidth(addText(this, 80, 40, sub, { size: 11, oy: 0.5, color: '#c9d3ee', bold: false, stroke: '#0a0d18', strokeW: 3, depth: 30 }), 500);
    return t;
  }

  // ── Fenêtres (pop-ups) ─────────────────────────────────────

  /**
   * Ouvre une fenêtre centrée. `build(x, y, w, h)` y dessine son contenu
   * avec les fonctions habituelles ; tout est détruit à la fermeture.
   */
  openPopup(title, w, h, build, o = {}) {
    this.closePopup();
    this.buttons.pushLayer();
    const before = new Set(this.children.list);
    const x = (REF_W - w) / 2;
    const y = (REF_H - h) / 2;
    this.add.rectangle(-3000, -3000, 6844, 6390, 0x04060f, 0.74).setOrigin(0, 0);
    panel(this, x, y, w, h, { fill: 0x1c2547, header: o.header ?? 0x2f8be6, headerH: 40 });
    fitWidth(addText(this, x + 18, y + 20, title, { size: 19, oy: 0.5, stroke: '#0a0d18', strokeW: 5 }), w - 80);
    // Toucher en dehors ferme la fenêtre ; toucher le panneau ne fait rien
    this.buttons.add({ id: 'outside', x: -3000, y: -3000, w: 6844, h: 6390, sound: false, onTap: () => this.closePopup() });
    this.buttons.add({ x, y, w, h, sound: false, onTap: () => {} });
    button(this, this.buttons, { id: 'close', x: x + w - 46, y: y + 6, w: 34, h: 26, label: '✕', size: 15, color: 'red', onTap: () => this.closePopup() });
    build(x, y, w, h);

    // Tout ce qui vient d'être créé passe au-dessus du reste et apparaît en fondu
    const objs = this.children.list.filter((ob) => !before.has(ob));
    objs.forEach((ob, i) => {
      ob.setDepth(300 + (ob.depth || 0) * 0.01 + i * 0.0001);
      const a = ob.alpha;
      ob.setAlpha(0);
      this.tweens.add({ targets: ob, alpha: a, duration: 130 });
    });
    this.popup = { objs, onClose: o.onClose };
    sfx.play('pop');
  }

  closePopup() {
    if (!this.popup) return;
    const { objs, onClose } = this.popup;
    this.popup = null;
    for (const ob of objs) {
      this.tweens.killTweensOf(ob);
      ob.destroy();
    }
    this.buttons.popLayer();
    if (onClose) onClose();
  }

  // ── Réglages et aide (accessibles depuis l'accueil) ────────

  openSettings() {
    this.openPopup('RÉGLAGES', 430, 262, (x, y, w) => {
      const row = (i, label, color, onTap, ic) =>
        button(this, this.buttons, { x: x + 24 + (i % 2) * 196, y: y + 56 + Math.floor(i / 2) * 58, w: 186, h: 42, label, size: 14, color, icon: ic, iconSize: 24, onTap });
      row(0, sfx.muted ? 'Sons : non' : 'Sons : oui', sfx.muted ? 'gray' : 'green', () => {
        sfx.toggle();
        this.openSettings();
      }, 'sound');
      row(1, music.enabled ? 'Musique : oui' : 'Musique : non', music.enabled ? 'green' : 'gray', () => {
        music.toggle();
        this.openSettings();
      }, 'note');
      row(2, 'Comment jouer', 'yellow', () => this.openHelp(), 'help');
      row(3, 'Changer de pseudo', 'blue', () => this.editName());
      addText(this, x + w / 2, y + 190, `Pseudo : ${profile.data.name}  ·  ${profile.data.stats.matches} matchs, ${profile.data.stats.wins} victoires`, {
        size: 11.5,
        ox: 0.5,
        oy: 0.5,
        color: '#c9d3ee',
        bold: false,
      });
      button(this, this.buttons, {
        x: x + w / 2 - 110,
        y: y + 210,
        w: 220,
        h: 30,
        label: 'Effacer ma progression',
        size: 11.5,
        color: 'dark',
        onTap: () => this.confirmReset(),
      });
    });
  }

  editName() {
    let name = null;
    try {
      name = window.prompt('Ton pseudo (12 caractères max.)', profile.data.name);
    } catch {
      name = null;
    }
    if (name != null && profile.setName(name)) this.scene.restart({ ...this.sceneData, slide: 0 });
  }

  confirmReset() {
    this.openPopup('EFFACER LA PROGRESSION ?', 400, 190, (x, y, w) => {
      addText(this, x + w / 2, y + 82, 'Pièces, gemmes, trophées, niveaux et récompenses\nseront remis à zéro. C’est définitif.', {
        size: 13,
        ox: 0.5,
        oy: 0.5,
        align: 'center',
        color: '#dfe6ff',
        bold: false,
      });
      button(this, this.buttons, { x: x + 24, y: y + 128, w: 168, h: 40, label: 'Annuler', size: 15, color: 'blue', onTap: () => this.closePopup() });
      button(this, this.buttons, {
        x: x + w - 192,
        y: y + 128,
        w: 168,
        h: 40,
        label: 'Tout effacer',
        size: 15,
        color: 'red',
        onTap: () => {
          profile.reset();
          this.scene.start('Home');
        },
      });
    }, { header: 0xe8404f });
  }

  openHelp() {
    const touch = isTouchDevice();
    const lines = [
      [
        'COMMANDES',
        touch
          ? 'Pouce gauche : se déplacer. Pouce droit : viser, puis relâcher pour tirer (un simple tap = tir automatique).'
          : 'ZQSD ou flèches : se déplacer. Souris : viser, clic pour tirer. Espace : super. F : fusion. Échap : pause.',
        '#ffffff',
      ],
      ['SUPER', 'Il se charge en touchant les ennemis. Tap sur le bouton = visée automatique, glisser = viser soi-même.', '#ffd24a'],
      [
        'FUSION',
        'Ton super ET celui d’un allié sont prêts, et vous êtes proches ? Le bouton FUSION s’allume : un combo qui dépend de vos deux éléments.',
        '#ff7bf0',
      ],
      [
        'CRISTAUX',
        'Ramasse-les au centre : chaque cristal porté donne +10 % de dégâts et charge ton super, mais te rend visible de tous. L’équipe qui porte les 3 pendant 15 s gagne.',
        '#7df9ff',
      ],
      ['BUISSONS', 'Tu y es invisible pour l’ennemi, sauf de très près ou juste après avoir tiré.', '#55c878'],
      ['ARÈNE VIVANTE', 'Toutes les 30 s : lave, brouillard, murs mobiles ou orage. Un bandeau prévient 3 s avant.', '#ff8a4d'],
    ];
    if (isIOS() && !isStandalone()) {
      lines.push(['PLEIN ÉCRAN', 'Dans Safari : bouton Partager, puis « Sur l’écran d’accueil ». Lance ensuite le jeu depuis son icône.', '#9fc6ff']);
    }
    this.openPopup('COMMENT JOUER', 716, 366, (x, y, w, h) => {
      let ly = y + 50;
      for (const [title, text, color] of lines) {
        addText(this, x + 20, ly, title, { size: 11.5, color });
        const t = addText(this, x + 130, ly, text, { size: 11.5, color: '#dfe6ff', bold: false, wrap: w - 152, lineSpacing: -1 });
        ly += Math.max(17, t.height) + 4;
      }
      button(this, this.buttons, { id: 'help-ok', x: x + w / 2 - 105, y: y + h - 52, w: 210, h: 36, label: 'C’EST PARTI', size: 16, color: 'yellow', onTap: () => this.closePopup() });
    }, {
      header: 0xa86a00,
      onClose: () => {
        if (!profile.data.helpSeen) {
          profile.data.helpSeen = true;
          profile.save();
        }
      },
    });
  }

  // ── Récompenses ────────────────────────────────────────────

  /**
   * Affiche le résultat de profile.grant() / claim…() : un coffre déclenche
   * son animation d'ouverture ; sinon des icônes s'envolent vers les compteurs.
   * @param {object} out   { reward, loot, levelUps }
   * @param {{x:number,y:number}} from  point de départ des icônes
   */
  showReward(out, from, then = null) {
    if (!out) return;
    // Aucun autre bouton tant que la récompense n'est pas arrivée (pas de double achat)
    this.buttons.enabled = false;
    const done = () => {
      this.buttons.enabled = true;
      this.refreshCurrencies();
      if (then) then();
    };
    if (out.loot) {
      // Ouverture de coffre, par-dessus l'écran courant
      this.scene.launch('Chest', {
        type: out.reward.chest,
        loot: out.loot,
        onDone: done,
      });
      this.scene.bringToTop('Chest');
      return;
    }
    const r = out.reward;
    sfx.play('reward');
    if (r.coins) flyAndCount(this, 'coin', from, this.coinPos);
    if (r.gems) flyAndCount(this, 'gem', from, this.gemPos);
    this.time.delayedCall(430, done);
  }
}

function flyAndCount(scene, frame, from, to) {
  for (let i = 0; i < 7; i++) {
    const img = icon(scene, frame, from.x + (Math.random() - 0.5) * 30, from.y + (Math.random() - 0.5) * 30, 22, 600);
    scene.tweens.add({
      targets: img,
      x: to.x,
      y: to.y,
      scale: img.scale * 0.6,
      delay: i * 45,
      duration: 400,
      ease: 'Cubic.easeIn',
      onComplete: () => img.destroy(),
    });
  }
}
