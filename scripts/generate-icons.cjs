// Génère les icônes PNG de la PWA dans public/icons/ à partir d'un dessin SVG
// original (un cristal entouré des 5 éléments).
//
// Outil de développement, à relancer seulement si on change le logo :
//   node scripts/generate-icons.cjs
// Nécessite Playwright (npm i -D playwright && npx playwright install chromium).
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const ELEMENTS = ['#ff5533', '#ffd400', '#52e0b8', '#2f9bff', '#b07a45']; // feu, foudre, vent, eau, terre

/**
 * @param {number} scale    taille du motif (1 = normal, 0.72 = icône « maskable »)
 * @param {number} radius   arrondi du fond (0 = carré plein, pour iOS / maskable)
 * @param {boolean} simple  version simplifiée pour les très petites tailles
 */
function svg({ scale = 1, radius = 0, simple = false }) {
  const orbs = ELEMENTS.map((color, i) => {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    const x = 256 + Math.cos(a) * 158;
    const y = 256 + Math.sin(a) * 158;
    return `
      <circle cx="${x}" cy="${y}" r="${simple ? 62 : 70}" fill="${color}" opacity="0.28"/>
      <circle cx="${x}" cy="${y}" r="${simple ? 50 : 44}" fill="${color}" stroke="#ffffff" stroke-width="${simple ? 0 : 7}"/>`;
  }).join('');
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="75%">
      <stop offset="0" stop-color="#27356e"/>
      <stop offset="1" stop-color="#0b1020"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#7df9ff" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#7df9ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    ${simple ? '' : '<circle cx="256" cy="256" r="158" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="6"/>'}
    ${orbs}
    <circle cx="256" cy="256" r="150" fill="url(#glow)"/>
    <polygon points="256,136 338,256 256,376 174,256" fill="#ffffff"/>
    <polygon points="256,152 326,256 256,360 186,256" fill="#7df9ff"/>
    <polygon points="256,152 326,256 256,360" fill="#1aa6c4"/>
    <polygon points="256,176 214,250 256,236" fill="#ffffff" opacity="0.8"/>
  </g>
</svg>`;
}

const TARGETS = [
  { file: 'icon-512.png', size: 512, opts: { radius: 112 }, transparent: true },
  { file: 'icon-192.png', size: 192, opts: { radius: 112 }, transparent: true },
  { file: 'icon-maskable-512.png', size: 512, opts: { scale: 0.72 } },
  { file: 'apple-touch-icon.png', size: 180, opts: { scale: 0.92 } },
  { file: 'favicon-32.png', size: 32, opts: { radius: 112, simple: true }, transparent: true },
];

(async () => {
  const outDir = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const t of TARGETS) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${svg(t.opts)}`,
    );
    await page.screenshot({ path: path.join(outDir, t.file), omitBackground: !!t.transparent, clip: { x: 0, y: 0, width: t.size, height: t.size } });
    await page.close();
    console.log('✓', t.file);
  }
  await browser.close();
})();
