// État des commandes du joueur, partagé entre l'interface (HudScene, qui
// l'écrit) et la scène de jeu (GameScene, qui le lit à chaque pas).
export const controls = {
  /** Direction de déplacement, chaque composante dans [-1, 1]. */
  moveX: 0,
  moveY: 0,
  /**
   * Visée en cours (joystick droit ou bouton Super maintenu), ou null.
   * { kind: 'attack' | 'super', angle, power (0…1), active (au-delà de la zone morte) }
   */
  aiming: null,
  /** Actions à transmettre à la simulation : { type, angle, power } */
  actions: [],

  reset() {
    this.moveX = 0;
    this.moveY = 0;
    this.aiming = null;
    this.actions.length = 0;
  },
};
