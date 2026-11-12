// ─────────────────────────────────────────────────────────────
//  Boutons des écrans de menu : zones rectangulaires testées à la main
//  (fiable en tactile comme à la souris, quel que soit le zoom de la caméra).
//  Un bouton s'active au RELÂCHER, si le doigt est toujours dessus.
//
//  Les fenêtres (pop-ups) empilent leur propre couche de boutons : tant
//  qu'une fenêtre est ouverte, ceux du dessous sont inactifs.
// ─────────────────────────────────────────────────────────────
import { sfx } from '../audio/Sfx.js';

export class Buttons {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.layers = [];
    this.pressed = null;
    this.enabled = true;
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
   * @param {object} b { x, y, w, h, onTap, onPress?(pressed), sound?, id? }
   *   onPress est appelé avec true/false pour l'effet d'enfoncement ;
   *   sound : nom du son joué au tap ('click' par défaut, false = aucun) ;
   *   id : nom facultatif, pour retrouver le bouton dans les tests.
   */
  add(b) {
    this.list.push(b);
    return b;
  }

  remove(b) {
    const i = this.list.indexOf(b);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    this.list.length = 0;
    this.pressed = null;
  }

  /** Ouvre une nouvelle couche (fenêtre) : les boutons existants sont mis de côté. */
  pushLayer() {
    this.onCancel();
    this.layers.push(this.list);
    this.list = [];
  }

  popLayer() {
    this.onCancel();
    this.list = this.layers.pop() || [];
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
    if (!this.enabled) return;
    const b = this.at(pointer);
    this.pressed = b;
    if (b && b.onPress) b.onPress(true);
  }

  onUp(pointer) {
    const b = this.pressed;
    this.pressed = null;
    if (!b) return;
    if (b.onPress) b.onPress(false);
    if (this.enabled && this.at(pointer) === b) {
      if (b.sound !== false) sfx.play(b.sound || 'click');
      b.onTap();
    }
  }

  onCancel() {
    if (this.pressed && this.pressed.onPress) this.pressed.onPress(false);
    this.pressed = null;
  }
}
