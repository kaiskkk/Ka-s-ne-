// ─────────────────────────────────────────────────────────────
//  Fighter — l'état d'un combattant (joueur ou bot).
//  La logique qui le fait évoluer est dans Match.js / abilities.js.
// ─────────────────────────────────────────────────────────────
import { COMBAT } from '../config/constants.js';

export class Fighter {
  /**
   * @param {number} id      index dans match.fighters
   * @param {number} team    0 (bleue) ou 1 (rouge)
   * @param {object} def     définition du personnage (config/characters.js)
   * @param {{x:number,y:number}} spawn point d'apparition
   * @param {boolean} isPlayer vrai pour le combattant contrôlé par l'humain
   */
  constructor(id, team, def, spawn, isPlayer = false) {
    this.id = id;
    this.team = team;
    this.def = def;
    this.charId = def.id;
    this.element = def.element;
    this.isPlayer = isPlayer;
    this.spawn = spawn;
    this.r = def.radius;
    this.maxHp = def.hp;
    /** Multiplicateur de PV et de dégâts (niveau du personnage du joueur) ; 1 = niveau 1. */
    this.power = 1;

    // Statistiques du match
    this.kills = 0;
    this.deaths = 0;
    this.damageDealt = 0;
    this.healingDone = 0;
    this.crystalsPicked = 0;

    /** Charge du super, de 0 à 1 (conservée après une mort). */
    this.superCharge = 0;

    /** Entrées de contrôle (remplies par le joueur ou par le bot). */
    this.input = { mx: 0, my: 0, aimAngle: null };

    this.reset(spawn.x, spawn.y);
    this.facing = team === 0 ? 0 : Math.PI;
  }

  /** Applique le niveau du personnage : PV max et dégâts multipliés. */
  setPower(power) {
    this.power = power;
    this.maxHp = Math.round(this.def.hp * power);
    this.hp = this.maxHp;
  }

  /** Remet le combattant à neuf (début de match / réapparition). */
  reset(x, y) {
    this.x = x;
    this.y = y;
    this.px = x; // position au pas précédent (pour l'interpolation du rendu)
    this.py = y;
    this.vx = 0; // vitesse réelle du dernier pas (les bots s'en servent pour anticiper)
    this.vy = 0;
    this.facing = this.team === 0 ? 0 : Math.PI;
    this.hp = this.maxHp;
    this.alive = true;
    this.respawnT = 0;
    this.ammo = COMBAT.maxAmmo;
    this.attackCd = 0;
    this.burst = null; // rafale en cours (Alizé)
    this.dash = null; // charge en cours (Dolmen)

    // Altérations d'état (durées restantes, en secondes)
    this.stunT = 0;
    this.frozen = false; // l'étourdissement en cours est-il un gel ? (visuel)
    this.rootT = 0;
    this.slowT = 0;
    this.slowFactor = 1;
    this.hasteT = 0;
    this.hasteFactor = 1;
    this.drT = 0; // réduction de dégâts
    this.drFactor = 0;
    this.blindT = 0; // aveuglé (vapeur)
    this.cloakT = 0; // camouflé (tempête de sable)
    this.revealT = 0; // visible même dans un buisson
    this.invulnT = 0; // bouclier de réapparition
    this.chill = 0; // jauge de gel (blizzard)
    this.chillImmuneT = 0;

    // Recalculés à chaque pas par les zones
    this.zoneSlow = 1;
    this.pushX = 0;
    this.pushY = 0;

    // Poussée (recul)
    this.kbx = 0;
    this.kby = 0;
    this.kbT = 0;

    this.inBush = false;
    this.carrying = 0; // nombre de cristaux portés
    this.lastCombatT = -999; // dernier instant où il a tiré / été touché (régénération)
    this.lavaAcc = 0;
    this.facingLockT = 0;
    this.chilledTick = false;
    this.pending = null; // actions demandées (tir, super, fusion) en attente
    this.lastHitBy = null; // dernier ennemi à l'avoir touché (crédit des éliminations)
    this.lastHitT = -999;
  }

  get hpPct() {
    return this.hp / this.maxHp;
  }

  /** Peut agir (tirer, lancer un super) ? */
  canAct() {
    return this.alive && this.stunT <= 0 && !this.dash;
  }

  /** Peut se déplacer de lui-même ? */
  canMove() {
    return this.alive && this.stunT <= 0 && this.rootT <= 0 && !this.dash;
  }

  get superReady() {
    return this.superCharge >= 1;
  }

  /** Vitesse de déplacement actuelle, altérations comprises. */
  currentSpeed() {
    let s = this.def.speed * this.zoneSlow;
    if (this.slowT > 0) s *= this.slowFactor;
    if (this.hasteT > 0) s *= this.hasteFactor;
    return s;
  }
}
