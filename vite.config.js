import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

/** Liste récursive des fichiers d'un dossier (chemins relatifs avec des « / »). */
function listFiles(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...listFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

/**
 * Génère dist/sw.js à la fin du build à partir de src/pwa/sw.template.js :
 * on y inscrit la liste de tous les fichiers du jeu (pour le mode hors ligne)
 * et une version calculée d'après leur contenu (un nouveau déploiement
 * remplace donc automatiquement l'ancien cache).
 */
function serviceWorker() {
  let outDir = 'dist';
  return {
    name: 'elementa-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) {
        hash.update(f);
        hash.update(readFileSync(join(outDir, f)));
      }
      const template = readFileSync('src/pwa/sw.template.js', 'utf8');
      hash.update(template); // un changement du service worker lui-même renouvelle aussi le cache
      const version = hash.digest('hex').slice(0, 12);
      const urls = files.map((f) => (f === 'index.html' ? '/' : `/${f}`));
      const sw = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(urls, null, 2));
      writeFileSync(join(outDir, 'sw.js'), sw);
      console.log(`\n✓ service worker : ${urls.length} fichiers en cache, version ${version}`);
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
  build: {
    target: 'es2020',
    // Phaser pèse ~1,2 Mo minifié : c'est attendu, inutile d'avertir.
    chunkSizeWarningLimit: 1700,
    rolldownOptions: {
      output: {
        // Phaser dans son propre fichier : il reste en cache du navigateur
        // quand seul le code du jeu change entre deux déploiements.
        codeSplitting: {
          groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }],
        },
      },
    },
  },
});
