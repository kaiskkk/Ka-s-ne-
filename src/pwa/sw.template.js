/* ÉLÉMENTA — service worker.
 *
 * Ce fichier est un MODÈLE : au build, vite.config.js remplit la liste des
 * fichiers à mettre en cache et le numéro de version, puis écrit dist/sw.js.
 *
 * Stratégie :
 *  - à l'installation, tout le jeu est mis en cache → jouable hors ligne ;
 *  - la page HTML est demandée au réseau d'abord (pour recevoir les mises à
 *    jour), avec le cache en secours si on est hors ligne ;
 *  - les autres fichiers (noms uniques par version) viennent du cache.
 */
const VERSION = '__VERSION__';
const CACHE = `elementa-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('elementa-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page HTML : réseau d'abord (4 s max), cache en secours
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const network = fetch(req).then((res) => {
          const type = res.headers.get('content-type') || '';
          if (res.ok && url.pathname === '/' && type.includes('text/html')) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('/', copy));
          }
          return res;
        });
        network.catch(() => {}); // l'échec est géré ci-dessous
        try {
          return await Promise.race([network, timeout(4000)]);
        } catch {
          const hit = await caches.match('/', { ignoreSearch: true, ignoreVary: true });
          // Hors ligne ou réseau lent : la copie en cache ; sans cache, on attend le réseau.
          return hit || network;
        }
      })(),
    );
    return;
  }

  // Fichiers du jeu : cache d'abord, réseau sinon.
  // ignoreVary : certains serveurs ajoutent « Vary: Origin », ce qui ferait
  // échouer la recherche en cache des scripts chargés en mode module.
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
