// ─────────────────────────────────────────────────────────────
//  Test de bout en bout d'ÉLÉMENTA dans Chromium, en émulant un iPhone
//  tenu en paysage, avec de VRAIS événements tactiles multi-doigts.
//
//  Parcours vérifié :
//    accueil → aide du premier lancement → personnages → fiche → améliorer
//    → choisir → boutique → cadeau du jour → coffre (ouverture) → JOUER
//    → joysticks → tir → super → fusion → pause → portrait
//    → fin de match (trophées, pièces, sauvegarde) → accueil → rechargement
//    → défaite → rejouer.
//
//  Utilisation (optionnel, nécessite Playwright) :
//    npm run build && npm run preview          (dans un premier terminal)
//    node tests/e2e/smoke.cjs                  (dans un second)
//  Variable ELEMENTA_URL pour tester une autre adresse (ex. le site Vercel).
// ─────────────────────────────────────────────────────────────
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = (process.env.ELEMENTA_URL || 'http://localhost:4173').replace(/\/$/, '');
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent: IPHONE_UA,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const touch = (type, points) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 1 })),
    });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const scenes = () => ev(() => window.__ELEMENTA__.game.scene.getScenes(true).map((s) => s.scene.key));
  const player = () =>
    ev(() => {
      const p = window.__ELEMENTA__.match.player;
      return { x: p.x, y: p.y, ammo: p.ammo, superCharge: p.superCharge, charId: p.charId, alive: p.alive };
    });
  const profile = () => ev(() => JSON.parse(JSON.stringify(window.__ELEMENTA__.profile.data)));
  const saved = () => ev(() => JSON.parse(localStorage.getItem('elementa.profile')));

  /** Attend qu'un écran soit affiché, immobile (transition finie) et prêt à recevoir des taps. */
  const ready = (key) =>
    page.waitForFunction(
      (k) => {
        const g = window.__ELEMENTA__.game;
        const s = g.scene.getScene(k);
        if (!s || !g.scene.isActive(k) || s.leaving || !s.buttons || !s.buttons.enabled) return false;
        const cam = s.cameras.main;
        if (cam.fadeEffect.isRunning) return false;
        if (s.__seenScroll !== cam.scrollX) {
          s.__seenScroll = cam.scrollX; // encore en train de glisser : on repasse
          return false;
        }
        return true;
      },
      key,
      { timeout: 15000, polling: 150 },
    );
  /** Centre (en pixels écran) d'un bouton de menu, retrouvé par son identifiant. */
  const center = (key, id) =>
    ev(
      ([k, i]) => {
        const g = window.__ELEMENTA__.game;
        const s = g.scene.getScene(k);
        const b = s.buttons.list.find((x) => x.id === i);
        if (!b) return null;
        const cam = s.cameras.main;
        return {
          x: ((b.x + b.w / 2 - cam.scrollX) * cam.zoom) / g.scale.displayScale.x,
          y: ((b.y + b.h / 2 - cam.scrollY) * cam.zoom) / g.scale.displayScale.y,
        };
      },
      [key, id],
    );
  /** Tape un bouton au doigt. */
  const tap = async (key, id) => {
    await ready(key);
    const c = await center(key, id);
    assert.ok(c, `bouton « ${id} » présent sur l'écran ${key}`);
    await page.touchscreen.tap(c.x, c.y);
  };
  const step = (label) => console.log(`  ✓ ${label}`);

  // ── Accueil ──
  await page.goto(`${BASE}/?debug`);
  await page.waitForFunction(() => window.__ELEMENTA__ && window.__ELEMENTA__.game.isBooted, null, { timeout: 20000 });
  await sleep(600);
  const boot = await ev(() => {
    const g = window.__ELEMENTA__.game;
    return { webgl: g.renderer.type === 2, canvas: [g.canvas.width, g.canvas.height], css: g.canvas.style.width };
  });
  assert.deepEqual(await scenes(), ['Home']);
  assert.deepEqual(boot.canvas, [1688, 780], 'canvas rendu en pixels physiques (×2)');
  assert.equal(boot.css, '844px');
  const fresh = await profile();
  assert.deepEqual([fresh.coins, fresh.gems, fresh.level, fresh.selected], [150, 15, 1, 'braz'], 'profil de départ');
  step(`accueil affiché (${boot.webgl ? 'WebGL' : 'Canvas'}, canvas ${boot.canvas.join('×')})`);

  // Premier lancement : la fenêtre « Comment jouer » s'ouvre toute seule
  const popupOpen = () => ev(() => !!window.__ELEMENTA__.game.scene.getScene('Home').popup);
  await page.waitForFunction(() => !!window.__ELEMENTA__.game.scene.getScene('Home').popup, null, { timeout: 8000 });
  await tap('Home', 'help-ok');
  await sleep(300);
  assert.equal(await popupOpen(), false);
  assert.equal((await saved()).helpSeen, true, 'l’aide ne se rouvrira pas');
  step('aide « Comment jouer » au premier lancement');

  // Le test s'offre des pièces pour pouvoir tout essayer
  await ev(() => window.__ELEMENTA__.profile.grant({ coins: 500 }));

  // ── Personnages : grille → fiche d'Alizé → améliorer → choisir ──
  await tap('Home', 'chars');
  await tap('Chars', 'char-alize');
  await page.waitForFunction(() => window.__ELEMENTA__.game.scene.getScene('Chars').sceneData.sheet === 'alize', null, { timeout: 8000 });
  await tap('Chars', 'upgrade');
  await page.waitForFunction(() => window.__ELEMENTA__.profile.data.chars.alize.level === 2, null, { timeout: 8000 });
  assert.equal((await profile()).coins, 650 - 80, 'l’amélioration coûte 80 pièces');
  await tap('Chars', 'select');
  await ready('Home');
  assert.equal((await profile()).selected, 'alize');
  step('fiche du personnage : améliorer (−80 pièces) puis choisir');

  // ── Boutique : cadeau du jour, puis un coffre qui s'ouvre ──
  await tap('Home', 'shop');
  await tap('Shop', 'offer-cadeau');
  await page.waitForFunction(() => window.__ELEMENTA__.profile.data.shop.bought.includes('cadeau'), null, { timeout: 8000 });
  assert.equal((await profile()).coins, 570 + 40, 'cadeau du jour : +40 pièces');
  const beforeChest = await profile();
  await tap('Shop', 'chest-eveil');
  await page.waitForFunction(() => window.__ELEMENTA__.game.scene.isActive('Chest'), null, { timeout: 8000 });
  // Le contenu est crédité tout de suite ; l'animation n'est que du spectacle
  const afterChest = await profile();
  assert.ok(afterChest.gems > beforeChest.gems, 'un coffre contient toujours des gemmes');
  const chestState = () => ev(() => window.__ELEMENTA__.game.scene.getScene('Chest').state);
  for (let i = 0; i < 40 && (await chestState()) !== 'done'; i++) {
    await page.touchscreen.tap(422, 150); // ouvrir, puis passer chaque récompense
    await sleep(250);
  }
  assert.equal(await chestState(), 'done', 'toutes les récompenses sont sorties');
  await tap('Chest', 'collect');
  await page.waitForFunction(() => !window.__ELEMENTA__.game.scene.isActive('Chest'), null, { timeout: 8000 });
  await ready('Shop');
  assert.deepEqual(await saved(), await profile(), 'le profil est sauvegardé sur l’appareil');
  step('boutique : cadeau du jour et ouverture d’un coffre');

  // ── JOUER ──
  await tap('Shop', 'back');
  await tap('Home', 'play');
  await page.waitForFunction(() => window.__ELEMENTA__.game.scene.isActive('Hud'), null, { timeout: 8000 });
  assert.deepEqual(await scenes(), ['Game', 'Hud']);
  assert.equal((await player()).charId, 'alize');
  assert.equal(await ev(() => window.__ELEMENTA__.match.player.power), 1.05, 'niveau 2 : +5 % de PV et de dégâts en match');
  step('match lancé au doigt, avec le personnage choisi et son niveau');

  // ── Match ──
  await page.waitForFunction(() => window.__ELEMENTA__.match.phase === 'playing', null, { timeout: 10000 });
  // Joueur placé en terrain dégagé et rendu très résistant pour la durée du test
  await ev(() => {
    const m = window.__ELEMENTA__.match;
    const p = m.player;
    p.x = p.px = 9 * 64;
    p.y = p.py = 4.5 * 64;
    p.maxHp = p.hp = 1e6;
  });
  const hud = await ev(() => {
    const h = window.__ELEMENTA__.game.scene.getScene('Hud');
    return { move: h.moveRest, aim: h.aimRest, superBtn: h.superBtn, fusionBtn: h.fusionBtn, pauseBtn: h.pauseBtn };
  });

  // Joystick gauche : vers la droite
  const p0 = await player();
  await touch('touchStart', [{ x: hud.move.x, y: hud.move.y, id: 1 }]);
  await touch('touchMove', [{ x: hud.move.x + 50, y: hud.move.y, id: 1 }]);
  await sleep(700);
  const p1 = await player();
  assert.ok(p1.x > p0.x + 60, `le joueur avance (${p0.x.toFixed(0)} → ${p1.x.toFixed(0)})`);
  step('joystick de déplacement');

  // Joystick droit en même temps : viser puis relâcher = tirer
  await touch('touchStart', [
    { x: hud.move.x + 50, y: hud.move.y, id: 1 },
    { x: hud.aim.x, y: hud.aim.y, id: 2 },
  ]);
  await touch('touchMove', [
    { x: hud.move.x + 50, y: hud.move.y, id: 1 },
    { x: hud.aim.x + 40, y: hud.aim.y - 30, id: 2 },
  ]);
  await sleep(150);
  const aiming = await ev(() => window.__ELEMENTA__.controls.aiming);
  assert.ok(aiming && aiming.active && aiming.kind === 'attack', 'visée active pendant le glissement');
  assert.ok(Math.abs(aiming.angle - Math.atan2(-30, 40)) < 0.05, 'angle de visée fidèle au doigt');
  // On lève uniquement le doigt de visée (touchEnd = liste des doigts qui se lèvent)
  await touch('touchEnd', [{ x: hud.aim.x + 40, y: hud.aim.y - 30, id: 2 }]);
  await sleep(150);
  const p2 = await player();
  assert.ok(p2.ammo < p1.ammo - 0.5, 'relâcher le joystick de visée tire');
  assert.ok(p2.x > p1.x, 'le déplacement continue pendant le tir (multi-touch)');
  await touch('touchEnd', []);
  await sleep(150);
  assert.deepEqual(await ev(() => [window.__ELEMENTA__.controls.moveX, window.__ELEMENTA__.controls.moveY]), [0, 0]);
  step('joystick de visée : relâcher = tirer, en multi-touch');

  // Tap à droite = tir à visée automatique
  await sleep(700);
  const p3 = await player();
  await page.touchscreen.tap(hud.aim.x - 10, hud.aim.y - 150);
  await sleep(150);
  assert.ok((await player()).ammo < p3.ammo - 0.5, 'un tap tire (visée automatique)');
  step('tap = tir automatique');

  // Super : tap sur le bouton
  await ev(() => {
    window.__ELEMENTA__.match.player.superCharge = 1;
  });
  await sleep(100);
  await page.touchscreen.tap(hud.superBtn.x, hud.superBtn.y);
  await sleep(200);
  assert.ok((await player()).superCharge < 0.5, 'le super est consommé');
  step('bouton SUPER');

  // Fusion : un allié prêt juste à côté
  const fusionSeen = ev(
    () =>
      new Promise((resolve) => {
        const gs = window.__ELEMENTA__.game.scene.getScene('Game');
        const on = (e) => {
          if (e.type !== 'fusion') return;
          gs.events.off('fx', on);
          resolve(e.name);
        };
        gs.events.on('fx', on);
      }),
  );
  await ev(() => {
    const m = window.__ELEMENTA__.match;
    const p = m.player;
    const a = m.fighters[1];
    if (!a.alive) m.respawn(a);
    a.x = a.px = p.x - 110;
    a.y = a.py = p.y;
    a.invulnT = 5;
    a.superCharge = 1;
    p.superCharge = 1;
  });
  await sleep(250);
  const partner = await ev(() => {
    const h = window.__ELEMENTA__.game.scene.getScene('Hud');
    return h.fusionPartner && h.fusionPartner.charId;
  });
  assert.ok(partner, 'le bouton FUSION est disponible');
  await page.touchscreen.tap(hud.fusionBtn.x, hud.fusionBtn.y);
  const fusionName = await Promise.race([fusionSeen, sleep(3000).then(() => null)]);
  assert.ok(fusionName, 'la fusion se déclenche');
  await sleep(100);
  assert.ok((await player()).superCharge < 0.5, 'la fusion consomme le super');
  step(`bouton FUSION → « ${fusionName} » avec ${partner}`);

  // Pause / reprise
  await page.touchscreen.tap(hud.pauseBtn.x + 19, hud.pauseBtn.y + 17);
  await sleep(250);
  assert.equal(await ev(() => window.__ELEMENTA__.game.scene.getScene('Game').paused), true);
  const t1 = await ev(() => window.__ELEMENTA__.match.time);
  await sleep(400);
  assert.equal(await ev(() => window.__ELEMENTA__.match.time), t1, 'le temps est figé en pause');
  const resume = await ev(() => {
    const r = window.__ELEMENTA__.game.scene.getScene('Hud').pauseButtons[0];
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  });
  await page.touchscreen.tap(resume.x, resume.y);
  await sleep(250);
  assert.equal(await ev(() => window.__ELEMENTA__.game.scene.getScene('Game').paused), false);
  step('pause et reprise');

  // Portrait : message de rotation + pause automatique
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(700);
  assert.equal(await ev(() => getComputedStyle(document.getElementById('rotate')).display), 'flex');
  assert.equal(await ev(() => window.__ELEMENTA__.game.scene.getScene('Game').paused), true);
  await page.setViewportSize({ width: 844, height: 390 });
  await sleep(700);
  assert.equal(await ev(() => getComputedStyle(document.getElementById('rotate')).display), 'none');
  assert.equal(await ev(() => window.__ELEMENTA__.game.canvas.style.width), '844px');
  await ev(() => window.__ELEMENTA__.game.scene.getScene('Game').setPaused(false));
  step('portrait → message de rotation et pause ; retour en paysage');

  // ── Fin de match : victoire ──
  const beforeWin = await profile();
  await ev(() => window.__ELEMENTA__.match.finish(0, 'hold'));
  await page.waitForFunction(() => window.__ELEMENTA__.game.scene.isActive('Result'), null, { timeout: 8000 });
  await ready('Result');
  assert.deepEqual(await scenes(), ['Result']);
  const win = await ev(() => window.__ELEMENTA__.game.scene.getScene('Result').sceneData);
  assert.equal(win.outcome, 'win');
  assert.equal(win.rewards.trophies.delta, 8, 'une victoire rapporte 8 trophées');
  assert.ok(win.rewards.coins.delta >= 24, 'une victoire rapporte des pièces');
  const afterWin = await saved();
  assert.equal(afterWin.chars.alize.trophies, 8, 'trophées sauvegardés');
  assert.ok(afterWin.coins >= beforeWin.coins + 24, 'pièces sauvegardées');
  assert.equal(afterWin.stats.wins, 1);
  step(`écran de victoire : +${win.rewards.trophies.delta} trophées, +${win.rewards.coins.delta} pièces, +${win.rewards.xp.gained} XP`);

  await tap('Result', 'continue');
  await ready('Home');
  assert.deepEqual(await scenes(), ['Home']);
  step('CONTINUER ramène à l’accueil');

  // La progression survit à un rechargement de la page, et l'aide ne revient pas
  await page.reload();
  await page.waitForFunction(() => window.__ELEMENTA__ && window.__ELEMENTA__.game.isBooted, null, { timeout: 20000 });
  await ready('Home');
  await sleep(700);
  assert.equal(await popupOpen(), false, 'l’aide ne se rouvre pas');
  assert.deepEqual(await profile(), afterWin, 'profil identique après rechargement');
  step('progression conservée après rechargement');

  // ── Défaite, puis REJOUER ──
  await tap('Home', 'play');
  await page.waitForFunction(() => window.__ELEMENTA__.match && window.__ELEMENTA__.match.phase === 'playing', null, { timeout: 15000 });
  await ev(() => window.__ELEMENTA__.match.finish(1, 'hold'));
  await page.waitForFunction(() => window.__ELEMENTA__.game.scene.isActive('Result'), null, { timeout: 8000 });
  await ready('Result');
  const lose = await ev(() => window.__ELEMENTA__.game.scene.getScene('Result').sceneData);
  assert.equal(lose.outcome, 'lose');
  assert.ok(lose.rewards.trophies.delta < 0, 'une défaite coûte des trophées');
  assert.ok(lose.rewards.coins.delta > 0, 'une défaite rapporte quand même quelques pièces');
  assert.equal((await saved()).chars.alize.trophies, 8 + lose.rewards.trophies.delta);
  step(`écran de défaite : ${lose.rewards.trophies.delta} trophées, +${lose.rewards.coins.delta} pièces`);
  await tap('Result', 'replay');
  await page.waitForFunction(() => window.__ELEMENTA__.game.scene.isActive('Hud'), null, { timeout: 8000 });
  assert.deepEqual(await scenes(), ['Game', 'Hud']);
  step('REJOUER relance un match');

  assert.deepEqual(errors, [], 'aucune erreur JavaScript');
  await browser.close();
}

console.log(`ÉLÉMENTA — test de bout en bout sur ${BASE}`);
main()
  .then(() => console.log('Tout est bon ✔'))
  .catch((err) => {
    console.error('ÉCHEC ✘', err);
    process.exit(1);
  });
