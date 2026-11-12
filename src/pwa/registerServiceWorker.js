// Enregistre le service worker (jeu installable + jouable hors ligne) et
// gère les MISES À JOUR : une application installée sur l'écran d'accueil
// reste souvent ouverte en mémoire, elle ne verrait jamais les nouvelles
// versions si on ne les cherchait pas activement.
//
// Uniquement en production : en développement il gênerait le rechargement à chaud.

/**
 * @param {() => boolean} canReload  vrai quand on peut recharger sans gêner
 *                                   (dans le menu, pas en plein match)
 */
export function registerServiceWorker(canReload = () => true) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // Y avait-il déjà une version installée ? (sinon c'est la toute première visite)
  const hadController = !!navigator.serviceWorker.controller;

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // À chaque retour dans le jeu, on regarde s'il existe une nouvelle version
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) reg.update().catch(() => {});
        });
      })
      .catch((err) => console.warn('Service worker non enregistré :', err));
  };
  // Le jeu démarre après le chargement de la police : la page peut déjà être
  // entièrement chargée, auquel cas l'événement « load » ne reviendra pas.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);

  // Une nouvelle version vient de prendre le relais : on recharge dès que possible
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    const tryReload = () => {
      if (reloading) return;
      if (canReload()) {
        reloading = true;
        window.location.reload();
      } else {
        setTimeout(tryReload, 3000);
      }
    };
    tryReload();
  });
}
