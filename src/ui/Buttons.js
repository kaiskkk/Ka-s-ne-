// ─────────────────────────────────────────────────────────────
//  Boutons des écrans de menu : zones rectangulaires testées à la main
//  (fiable en tactile comme à la souris, quel que soit le zoom de la caméra).
//  Un bouton s'active au RELÂCHER, si le doigt est toujours dessus.
// ─────────────────────────────────────────────────────────────
import { sfx } from '../audio/Sfx.js';

export class Buttons {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.pressed = null;
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onCancel, this);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this.onDown, this);
      scene.input.off('pointerup', this.onUp, this);
      scene.input.off('pointerupoutside', this.onCancel, this);
    });
  }

  /**
   * @param {object} b { x, y, w, h, onTap, onPress?(pressed) }
   *   onPress est appelé avec true/false pour l'effet d'enfoncement.
   */
  add(b) {
    this.list.push(b);
    return b;
  }

  clear() {
    this.list.length = 0;
    this.pressed = null;
  }

  at(pointer) {
    const p = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    // Le dernier ajouté est au-dessus
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
    }
    return null;
  }

  onDown(pointer) {
    sfx.unlock();
    const b = this.at(pointer);
    this.pressed = b;
    if (b && b.onPress) b.onPress(true);
  }

  onUp(pointer) {
    const b = this.pressed;
    this.pressed = null;
    if (!b) return;
    if (b.onPress) b.onPress(false);
    if (this.at(pointer) === b) {
      sfx.play('click');
      b.onTap();
    }
  }

  onCancel() {
    if (this.pressed && this.pressed.onPress) this.pressed.onPress(false);
    this.pressed = null;
  }
}
