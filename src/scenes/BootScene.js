// ─────────────────────────────────────────────────────────────
//  BootScene — prépare tous les visuels du jeu, DESSINÉS PAR LE CODE
//  (personnages, décor, effets : aucun fichier image), puis ouvre le menu.
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { buildCharacterAtlases } from '../art/characterArt.js';
import { buildFxAtlas } from '../art/fxArt.js';
import { buildBushTextures, buildGroundTexture, buildMoverTextures } from '../art/mapArt.js';
import { DEFAULT_MAP, MAPS } from '../config/maps.js';
import { Arena } from '../sim/Arena.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeDot('dot', 64, [
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(255,255,255,0.55)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    // Voiles percés d'un trou : brouillard (grand rayon de vision) et aveuglement (petit)
    this.makeHole('fogHole', 1024, 1 / 8);
    this.makeHole('blindHole', 1024, 1 / 24);

    this.makeVignette();

    buildFxAtlas(this);
    buildCharacterAtlases(this);

    // Décor de l'arène : peint une fois pour toutes
    const arena = new Arena(MAPS[DEFAULT_MAP]);
    buildGroundTexture(this, arena);
    buildMoverTextures(this, arena);
    this.registry.set('bushes', buildBushTextures(this, arena));

    const data = this.registry.get('autostart');
    if (data) this.scene.start('Game', data);
    else this.scene.start('Menu');
  }

  /** Bords d'écran colorés, centre transparent (flash quand le joueur est touché). */
  makeVignette() {
    if (this.textures.exists('vignette')) return;
    const w = 512;
    const h = 256;
    const tex = this.textures.createCanvas('vignette', w, h);
    const ctx = tex.getContext();
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    const g = ctx.createRadialGradient(0, 0, w * 0.3, 0, 0, w * 0.72);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(-w, -w, w * 2, w * 2);
    ctx.restore();
    tex.refresh();
  }

  /** Disque à dégradé radial (halos, lueurs). */
  makeDot(key, size, stops) {
    if (this.textures.exists(key)) return;
    const tex = this.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  /**
   * Texture opaque avec un trou transparent au centre.
   * `holeFrac` = rayon du trou / demi-largeur de la texture.
   */
  makeHole(key, size, holeFrac) {
    if (this.textures.exists(key)) return;
    const tex = this.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    const half = size / 2;
    const hole = half * holeFrac;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(0, 0, size, size);
    // On « gomme » le centre avec un dégradé doux
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(half, half, hole * 0.7, half, half, hole * 1.4);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(half, half, hole * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
  }
}
