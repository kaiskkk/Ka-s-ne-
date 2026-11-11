// ─────────────────────────────────────────────────────────────
//  GameScene — fait tourner un match et l'affiche.
//
//  La logique vit dans src/sim (Match). Cette scène :
//   1. transmet les commandes du joueur à la simulation ;
//   2. avance la simulation par pas fixes de 1/60 s ;
//   3. dessine l'état (avec interpolation pour rester fluide) ;
//   4. transforme les événements de la simulation en effets et en sons.
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { sfx } from '../audio/Sfx.js';
import { COMBAT, FUSION, SIM_DT, VIEW } from '../config/constants.js';
import { ELEMENTS, TEAM_COLORS } from '../config/elements.js';
import { ArenaView, DEPTH } from '../render/ArenaView.js';
import { Effects } from '../render/Effects.js';
import { CrystalLayer, ProjectileLayer, StrikeLayer, ZoneLayer, visualOf } from '../render/EntityViews.js';
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
    });
    this.player = this.match.player;
    this.acc = 0;
    this.alpha = 1;
    this.paused = false;
    this.ended = false;
    this.numbers = new Map();
    this.fogA = 0; // opacité actuelle des voiles (brouillard, aveuglement)
    this.blindA = 0;

    this.applyZoom();
    const { match, player } = this;
    this.arenaView = new ArenaView(this, match.arena);
    this.crystalLayer = new CrystalLayer(this, match.crystals);
    this.zoneLayer = new ZoneLayer(this, player.team);
    this.strikeLayer = new StrikeLayer(this, player.team);
    this.projectileLayer = new ProjectileLayer(this);
    this.fighterViews = match.fighters.map((f) => new FighterView(this, f, f === player, player.team));
    this.effects = new Effects(this);
    this.aimG = this.add.graphics().setDepth(DEPTH.aim);
    this.linkG = this.add.graphics().setDepth(DEPTH.aim);

    // Voiles : brouillard (événement d'arène) et aveuglement (nuage de vapeur)
    this.fog = this.add.image(0, 0, 'fogHole').setDepth(DEPTH.fog).setTint(0xaab8d0).setAlpha(0).setVisible(false);
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
  }

  shutdown() {
    this.scale.off('resize', this.applyZoom, this);
    document.removeEventListener('visibilitychange', this.onVisibility);
    releaseWakeLock();
    controls.reset();
  }

  /** Zoom de la caméra : on voit toujours ~11 cases de haut, quel que soit l'écran. */
  applyZoom() {
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.height / VIEW.height, this.scale.width / VIEW.minWidth);
    cam.setZoom(zoom);
    this.textRes = textResFor(zoom);
  }

  setPaused(paused) {
    if (this.ended) return;
    this.paused = paused;
    this.events.emit('paused', paused);
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
      this.acc += dt;
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
    this.arenaView.update(time, alpha);
    this.crystalLayer.update(time, match.time);
    this.zoneLayer.sync(match.zones, alpha, time);
    this.strikeLayer.sync(match.strikes);
    this.projectileLayer.sync(match.projectiles, alpha);
    for (const v of this.fighterViews) v.update(alpha, time, dt, match.canSee(player, v.f));
    this.effects.update(dt);
    this.flushNumbers(dt);
    this.drawAim(alpha);
    this.drawLinks(time, alpha);
    this.updateCamera(dt, alpha);
    this.updateVeils(dt, alpha);
  }

  updateCamera(dt, alpha) {
    const cam = this.cameras.main;
    const p = this.player;
    const { arena } = this.match;
    const tx = lerp(p.px, p.x, alpha);
    const ty = lerp(p.py, p.y, alpha);
    const k = Math.min(1, dt * 9);
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
        g.fillStyle(color, 0.2);
        g.slice(x, y, atk.range, a.angle - atk.spread / 2 - 0.06, a.angle + atk.spread / 2 + 0.06);
        g.fillPath();
      } else {
        const d = cut(atk.range);
        g.lineStyle(atk.projRadius * 2 + 8, color, 0.2);
        g.lineBetween(x + ux * p.r, y + uy * p.r, x + ux * d, y + uy * d);
      }
      return;
    }

    const s = p.def.super;
    const color = COLORS.super;
    if (s.kind === 'bomb') {
      const d = cut(s.range);
      g.lineStyle(s.projRadius * 2, color, 0.22);
      g.lineBetween(x + ux * p.r, y + uy * p.r, x + ux * d, y + uy * d);
      g.fillStyle(color, 0.18);
      g.fillCircle(x + ux * d, y + uy * d, s.radius);
      g.lineStyle(3, color, 0.6);
      g.strokeCircle(x + ux * d, y + uy * d, s.radius);
    } else if (s.kind === 'healZone') {
      const d = s.range * a.power;
      g.fillStyle(0x4dffb8, 0.2);
      g.fillCircle(x + ux * d, y + uy * d, s.radius);
      g.lineStyle(3, 0x4dffb8, 0.7);
      g.strokeCircle(x + ux * d, y + uy * d, s.radius);
      g.lineStyle(3, 0x4dffb8, 0.35);
      g.lineBetween(x, y, x + ux * d, y + uy * d);
    } else if (s.kind === 'dash') {
      const d = cut(s.dist);
      g.lineStyle(p.r * 2, color, 0.22);
      g.lineBetween(x, y, x + ux * d, y + uy * d);
    } else if (s.kind === 'beam') {
      const d = cut(s.range);
      g.lineStyle(s.width, color, 0.25);
      g.lineBetween(x + ux * p.r, y + uy * p.r, x + ux * d, y + uy * d);
    } else if (s.kind === 'gust') {
      g.fillStyle(color, 0.2);
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
    const y = lerp(p.py, p.y, alpha);
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.012);
    for (const o of this.match.fighters) {
      if (o === p || o.team !== p.team || !o.alive || !o.superReady) continue;
      const ox = lerp(o.px, o.x, alpha);
      const oy = lerp(o.py, o.y, alpha);
      const inRange = Math.hypot(ox - x, oy - y) <= FUSION.range;
      if (inRange) {
        g.lineStyle(10, COLORS.fusion, 0.25 + 0.2 * pulse);
        g.lineBetween(x, y, ox, oy);
        g.lineStyle(4, 0xffffff, 0.7 + 0.3 * pulse);
        g.lineBetween(x, y, ox, oy);
      } else {
        // Trop loin : un trait discret indique vers qui se rapprocher
        g.lineStyle(2, COLORS.super, 0.3);
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
    return clamp(1.15 - d / 1000, 0, 1);
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
      if (n.heal) this.effects.number(f.x, f.y - f.r - 40, `+${value}`, 0x6dff9a, 16);
      else {
        const color = f === this.player ? 0xff6b6b : friendly ? 0xffb37a : 0xffffff;
        this.effects.number(f.x, f.y - f.r - 40, String(value), color, value >= 800 ? 24 : 18);
      }
    }
  }

  handleFx(e) {
    const { match, player, effects } = this;
    const cam = this.cameras.main;
    switch (e.type) {
      case 'shoot': {
        const f = match.fighters[e.id];
        effects.burst(e.x + Math.cos(e.angle) * (f.r + 6), e.y + Math.sin(e.angle) * (f.r + 6), visualOf(e.visual).glow, 4);
        sfx.play(`shoot-${f.element}`, this.volumeAt(e.x, e.y) * (f === player ? 1 : 0.6));
        break;
      }
      case 'impact':
        effects.burst(e.x, e.y, visualOf(e.visual).color, e.wall ? 4 : 8);
        break;
      case 'hit': {
        this.addNumber(e.id, e.amount, false);
        if (e.id === player.id) {
          sfx.play('hurt');
          if (e.amount >= 300) cam.shake(100, 0.004);
        } else if (e.by === player.id) {
          sfx.play('hit');
        }
        break;
      }
      case 'heal':
        this.addNumber(e.id, e.amount, true);
        break;
      case 'explosion': {
        const vis = visualOf(e.visual);
        effects.ring(e.x, e.y, e.r, vis.color, 480, 9, 0.28);
        effects.burst(e.x, e.y, vis.glow, 20);
        const vol = this.volumeAt(e.x, e.y);
        sfx.play(e.visual === 'foudre' ? 'thunder' : 'explosion', vol);
        if (vol > 0.5) cam.shake(140, 0.005 * vol);
        break;
      }
      case 'beam':
        effects.beam(e.x0, e.y0, e.x1, e.y1, e.width, 0xffe84d);
        effects.burst(e.x1, e.y1, 0xffffff, 12);
        sfx.play('thunder', this.volumeAt(e.x0, e.y0));
        break;
      case 'chain':
        effects.zap(e.x0, e.y0, e.x1, e.y1, 0xffe84d);
        break;
      case 'gust':
        effects.cone(e.x, e.y, e.angle, e.range, e.halfAngle, 0xc4f7e8);
        sfx.play('shoot-vent', this.volumeAt(e.x, e.y));
        break;
      case 'ring':
        effects.ring(e.x, e.y, e.r, visualOf(e.visual).color, 350, 6);
        break;
      case 'super':
        effects.ring(e.x, e.y, 70, COLORS.super, 320, 6);
        sfx.play('super', this.volumeAt(e.x, e.y));
        break;
      case 'fusion': {
        for (const id of [e.a, e.b]) {
          const f = match.fighters[id];
          effects.ring(f.x, f.y, 110, ELEMENTS[f.element].color, 600, 10, 0.2);
          effects.burst(f.x, f.y, ELEMENTS[f.element].light, 24);
        }
        effects.ring(e.x, e.y, 260, COLORS.fusion, 800, 14, 0.15);
        cam.shake(280, 0.008);
        sfx.play('fusion', Math.max(0.5, this.volumeAt(e.x, e.y)));
        break;
      }
      case 'death': {
        const f = match.fighters[e.id];
        effects.burst(e.x, e.y, ELEMENTS[f.element].color, 28);
        effects.ring(e.x, e.y, 80, TEAM_COLORS[f.team].main, 500, 8, 0.25);
        sfx.play('death', f === player ? 1 : this.volumeAt(e.x, e.y) * 0.8);
        if (f === player) cam.shake(250, 0.01);
        break;
      }
      case 'respawn': {
        const f = match.fighters[e.id];
        effects.ring(e.x, e.y, 80, TEAM_COLORS[f.team].light, 500, 6);
        if (f === player) sfx.play('respawn');
        break;
      }
      case 'pickup':
        effects.burst(e.x, e.y, COLORS.crystal, 18);
        effects.ring(e.x, e.y, 60, COLORS.crystal, 400, 6);
        sfx.play('pickup', e.id === player.id ? 1 : this.volumeAt(e.x, e.y) * 0.7);
        break;
      case 'drop':
        effects.burst(e.x, e.y, COLORS.crystal, 10);
        sfx.play('drop', this.volumeAt(e.x, e.y) * 0.7);
        break;
      case 'crystalSpawn':
        effects.ring(e.x, e.y, 120, COLORS.crystal, 800, 10, 0.2);
        effects.burst(e.x, e.y, 0xffffff, 24);
        sfx.play('pickup', 0.6);
        break;
      case 'stun':
        effects.burst(e.x, e.y, e.frozen ? 0xa8e8ff : 0xffe14d, 10);
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
    this.time.delayedCall(500, () => sfx.play(outcome === 'lose' ? 'lose' : 'win'));
    this.time.delayedCall(2000, () => {
      this.scene.stop('Hud');
      this.scene.start('Result', {
        outcome,
        result,
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
