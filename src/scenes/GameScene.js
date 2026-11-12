// ─────────────────────────────────────────────────────────────
//  GameScene — fait tourner un match et l'affiche.
//
//  La logique vit dans src/sim (Match). Cette scène :
//   1. transmet les commandes du joueur à la simulation ;
//   2. avance la simulation par pas fixes de 1/60 s ;
//   3. dessine l'état (avec interpolation pour rester fluide) ;
//   4. transforme les événements de la simulation en effets et en sons
//      (particules, tremblements d'écran, ralenti de fusion…).
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { music } from '../audio/Music.js';
import { sfx } from '../audio/Sfx.js';
import { COMBAT, FUSION, SIM_DT, VIEW } from '../config/constants.js';
import { ELEMENTS, TEAM_COLORS } from '../config/elements.js';
import { profile } from '../meta/profile.js';
import { ArenaView, DEPTH } from '../render/ArenaView.js';
import { Effects } from '../render/Effects.js';
import { CrystalLayer, ProjectileLayer, StrikeLayer, ZoneLayer, visualColor } from '../render/EntityViews.js';
import { FighterView } from '../render/FighterView.js';
import { DEFAULT_DIFFICULTY } from '../sim/BotAI.js';
import { Match } from '../sim/Match.js';
import { clamp, lerp } from '../sim/mathx.js';
import { controls } from '../ui/controls.js';
import { COLORS, textResFor } from '../ui/theme.js';
import { isTouchDevice, releaseWakeLock, requestWakeLock, viewport } from '../ui/viewport.js';

/**
 * Nombre maximal de pas de simulation rattrapés en une image : le jeu reste
 * en temps réel jusqu'à ~7 images/s, en dessous il ralentit au lieu de s'emballer.
 */
