// Enregistre le service worker (jeu installable + jouable hors ligne).
// Uniquement en production : en développement il gênerait le rechargement à chaud.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker non enregistré :', err);
    });
  });
}
