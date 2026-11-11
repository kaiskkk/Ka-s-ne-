// ─────────────────────────────────────────────────────────────
//  Gestion de l'écran : taille réelle, densité de pixels, zones sûres
//  (encoche / Dynamic Island / barre d'accueil) et blocage des gestes
//  du navigateur (zoom, défilement, menu contextuel).
//
//  Convention : le canvas est rendu en pixels PHYSIQUES (taille CSS × dpr)
//  pour rester net sur écran Retina ; les interfaces sont dessinées en
//  pixels CSS grâce à un zoom de caméra (voir uiCamera()).
// ─────────────────────────────────────────────────────────────
import { VIEW } from '../config/constants.js';

export const viewport = {
  /** Taille de la fenêtre en pixels CSS. */
  width: 0,
  height: 0,
  /** Densité de pixels utilisée pour le rendu (plafonnée par VIEW.maxDpr). */
  dpr: 1,
  /** Marges de sécurité en pixels CSS. */
  safe: { top: 0, right: 0, bottom: 0, left: 0 },
};

const params = new URLSearchParams(window.location.search);

function readSafeArea() {
  // ?notch=1 simule un iPhone à Dynamic Island tenu en paysage (pour tester sur ordinateur)
  if (params.has('notch')) return { top: 0, right: 59, bottom: 21, left: 59 };
  const el = document.getElementById('safe-probe');
  if (!el) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(el);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

function measure() {
  viewport.width = Math.max(1, Math.round(window.innerWidth));
  viewport.height = Math.max(1, Math.round(window.innerHeight));
  viewport.dpr = Math.min(window.devicePixelRatio || 1, VIEW.maxDpr);
  viewport.safe = readSafeArea();
}

measure();

/** Vrai sur iPhone / iPad (y compris iPadOS qui se fait passer pour un Mac). */
export function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Vrai si le jeu est lancé depuis l'écran d'accueil (mode application). */
export function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Branche le redimensionnement du jeu sur la fenêtre.
 * Le jeu émet 'viewport-changed' (game.events) quand la taille change.
 */
export function installViewport(game) {
  let lastKey = '';

  const apply = () => {
    measure();
    const { width, height, dpr, safe } = viewport;
    const key = `${width}x${height}@${dpr}|${safe.top},${safe.right},${safe.bottom},${safe.left}`;
    if (key === lastKey) return;
    lastKey = key;
    // Ordre important : resize() fixe la taille interne du canvas, puis setZoom()
    // recalcule TOUJOURS sa taille CSS et la conversion des coordonnées tactiles
    // (dans l'autre ordre, la taille CSS restait l'ancienne sur les écrans non-Retina).
    game.scale.resize(Math.round(width * dpr), Math.round(height * dpr));
    game.scale.setZoom(1 / dpr);
    game.events.emit('viewport-changed', viewport);
  };

  // iOS annonce parfois l'ancienne taille juste après une rotation : on revérifie un peu plus tard.
  const schedule = () => {
    apply();
    setTimeout(apply, 120);
    setTimeout(apply, 500);
  };

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
  schedule();
}

/** Désactive les gestes du navigateur qui gênent un jeu tactile. */
export function blockBrowserGestures() {
  const stop = (e) => e.preventDefault();
  // Zoom au pincement (événements propres à Safari)
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, stop, { passive: false });
  }
  // Défilement / rebond, zoom au double-tap, menu contextuel, glisser-déposer
  document.addEventListener('touchmove', stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  document.addEventListener('contextmenu', stop);
  document.addEventListener('dragstart', stop);
  document.addEventListener('selectstart', stop);
  // Zoom Ctrl + molette sur ordinateur
  window.addEventListener('wheel', (e) => e.ctrlKey && e.preventDefault(), { passive: false });
  // Double-tap rapide : Safari zoome malgré tout sur certains modèles
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 320) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );
}

/**
 * Configure la caméra d'une scène d'interface pour travailler en pixels CSS :
 * l'origine (0, 0) est le coin haut-gauche de l'écran.
 */
export function uiCamera(scene) {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setZoom(viewport.dpr);
  cam.setScroll(0, 0);
  return cam;
}

/**
 * Caméra « ajustée » : la scène est dessinée dans un rectangle de référence
 * (refW × refH) qui est mis à l'échelle et centré dans l'écran.
 * Renvoie le zoom effectif (utile pour la netteté des textes).
 */
export function fitCamera(scene, refW, refH) {
  const cam = scene.cameras.main;
  const { width, height, dpr, safe } = viewport;
  // Zone réellement utilisable (hors encoche et barre d'accueil)
  const usableW = Math.max(1, width - safe.left - safe.right);
  const usableH = Math.max(1, height - safe.top - safe.bottom);
  const scale = Math.min(usableW / refW, usableH / refH);
  const zoom = scale * dpr;
  cam.setOrigin(0, 0);
  cam.setZoom(zoom);
  const offsetX = safe.left + (usableW - refW * scale) / 2;
  const offsetY = safe.top + (usableH - refH * scale) / 2;
  cam.setScroll(-offsetX / scale, -offsetY / scale);
  return zoom;
}

/** Tente d'empêcher la mise en veille de l'écran pendant un match. */
let wakeLock = null;
export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch {
    /* non pris en charge ou refusé : sans importance */
  }
}

export function releaseWakeLock() {
  try {
    if (wakeLock) wakeLock.release();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}