const MAX_STEPS = 8;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.cfg = {
      charId: data.charId || 'braz',
      difficulty: data.difficulty || DEFAULT_DIFFICULTY,
      seed: data.seed ?? Math.floor(Math.random() * 0x7fffffff),
    };
  }

  create() {
    controls.reset();
    this.match = new Match({
      playerChar: this.cfg.charId,
      difficulty: this.cfg.difficulty,
      seed: this.cfg.seed,
      // Le niveau du personnage (amélioré dans le menu) renforce PV et dégâts
      playerPower: profile.power(this.cfg.charId),
    });
    this.player = this.match.player;
    this.acc = 0;
    this.alpha = 1;
    this.paused = false;
    this.ended = false;
    this.numbers = new Map();
    this.fogA = 0; // opacité actuelle des voiles (brouillard, aveuglement)
    this.blindA = 0;
    this.timeScale = 1; // < 1 pendant le ralenti d'une fusion
    this.slowT = 0;
    this.hitStop = 0; // micro-arrêt sur image lors d'un gros coup
    this.zoomPunch = 0;
    this.lookX = 0; // décalage de la caméra vers l'avant
    this.lookY = 0;
    this.stepT = 0;

    this.applyZoom();
    const { match, player } = this;
    this.arenaView = new ArenaView(this, match.arena);
    this.effects = new Effects(this);
    this.crystalLayer = new CrystalLayer(this, match.crystals, this.effects);
    this.zoneLayer = new ZoneLayer(this, player.team, this.effects);
    this.strikeLayer = new StrikeLayer(this, player.team);
    this.projectileLayer = new ProjectileLayer(this, this.effects);
    this.fighterViews = match.fighters.map((f) => new FighterView(this, f, f === player, player.team));
    this.aimG = this.add.graphics().setDepth(DEPTH.aim);
    this.linkG = this.add.graphics().setDepth(DEPTH.aim);

    // Voiles : brouillard (événement d'arène) et aveuglement (nuage de vapeur)
    this.fog = this.add.image(0, 0, 'fogHole').setDepth(DEPTH.fog).setTint(0xc4d2e2).setAlpha(0).setVisible(false);
    this.blind = this.add
      .image(0, 0, 'blindHole')
      .setDepth(DEPTH.fog + 1)
      .setTint(0xeef3f8)
      .setAlpha(0)
      .setVisible(false);

    this.camX = player.x;
    this.camY = player.y;
    this.updateCamera(1, 1);

    this.scale.on('resize', this.applyZoom, this);
    this.onVisibility = () => {
      if (document.hidden) this.setPaused(true);
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once('shutdown', this.shutdown, this);

    this.scene.launch('Hud');
    requestWakeLock();
    music.play('battle');
  }

  shutdown() {
    this.scale.off('resize', this.applyZoom, this);
    document.removeEventListener('visibilitychange', this.onVisibility);
    releaseWakeLock();
    controls.reset();
  }

  /** Zoom de la caméra : on voit toujours ~8,5 cases de haut, quel que soit l'écran. */
  applyZoom() {
    this.baseZoom = Math.min(this.scale.height / VIEW.height, this.scale.width / VIEW.minWidth);
    this.cameras.main.setZoom(this.baseZoom * (1 + (this.zoomPunch || 0)));
    this.textRes = textResFor(this.baseZoom);
  }

  setPaused(paused) {
    if (this.ended) return;
    this.paused = paused;
    music.setPaused(paused);
    this.events.emit('paused', paused);
  }

  /** Tremblement d'écran. `strong` remplace un tremblement déjà en cours. */
  shake(intensity, duration = 120, strong = false) {
    this.cameras.main.shake(duration, intensity, strong);
  }

  // ── Boucle ─────────────────────────────────────────────────

  update(time) {
    // Temps RÉEL écoulé depuis l'image précédente (le delta lissé de Phaser
    // sous-estime le temps quand les images sont irrégulières).
    const dt = Math.min(this.game.loop.rawDelta / 1000, MAX_STEPS * SIM_DT);

    // En portrait sur mobile, le jeu est masqué par le message « tourne ton téléphone »
    if (!this.paused && isTouchDevice() && viewport.height > viewport.width) this.setPaused(true);

    // Lecture des commandes (joysticks, clavier) juste avant la simulation
    const hud = this.scene.get('Hud');
    if (hud && hud.scene.isActive() && hud.computeControls) hud.computeControls();

    if (!this.paused && !this.ended) {
      // Ralenti (fusion) puis retour progressif à la vitesse normale
      if (this.slowT > 0) {
        this.slowT -= dt;
        this.timeScale = 0.22;
      } else {
        this.timeScale = Math.min(1, this.timeScale + dt * 4);
      }
      if (this.hitStop > 0) this.hitStop -= dt;
      else this.acc += dt * this.timeScale;

      let steps = 0;
      while (this.acc >= SIM_DT && steps < MAX_STEPS) {
        this.feedInput();
        this.match.step(SIM_DT);
        this.consumeFx();
        this.acc -= SIM_DT;
        steps += 1;
      }
      if (steps >= MAX_STEPS) this.acc = 0; // trop de retard (onglet figé…) : on repart de zéro
      this.alpha = this.acc / SIM_DT;
    }
    this.render(time, dt, this.alpha);
  }

  /** Commandes du joueur → simulation. */
  feedInput() {
    const p = this.player;
    p.input.mx = controls.moveX;
    p.input.my = controls.moveY;
    p.input.aimAngle = controls.aiming && controls.aiming.active ? controls.aiming.angle : null;
    while (controls.actions.length > 0) this.match.queueAction(p.id, controls.actions.shift());
  }

  // ── Affichage ──────────────────────────────────────────────

  render(time, dt, alpha) {
    const { match, player } = this;
    const live = this.paused ? 0 : dt; // les animations se figent en pause
    const visible = [];
    for (const v of this.fighterViews) {
      const seen = match.canSee(player, v.f);
      v.update(alpha, time, live, seen);
      if (seen && v.f.alive) visible.push({ f: v.f, friendly: v.friendly });
    }
    this.arenaView.update(time, alpha, live, visible);
    this.crystalLayer.update(time, match.time, live);
    this.zoneLayer.sync(match.zones, alpha, time, live);
    this.strikeLayer.sync(match.strikes);
    this.projectileLayer.sync(match.projectiles, alpha, live);
    this.footsteps(live, visible);
    this.effects.update(live);
    this.flushNumbers(live);
    this.drawAim(alpha);
    this.drawLinks(time, alpha);
    this.updateCamera(dt, alpha);
    this.updateVeils(dt, alpha);
  }

  /** Petits nuages de poussière sous les pieds, feuilles qui volent dans les buissons. */
  footsteps(dt, visible) {
    this.stepT -= dt;
    if (this.stepT > 0) return;
    this.stepT = 0.16;
    for (const { f } of visible) {
      const speed = Math.hypot(f.vx, f.vy);
      if (speed < f.def.speed * 0.5) continue;
      if (f.inBush) {
        if (Math.random() < 0.6) this.effects.burst('leaf', f.x, f.y + 6, 1);
      } else if (Math.random() < 0.7) {
        this.effects.burst('dust', f.x - (f.vx / speed) * 10, f.y + 24, 1);
      }
    }
  }

  updateCamera(dt, alpha) {
    const cam = this.cameras.main;
    const p = this.player;
    const { arena } = this.match;

    // Coup de zoom (fusion) qui retombe en douceur
    if (this.zoomPunch > 0.0005) {
      this.zoomPunch = lerp(this.zoomPunch, 0, Math.min(1, dt * 4));
      cam.setZoom(this.baseZoom * (1 + this.zoomPunch));
    }

    // La caméra regarde un peu en avant : vers où l'on court, et vers où l'on vise
    let lx = 0;
    let ly = 0;
    if (p.alive) {
      lx = clamp(p.vx * 0.2, -70, 70);
      ly = clamp(p.vy * 0.2, -50, 50);
      const a = controls.aiming;
      if (a && a.active) {
        lx += Math.cos(a.angle) * 70;
        ly += Math.sin(a.angle) * 50;
      }
    }
    const kLook = 1 - Math.exp(-dt * 3.5);
    this.lookX += (lx - this.lookX) * kLook;
    this.lookY += (ly - this.lookY) * kLook;

    // Suivi en douceur du personnage
    const tx = lerp(p.px, p.x, alpha) + this.lookX;
    const ty = lerp(p.py, p.y, alpha) + this.lookY;
    const k = 1 - Math.exp(-dt * 7);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;

    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    // Marges de sécurité (encoche, barre d'accueil) converties en pixels monde :
    // le bord de l'arène peut s'arrêter au bord de la zone sûre plutôt que sous l'encoche.
    const s = viewport.dpr / cam.zoom;
    const padL = viewport.safe.left * s;
    const padR = viewport.safe.right * s;
    const padT = viewport.safe.top * s;
    const padB = viewport.safe.bottom * s;
    const cx =
      viewW - padL - padR >= arena.width
        ? arena.width / 2 + (padR - padL) / 2
        : clamp(this.camX, viewW / 2 - padL, arena.width - viewW / 2 + padR);
    const cy =
      viewH - padT - padB >= arena.height
        ? arena.height / 2 + (padB - padT) / 2
        : clamp(this.camY, viewH / 2 - padT, arena.height - viewH / 2 + padB);
    cam.centerOn(cx, cy);
  }

  /** Brouillard et aveuglement : un voile percé d'un trou centré sur le joueur. */
  updateVeils(dt, alpha) {
    const p = this.player;
    const x = lerp(p.px, p.x, alpha);
    const y = lerp(p.py, p.y, alpha);
    const fogTarget = this.match.arena.fog ? 0.93 : 0;
    const blindTarget = p.alive && p.blindT > 0 ? 0.96 : 0;
    this.fogA = lerp(this.fogA, fogTarget, Math.min(1, dt * 2.5));
    this.blindA = lerp(this.blindA, blindTarget, Math.min(1, dt * 7));
    // Le trou de la texture fait 1/8 (brouillard) ou 1/24 (aveuglement) de sa demi-largeur
    this.fog
      .setVisible(this.fogA > 0.01)
      .setAlpha(this.fogA)
      .setPosition(x, y)
      .setDisplaySize(COMBAT.fogVision * 16, COMBAT.fogVision * 16);
    this.blind
      .setVisible(this.blindA > 0.01)
      .setAlpha(this.blindA)
      .setPosition(x, y)
      .setDisplaySize(COMBAT.blindVision * 48, COMBAT.blindVision * 48);
  }

  /** Aperçu de visée pendant que le joueur maintient le joystick droit ou le bouton Super. */
  drawAim(alpha) {
    const g = this.aimG;
    g.clear();
    const a = controls.aiming;
    const p = this.player;
    if (!a || !a.active || !p.alive || this.match.phase !== 'playing') return;
    const x = lerp(p.px, p.x, alpha);
    const y = lerp(p.py, p.y, alpha);
    const ux = Math.cos(a.angle);
    const uy = Math.sin(a.angle);
    const { arena } = this.match;
    const cut = (range) => range * arena.raycast(x, y, x + ux * range, y + uy * range);

    if (a.kind === 'attack') {
      const atk = p.def.attack;
      const color = p.ammo >= 1 ? 0xffffff : 0xff6b6b;
      if (atk.kind === 'spread') {
        g.fillStyle(color, 0.24);
        g.slice(x, y, atk.range, a.angle - atk.spread / 2 - 0.06, a.angle + atk.spread / 2 + 0.06);
        g.fillPath();
      } else {
        const d = cut(atk.range);
        g.lineStyle(atk.projRadius * 2 + 8, color, 0.24);
        g.lineBetween(x + ux * p.r, y + uy * p.r, x + ux * d, y + uy * d);
      }
      return;
    }

    const s = p.def.super;
    const color = COLORS.super;
    if (s.kind === 'bomb') {
      const d = cut(s.range);
      g.lineStyle(s.projRadius * 2, color, 0.26);
      g.lineBetween(x + ux * p.r, y + uy * p.r, x + ux * d, y + uy * d);
      g.fillStyle(color, 0.2);
      g.fillCircle(x + ux * d, y + uy * d, s.radius);
      g.lineStyle(3, color, 0.7);
      g.strokeCircle(x + ux * d, y + uy * d, s.radius);
    } else if (s.kind === 'healZone') {
      const d = s.range * a.power;
      g.fillStyle(0x4dffb8, 0.22);
      g.fillCircle(x + ux * d, y + uy * d, s.radius);
      g.lineStyle(3, 0x4dffb8, 0.8);
      g.strokeCircle(x + ux * d, y + uy * d, s.radius);
      g.lineStyle(3, 0x4dffb8, 0.4);
      g.lineBetween(x, y, x + ux * d, y + uy * d);
    } else if (s.kind === 'dash') {
      const d = cut(s.dist);
      g.lineStyle(p.r * 2, color, 0.26);
      g.lineBetween(x, y, x + ux * d, y + uy * d);
    } else if (s.kind === 'beam') {
      const d = cut(s.range);
      g.lineStyle(s.width, color, 0.28);
      g.lineBetween(x + ux * p.r, y + uy * p.r, x + ux * d, y + uy * d);
    } else if (s.kind === 'gust') {
      g.fillStyle(color, 0.22);
      g.slice(x, y, s.range, a.angle - s.halfAngle, a.angle + s.halfAngle);
      g.fillPath();
    }
  }

  /** Lien lumineux entre le joueur et les alliés avec qui une fusion est possible. */
  drawLinks(time, alpha) {
    const g = this.linkG;
    g.clear();
    const p = this.player;
    if (!p.alive || !p.superReady || this.match.phase !== 'playing') return;
    const x = lerp(p.px, p.x, alpha);
    const y = lerp(p.py, p.y, alpha) + 14;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.012);
    for (const o of this.match.fighters) {
      if (o === p || o.team !== p.team || !o.alive || !o.superReady) continue;
      const ox = lerp(o.px, o.x, alpha);
      const oy = lerp(o.py, o.y, alpha) + 14;
      const inRange = Math.hypot(ox - x, oy - y) <= FUSION.range;
      if (inRange) {
        g.lineStyle(12, COLORS.fusion, 0.28 + 0.22 * pulse);
        g.lineBetween(x, y, ox, oy);
        g.lineStyle(4, 0xffffff, 0.75 + 0.25 * pulse);
        g.lineBetween(x, y, ox, oy);
      } else {
        // Trop loin : un trait discret indique vers qui se rapprocher
        g.lineStyle(2.5, COLORS.super, 0.35);
        g.lineBetween(x, y, ox, oy);
      }
    }
  }

  // ── Événements de la simulation → effets visuels et sons ──

  consumeFx() {
    const fx = this.match.fx;
    for (let i = 0; i < fx.length; i++) this.handleFx(fx[i]);
    fx.length = 0;
  }

  /** Volume d'un son selon sa distance au joueur. */
  volumeAt(x, y) {
    const d = Math.hypot(x - this.player.x, y - this.player.y);
    return clamp(1.15 - d / 900, 0, 1);
  }

  /** Accumule dégâts / soins pour n'afficher qu'un chiffre par cible toutes les ~0,15 s. */
  addNumber(id, amount, heal) {
    const key = id * 2 + (heal ? 1 : 0);
    const n = this.numbers.get(key);
    if (n) n.amount += amount;
    else this.numbers.set(key, { id, amount, heal, t: 0 });
  }

  flushNumbers(dt) {
    for (const [key, n] of this.numbers) {
      n.t += dt;
      if (n.t < (n.heal ? 0.4 : 0.15)) continue;
      this.numbers.delete(key);
      const f = this.match.fighters[n.id];
      const friendly = f.team === this.player.team;
      if (!friendly && !this.match.canSee(this.player, f) && f.alive) continue;
      const value = Math.round(n.amount);
      if (value <= 0) continue;
      const y = f.y - 78;
      if (n.heal) this.effects.number(f.x, y, `+${value}`, 0x6dff9a, 18);
      else {
        const color = f === this.player ? 0xff6b6b : friendly ? 0xffb37a : value >= 800 ? 0xffe14d : 0xffffff;
        this.effects.number(f.x, y, String(value), color, value >= 800 ? 30 : value >= 400 ? 24 : 20);
      }
    }
  }

  handleFx(e) {
    const { match, player, effects } = this;
    switch (e.type) {
      case 'shoot': {
        const view = this.fighterViews[e.id];
        const f = view.f;
        view.rig.attack();
        const m = view.rig.muzzle(e.angle);
        effects.element(e.visual, m.x, m.y, 4);
        effects.flash(m.x, m.y, 20, visualColor(e.visual), 110);
        sfx.play(`shoot-${f.element}`, this.volumeAt(e.x, e.y) * (f === player ? 1 : 0.55));
        if (f === player) this.shake(0.0016, 60);
        break;
      }
      case 'impact':
        effects.element(e.visual, e.x, e.y, e.wall ? 5 : 9);
        if (!e.wall) effects.ring(e.x, e.y, 28, visualColor(e.visual), 220, 4);
        sfx.play(e.wall ? 'thud' : 'impact', this.volumeAt(e.x, e.y) * 0.6);
        break;
      case 'hit': {
        this.addNumber(e.id, e.amount, false);
        if (e.id === player.id) {
          // Le joueur encaisse : tremblement proportionnel au coup
          sfx.play('hurt');
          this.shake(clamp(0.0025 + e.amount / 150000, 0.003, 0.011), 130, e.amount >= 500);
          this.events.emit('playerHurt', e.amount);
        } else if (e.by === player.id) {
          // Le joueur touche : léger tremblement, micro-arrêt sur les gros coups
          sfx.play('hit');
          this.shake(e.amount >= 500 ? 0.004 : 0.002, 70);
          if (e.amount >= 700) this.hitStop = Math.max(this.hitStop, 0.045);
        }
        break;
      }
      case 'heal':
        this.addNumber(e.id, e.amount, true);
        break;
      case 'explosion': {
        const color = visualColor(e.visual);
        effects.flash(e.x, e.y, e.r * 0.9, 0xffffff, 180);
        effects.ring(e.x, e.y, e.r, color, 500, 10, 0.3);
        effects.ring(e.x, e.y, e.r * 0.7, 0xffffff, 300, 5);
        effects.element(e.visual, e.x, e.y, 24);
        effects.burst('smoke', e.x, e.y, 7);
        effects.scorch(e.x, e.y, e.r);
        const vol = this.volumeAt(e.x, e.y);
        sfx.play(e.visual === 'foudre' ? 'thunder' : 'explosion', vol);
        if (vol > 0.35) this.shake(0.008 * vol, 180, vol > 0.7);
        break;
      }
      case 'beam':
        effects.beam(e.x0, e.y0, e.x1, e.y1, e.width, 0xffe84d);
        effects.flash(e.x1, e.y1, 60, 0xfff27a, 220);
        for (let i = 0; i <= 6; i++) {
          effects.burst('spark', lerp(e.x0, e.x1, i / 6), lerp(e.y0, e.y1, i / 6), 4);
        }
        sfx.play('thunder', this.volumeAt(e.x0, e.y0));
        this.shake(0.006, 160, true);
        break;
      case 'chain':
        effects.zap(e.x0, e.y0, e.x1, e.y1, 0xffe84d);
        effects.burst('spark', e.x1, e.y1, 8);
        break;
      case 'gust':
        effects.cone(e.x, e.y, e.angle, e.range, e.halfAngle, 0xc4f7e8);
        sfx.play('gust', this.volumeAt(e.x, e.y));
        break;
      case 'ring':
        effects.ring(e.x, e.y, e.r, visualColor(e.visual), 350, 6);
        break;
      case 'super': {
        const view = this.fighterViews[e.id];
        view.rig.superPose();
        const el = view.f.element;
        effects.ring(e.x, e.y, 80, COLORS.super, 340, 7);
        effects.flash(e.x, e.y, 60, ELEMENTS[el].color, 240);
        effects.element(el, e.x, e.y, 16);
        sfx.play('super', this.volumeAt(e.x, e.y));
        if (view.f === player) this.shake(0.005, 140, true);
        break;
      }
      case 'fusion': {
        // GRANDE ANIMATION : ralenti, coup de zoom, flux d'énergie, explosion
        const a = match.fighters[e.a];
        const b = match.fighters[e.b];
        this.fighterViews[e.a].rig.superPose();
        this.fighterViews[e.b].rig.superPose();
        effects.fusion(a.x, a.y, b.x, b.y, e.x, e.y, ELEMENTS[a.element].color, ELEMENTS[b.element].color);
        this.slowT = 0.5;
        this.zoomPunch = 0.14;
        this.cameras.main.setZoom(this.baseZoom * 1.14);
        this.shake(0.004, 300, true);
        this.time.delayedCall(330, () => this.shake(0.014, 360, true));
        sfx.play('fusion', Math.max(0.6, this.volumeAt(e.x, e.y)));
        break;
      }
      case 'death': {
        const f = match.fighters[e.id];
        effects.element(f.element, e.x, e.y, 26);
        effects.burst('smoke', e.x, e.y, 8);
        effects.burst('star', e.x, e.y - 20, 6);
        effects.ring(e.x, e.y, 90, TEAM_COLORS[f.team].main, 520, 9, 0.25);
        effects.flash(e.x, e.y, 80, 0xffffff, 200);
        sfx.play('death', f === player ? 1 : this.volumeAt(e.x, e.y) * 0.8);
        if (f === player) this.shake(0.014, 320, true);
        else if (e.by === player.id) {
          this.hitStop = Math.max(this.hitStop, 0.09);
          this.shake(0.007, 200, true);
        }
        break;
      }
      case 'respawn': {
        const f = match.fighters[e.id];
        effects.ring(e.x, e.y, 80, TEAM_COLORS[f.team].light, 500, 7);
        effects.burst('glow', e.x, e.y, 14, TEAM_COLORS[f.team].light);
        if (f === player) sfx.play('respawn');
        break;
      }
      case 'pickup':
        effects.burst('shard', e.x, e.y, 16);
        effects.ring(e.x, e.y, 64, COLORS.crystal, 420, 7);
        effects.flash(e.x, e.y, 50, COLORS.crystal, 220);
        sfx.play('pickup', e.id === player.id ? 1 : this.volumeAt(e.x, e.y) * 0.7);
        break;
      case 'drop':
        effects.burst('shard', e.x, e.y, 10);
        sfx.play('drop', this.volumeAt(e.x, e.y) * 0.7);
        break;
      case 'crystalSpawn':
        effects.ring(e.x, e.y, 130, COLORS.crystal, 800, 10, 0.2);
        effects.flash(e.x, e.y, 110, COLORS.crystal, 420);
        effects.burst('shard', e.x, e.y, 26);
        sfx.play('pickup', 0.6);
        break;
      case 'stun':
        effects.burst(e.frozen ? 'snow' : 'star', e.x, e.y - 20, e.frozen ? 12 : 6);
        break;
      case 'arenaEvent':
        if (e.phase === 'warning') sfx.play('alarm');
        break;
      case 'countdown':
        sfx.play('beep');
        break;
      case 'go':
        sfx.play('go');
        break;
      case 'holdStart':
        music.setUrgent(true);
        break;
      case 'holdBreak':
        music.setUrgent(false);
        break;
      case 'noAmmo':
        sfx.play('empty');
        break;
      case 'end':
        this.onMatchEnd();
        break;
      default:
        break;
    }
    // L'interface (HudScene) écoute aussi ces événements
    this.events.emit('fx', e);
  }

  onMatchEnd() {
    if (this.ended) return;
    this.ended = true;
    controls.reset();
    const { match, player } = this;
    const result = match.result;
    const outcome = result.winner < 0 ? 'draw' : result.winner === player.team ? 'win' : 'lose';
    // Les récompenses sont enregistrées tout de suite (rien n'est perdu si on ferme le jeu maintenant)
    const rewards = profile.applyMatchResult({
      outcome,
      charId: this.cfg.charId,
      difficulty: this.cfg.difficulty,
      kills: player.kills,
    });
    music.stop();
    this.time.delayedCall(450, () => sfx.play(outcome === 'lose' ? 'lose' : 'win'));
    this.time.delayedCall(2000, () => {
      this.scene.stop('Hud');
      this.scene.start('Result', {
        outcome,
        result,
        rewards,
        charId: this.cfg.charId,
        difficulty: this.cfg.difficulty,
        fighters: match.fighters.map((f) => ({
          id: f.id,
          team: f.team,
          charId: f.charId,
          isPlayer: f.isPlayer,
          kills: f.kills,
          deaths: f.deaths,
          damage: Math.round(f.damageDealt),
          healing: Math.round(f.healingDone),
          crystals: f.crystalsPicked,
        })),
      });
    });
  }
}
