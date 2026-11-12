// ─────────────────────────────────────────────────────────────
//  Music — musique de fond ORIGINALE, composée ici et jouée en direct par
//  un petit séquenceur (Web Audio) : basse, arpèges, mélodie et batterie
//  synthétisés. Aucun fichier audio, aucun morceau existant.
//
//   • 'menu'   : thème calme
//   • 'battle' : thème de combat, qui s'accélère quand une équipe tient
//                les 3 cristaux (setUrgent)
// ─────────────────────────────────────────────────────────────
import { sfx } from './Sfx.js';

const STORAGE_KEY = 'elementa.music';
const A4 = 440;
/** Fréquence d'une note donnée en demi-tons par rapport au la 440. */
const hz = (semitones) => A4 * Math.pow(2, semitones / 12);

// Accords : [fondamentale (demi-tons depuis le la), 'm' mineur / 'M' majeur]
const A = -12; // la grave de référence pour la basse
const TRACKS = {
  battle: {
    bpm: 132,
    volume: 0.2,
    // La mineur : Am F C G | Am F Dm E
    chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M'], [0, 'm'], [-4, 'M'], [5, 'm'], [7, 'M']],
    // Arpège en doubles croches (degrés de l'accord : 0 fondamentale, 1 tierce, 2 quinte, +3 = octave)
    arp: [0, 2, 3, 2, 1, 2, 3, 2, 0, 2, 3, 2, 4, 3, 2, 1],
    // Basse en croches (0 = fondamentale, 1 = octave, null = silence)
    bass: [0, null, 0, null, 0, null, 1, null, 0, null, 0, 1, null, 1, 0, null],
    // Mélodie (demi-tons au-dessus de la fondamentale de l'accord, null = silence), 2 mesures qui alternent
    lead: [
      [12, null, null, null, 15, null, 12, null, 19, null, null, 17, 15, null, 12, null],
      [19, null, 17, null, 15, null, null, 12, 15, null, 17, null, 19, null, null, null],
    ],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
  },
  menu: {
    bpm: 96,
    volume: 0.17,
    // Do majeur : C Am F G
    chords: [[3, 'M'], [0, 'm'], [-4, 'M'], [-2, 'M']],
    arp: [0, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null, 4, null],
    bass: [0, null, null, null, null, null, 0, null, 0, null, null, null, null, null, 1, null],
    lead: [
      [null, null, null, null, 19, null, null, null, 16, null, null, null, 12, null, null, null],
      [null, null, null, null, 12, null, 14, null, 16, null, null, null, null, null, null, null],
    ],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    pad: true,
  },
};

/** Note d'un accord pour un degré d'arpège (0, 1, 2 puis +3 par octave). */
function chordTone(root, quality, degree) {
  const steps = [0, quality === 'm' ? 3 : 4, 7];
  return root + steps[degree % 3] + 12 * Math.floor(degree / 3);
}

