// ─────────────────────────────────────────────────────────────
//  ÉLÉMENTA — point d'entrée : démarre Phaser et prépare l'écran.
// ─────────────────────────────────────────────────────────────
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import * as Phaser from 'phaser';
import { music } from './audio/Music.js';
import { sfx } from './audio/Sfx.js';
import { registerServiceWorker } from './pwa/registerServiceWorker.js';
import { CharacterRig } from './render/CharacterRig.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { controls } from './ui/controls.js';
import { blockBrowserGestures, installViewport, viewport } from './ui/viewport.js';

function showError(message) {
  const el = document.getElementById('boot-error');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'flex';
}

function start() {
  blockBrowserGestures();

  const game = new Phaser.Game({
    type: Phaser.AUTO, // WebGL, avec repli automatique sur Canvas
    parent: 'game',
    backgroundColor: '#0b1020',
    // Le canvas est rendu en pixels physiques (net sur Retina) puis réduit par CSS.
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(viewport.width * viewport.dpr),
      height: Math.round(viewport.height * viewport.dpr),
      zoom: 1 / viewport.dpr,
      fullscreenTarget: 'game',
    },
    input: {
      activePointers: 4, // multi-touch : déplacement + visée + boutons en même temps
      windowEvents: true,
    },
    render: {
      antialias: true,
      powerPreference: 'high-performance',
    },
    audio: { noAudio: true }, // les sons sont synthétisés par src/audio/Sfx.js
    disableContextMenu: true,
    banner: false,
    scene: [BootScene, MenuScene, GameScene, HudScene, ResultScene],
  });

  installViewport(game);

  // iOS n'autorise le son qu'après un premier geste de l'utilisateur.
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, () => sfx.unlock(), { passive: true });
  }

  // Outils de test : ?debug dans l'adresse (ou serveur de développement)
  const params = new URLSearchParams(window.location.search);
  if (params.has('debug') || import.meta.env.DEV) {
    window.__ELEMENTA__ = {
      game,
      controls,
      sfx,
      music,
      CharacterRig,
      get match() {
        const scene = game.scene.getScene('Game');
        return scene && scene.scene.isActive() ? scene.match : null;
      },
    };
  }
  // ?play=braz lance directement un match (pratique pour tester)
  if (params.has('play')) {
    game.registry.set('autostart', {
      charId: params.get('play') || 'braz',
      difficulty: params.get('difficulty') || undefined,
      seed: params.has('seed') ? Number(params.get('seed')) : undefined,
    });
  }

  // Nouvelle version déployée : le jeu se recharge tout seul, mais jamais en plein match
  registerServiceWorker(() => game.scene.isActive('Menu'));
}

/** Attend que la police du jeu soit prête (sinon les premiers textes s'afficheraient avec une police de secours). */
function loadFonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const wanted = ['500', '700'].map((w) => document.fonts.load(`${w} 16px Fredoka`, 'ÉLÉMENTA 0123'));
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  return Promise.race([Promise.all(wanted), timeout]).catch(() => {});
}

loadFonts().then(() => {
  try {
    start();
  } catch (err) {
    console.error(err);
    showError('Impossible de démarrer ÉLÉMENTA sur ce navigateur. Essaie de mettre à jour Safari / Chrome.');
  }
});
