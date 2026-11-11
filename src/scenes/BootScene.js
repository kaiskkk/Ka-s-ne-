// ─────────────────────────────────────────────────────────────
//  BootScene — génère les quelques textures du jeu (aucun fichier image :
//  tout est dessiné par le code), puis ouvre le menu.
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';

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
    this.makeDot('disc', 64, [
      [0, 'rgba(255,255,255,1)'],
      [0.86, 'rgba(255,255,255,1)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    this.makeDot('puff', 128, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.5, 'rgba(255,255,255,0.5)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    // Voiles percés d'un trou : brouillard (grand rayon de vision) et aveuglement (petit)
    this.makeHole('fogHole', 1024, 1 / 8);
    this.makeHole('blindHole', 1024, 1 / 24);

    const data = this.registry.get('autostart');
    if (data) this.scene.start('Game', data);
    else this.scene.start('Menu');
  }

  /** Disque à dégradé radial (particules, projectiles, lueurs). */
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
