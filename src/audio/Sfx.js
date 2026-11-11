// ─────────────────────────────────────────────────────────────
//  Sfx — tous les sons du jeu sont SYNTHÉTISÉS ici (Web Audio) :
//  aucun fichier audio, donc rien de copié et rien à télécharger.
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'elementa.muted';

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.last = {};
    this.muted = false;
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      /* stockage indisponible (navigation privée) */
    }
  }

  /**
   * À appeler lors d'un geste de l'utilisateur : sur iOS, le son reste
   * bloqué tant que l'écran n'a pas été touché.
   */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        // Une seconde de bruit blanc, réutilisée pour les souffles et explosions
        const len = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, len, len);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      // 'suspended' au démarrage, 'interrupted' sur iOS après un appel ou une mise en veille
      if (this.ctx.state !== 'running') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  toggle() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Note : oscillateur avec glissement de fréquence et extinction. */
  tone({ type = 'sine', f0 = 440, f1 = f0, dur = 0.15, vol = 0.3, delay = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  /** Bruit filtré : souffle, impact, explosion. */
  noise({ dur = 0.2, vol = 0.3, freq = 1200, type = 'lowpass', f1 = freq, delay = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  /**
   * Joue un son par son nom.
   * @param {string} name
   * @param {number} vol  volume relatif (0…1), p. ex. selon la distance
   */
  play(name, vol = 1) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running' || vol <= 0.02) return;
    // Pas deux fois le même son en moins de 45 ms (évite la saturation)
    const now = this.ctx.currentTime;
    if (now - (this.last[name] || 0) < 0.045) return;
    this.last[name] = now;
    const v = Math.min(1, vol);
    try {
      this.recipes(name, v);
    } catch {
      /* un son raté ne doit jamais casser le jeu */
    }
  }

  recipes(name, v) {
    switch (name) {
      // Tirs, un timbre par élément
      case 'shoot-feu':
        this.noise({ dur: 0.16, vol: 0.22 * v, freq: 1800, f1: 300 });
        this.tone({ type: 'sawtooth', f0: 320, f1: 110, dur: 0.14, vol: 0.12 * v });
        break;
      case 'shoot-eau':
        this.tone({ f0: 760, f1: 280, dur: 0.14, vol: 0.22 * v });
        break;
      case 'shoot-terre':
        this.noise({ dur: 0.14, vol: 0.3 * v, freq: 500, f1: 120 });
        this.tone({ type: 'triangle', f0: 150, f1: 60, dur: 0.14, vol: 0.25 * v });
        break;
      case 'shoot-foudre':
        this.tone({ type: 'square', f0: 1500, f1: 260, dur: 0.11, vol: 0.12 * v });
        break;
      case 'shoot-vent':
        this.noise({ dur: 0.18, vol: 0.16 * v, freq: 3200, f1: 900, type: 'bandpass' });
        break;
      case 'hit':
        this.tone({ type: 'triangle', f0: 260, f1: 120, dur: 0.07, vol: 0.22 * v });
        break;
      case 'hurt':
        this.tone({ type: 'sawtooth', f0: 190, f1: 80, dur: 0.12, vol: 0.2 * v });
        break;
      case 'explosion':
        this.noise({ dur: 0.45, vol: 0.4 * v, freq: 900, f1: 80 });
        this.tone({ f0: 120, f1: 40, dur: 0.4, vol: 0.35 * v });
        break;
      case 'thunder':
        this.noise({ dur: 0.35, vol: 0.4 * v, freq: 5000, f1: 300 });
        this.tone({ type: 'square', f0: 900, f1: 60, dur: 0.25, vol: 0.14 * v });
        break;
      case 'super':
        this.tone({ type: 'sawtooth', f0: 220, f1: 880, dur: 0.22, vol: 0.18 * v });
        this.tone({ f0: 440, f1: 1320, dur: 0.25, vol: 0.14 * v, delay: 0.04 });
        break;
      case 'fusion':
        this.tone({ type: 'sawtooth', f0: 110, f1: 440, dur: 0.5, vol: 0.2 * v });
        this.tone({ f0: 330, f1: 990, dur: 0.5, vol: 0.18 * v, delay: 0.05 });
        this.tone({ f0: 495, f1: 1485, dur: 0.55, vol: 0.14 * v, delay: 0.1 });
        this.noise({ dur: 0.7, vol: 0.25 * v, freq: 300, f1: 4000, type: 'bandpass' });
        break;
      case 'death':
        this.tone({ type: 'square', f0: 420, f1: 55, dur: 0.4, vol: 0.16 * v });
        this.noise({ dur: 0.3, vol: 0.2 * v, freq: 1200, f1: 150 });
        break;
      case 'respawn':
        this.tone({ f0: 330, f1: 660, dur: 0.2, vol: 0.18 * v });
        break;
      case 'pickup':
        this.tone({ type: 'triangle', f0: 880, dur: 0.1, vol: 0.22 * v });
        this.tone({ type: 'triangle', f0: 1320, dur: 0.18, vol: 0.22 * v, delay: 0.08 });
        break;
      case 'drop':
        this.tone({ type: 'triangle', f0: 700, f1: 300, dur: 0.2, vol: 0.18 * v });
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone({ type: 'square', f0: 620, dur: 0.12, vol: 0.12 * v, delay: i * 0.3 });
          this.tone({ type: 'square', f0: 830, dur: 0.12, vol: 0.12 * v, delay: i * 0.3 + 0.14 });
        }
        break;
      case 'beep':
        this.tone({ type: 'square', f0: 520, dur: 0.12, vol: 0.14 * v });
        break;
      case 'go':
        this.tone({ type: 'square', f0: 1040, dur: 0.35, vol: 0.16 * v });
        break;
      case 'tick':
        this.tone({ type: 'square', f0: 980, dur: 0.05, vol: 0.1 * v });
        break;
      case 'click':
        this.tone({ type: 'triangle', f0: 640, f1: 760, dur: 0.06, vol: 0.18 * v });
        break;
      case 'empty':
        this.tone({ type: 'square', f0: 140, dur: 0.06, vol: 0.1 * v });
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.22 * v, delay: i * 0.13 }));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.35, vol: 0.2 * v, delay: i * 0.17 }));
        break;
      default:
        break;
    }
  }
}

export const sfx = new Sfx();
