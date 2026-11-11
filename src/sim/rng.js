// Générateur pseudo-aléatoire à graine (mulberry32).
// La simulation n'utilise QUE celui-ci (jamais Math.random) : un match est
// donc rejouable à l'identique avec la même graine — pratique pour les tests
// et indispensable plus tard pour le multijoueur.
export class Rng {
  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }

  /** Nombre dans [0, 1). */
  next() {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Nombre dans [a, b). */
  range(a, b) {
    return a + (b - a) * this.next();
  }

  /** Entier dans [a, b] (bornes incluses). */
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Mélange (copie) façon Fisher-Yates. */
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Bruit centré sur 0, à peu près gaussien, dans [-1, 1]. */
  noise() {
    return (this.next() + this.next() + this.next()) / 1.5 - 1;
  }
}