class Music {
  constructor() {
    this.want = null; // morceau demandé
    this.track = null; // morceau en cours
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.out = null;
    this.paused = false;
    this.urgent = false;
    this.enabled = true;
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== '0';
    } catch {
      /* stockage indisponible */
    }
    // Le son n'est autorisé qu'après un premier geste : on (re)démarre à ce moment-là
    sfx.onUnlock = () => this.refresh();
    document.addEventListener('visibilitychange', () => this.refresh());
  }

  /** Demande un morceau ('menu' ou 'battle'). Sans effet si c'est déjà celui qui joue. */
  play(name) {
    this.want = name;
    this.paused = false;
    this.urgent = false;
    this.refresh();
  }

  stop() {
    this.want = null;
    this.refresh();
  }

  setPaused(paused) {
    this.paused = paused;
    this.refresh();
  }

  /** Passage « tendu » : tempo plus rapide et charleston doublé. */
  setUrgent(urgent) {
    this.urgent = urgent;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
    this.refresh();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /** Met la lecture en accord avec ce qui est demandé (morceau, pause, réglages, onglet visible). */
  refresh() {
    const ctx = sfx.ctx;
    const should = !!this.want && this.enabled && !this.paused && !document.hidden && ctx && ctx.state === 'running';
    if (!should) {
      this.halt();
      return;
    }
    if (this.timer && this.track === this.want) return;
    this.halt();
    this.track = this.want;
    this.step = 0;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.out.gain.exponentialRampToValueAtTime(TRACKS[this.track].volume, ctx.currentTime + 0.6);
    this.out.connect(sfx.master);
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  halt() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
    if (this.out && sfx.ctx) {
      const out = this.out;
      try {
        out.gain.cancelScheduledValues(sfx.ctx.currentTime);
        out.gain.setTargetAtTime(0.0001, sfx.ctx.currentTime, 0.05);
        setTimeout(() => out.disconnect(), 400);
      } catch {
        /* ignore */
      }
    }
    this.out = null;
  }

  /** Programme les notes des ~250 prochaines millisecondes. */
  schedule() {
    const ctx = sfx.ctx;
    if (!ctx || ctx.state !== 'running' || !this.track) return;
    const tr = TRACKS[this.track];
    // Si l'horloge a pris du retard (onglet figé), on repart de maintenant
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.25) {
      try {
        this.playStep(tr, this.step, this.nextTime);
      } catch {
        /* une note ratée ne doit jamais casser le jeu */
      }
      const bpm = tr.bpm * (this.urgent ? 1.1 : 1);
      this.nextTime += 60 / bpm / 4; // une double croche
      this.step += 1;
    }
  }

  playStep(tr, step, t) {
    const i = step % 16;
    const bar = Math.floor(step / 16);
    const [root, quality] = tr.chords[bar % tr.chords.length];
    const sixteenth = 60 / tr.bpm / 4;

    // Nappe d'accord (menu) : une note tenue par mesure
    if (tr.pad && i === 0) {
      for (const d of [0, 1, 2]) this.note(hz(chordTone(root, quality, d)), t, sixteenth * 15, 'triangle', 0.1, 0.25);
    }
    // Basse
    const b = tr.bass[i];
    if (b != null) this.note(hz(A + root + b * 12), t, sixteenth * 1.7, 'triangle', 0.5);
    // Arpège
    const a = tr.arp[i];
    if (a != null) this.note(hz(chordTone(root, quality, a) + (tr.pad ? 12 : 0)), t, sixteenth * 1.2, 'square', tr.pad ? 0.1 : 0.12);
    // Mélodie (elle entre à la 3ᵉ mesure, pour laisser respirer l'intro)
    const l = tr.lead[bar % tr.lead.length][i];
    if (l != null && bar >= 2) {
      let semi = root + l;
      // On reste dans la gamme : tierce de l'accord majeur / mineur
      if (l % 12 === 3 && quality === 'M') semi += 1;
      this.note(hz(semi), t, sixteenth * 2.4, tr.pad ? 'sine' : 'sawtooth', tr.pad ? 0.22 : 0.13, 0.02);
    }
    // Batterie
    if (tr.kick[i]) this.kick(t);
    if (tr.snare[i]) this.snare(t);
    if (tr.hat[i] || this.urgent) this.hat(t, this.urgent && !tr.hat[i] ? 0.5 : 1);
  }

  note(freq, t, dur, type, vol, attack = 0.006) {
    const ctx = sfx.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.out);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  kick(t) {
    const ctx = sfx.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(this.out);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  noise(t, dur, vol, type, freq) {
    const ctx = sfx.ctx;
    const src = ctx.createBufferSource();
    src.buffer = sfx.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  snare(t) {
    this.noise(t, 0.13, 0.45, 'bandpass', 1900);
    this.note(190, t, 0.07, 'triangle', 0.25);
  }

  hat(t, vol = 1) {
    this.noise(t, 0.035, 0.16 * vol, 'highpass', 7500);
  }
}

export const music = new Music();
