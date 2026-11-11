// ─────────────────────────────────────────────────────────────
//  ÉLÉMENTA — point d'entrée : démarre Phaser et prépare l'écran.
// ─────────────────────────────────────────────────────────────
import * as Phaser from 'phaser';
import { sfx } from './audio/Sfx.js';
import { registerServiceWorker } from './pwa/registerServiceWorker.js';
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
      difficulty: params.get('difficulty') || 'normal',
      seed: params.has('seed') ? Number(params.get('seed')) : undefined,
    });
  }

  registerServiceWorker();
}

try {
  start();
} catch (err) {
  console.error(err);
  showError('Impossible de démarrer ÉLÉMENTA sur ce navigateur. Essaie de mettre à jour Safari / Chrome.');
}
