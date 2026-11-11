# ÉLÉMENTA

Brawler élémentaire **3 contre 3** vu de dessus, pensé pour mobile (paysage, plein écran, tactile).
Jeu web en JavaScript avec **Phaser 3**, installable sur l'écran d'accueil (PWA) et optimisé pour iPhone.

> Prototype jouable — personnages en formes géométriques, bots pour alliés et ennemis.
> Tout est original : noms, personnages, visuels (dessinés par le code) et sons (synthétisés par le code).

---

## Le jeu en bref

- **Matchs de 2 minutes**, 3 contre 3, vue du dessus.
- **Mode « Cristal d'élément »** : 3 cristaux apparaissent au centre (à 0 s, 20 s et 40 s).
  L'équipe qui porte les 3 cristaux pendant **15 secondes** gagne. Au bout de 2 minutes, l'équipe qui en porte le plus l'emporte
  (puis le nombre d'éliminations, sinon égalité).
- **Porter un cristal** : +10 % de dégâts et le super se charge tout seul… mais le porteur est **visible de tous**
  (même caché dans un buisson ou dans le brouillard) et lâche ses cristaux en mourant.
- **Buissons** : on y est invisible pour l'ennemi, sauf de très près ou juste après avoir tiré / été touché.
- **FUSION** : quand ton super et celui d'un coéquipier sont chargés et que vous êtes proches, le bouton FUSION s'allume.
  Il consomme les deux supers et déclenche un combo qui dépend des deux éléments (voir la table).
- **ARÈNE VIVANTE** : toutes les 30 s, un événement aléatoire (annoncé 3 s avant, actif 20 s) transforme la carte.

### Commandes

| | Tactile | Ordinateur |
|---|---|---|
| Se déplacer | Joystick gauche (apparaît sous le pouce) | ZQSD / WASD / flèches |
| Viser et tirer | Joystick droit : **relâcher = tirer**. Simple tap = tir à visée automatique. Revenir au centre = annuler | Viser à la souris, cliquer pour tirer |
| Super | Bouton SUPER : tap = visée auto, glisser = viser puis relâcher | Espace (vers le curseur) |
| Fusion | Bouton FUSION (allumé quand elle est possible) | F |
| Pause | Bouton en haut à gauche | Échap |

### Les 5 personnages

| Personnage | Élément | Rôle | PV | Vitesse | Portée | Attaque | Super |
|---|---|---|---|---|---|---|---|
| **Braz** ▲ | Feu | Attaquant | 3600 | 215 | 6,6 cases | *Salve ardente* — 3 boules de feu en éventail | *Boule de magma* — explose et laisse un brasier |
| **Ondine** ● | Eau | Soutien | 3300 | 215 | 8,4 cases | *Trait d'eau* — traverse les ennemis | *Source vive* — zone qui soigne les alliés et ralentit les ennemis |
| **Dolmen** ■ | Terre | Tank | 5200 | 190 | 3,7 cases | *Éclats de roc* — 5 éclats à courte portée | *Charge de granit* — fonce, étourdit et se protège |
| **Volta** ◆ | Foudre | Tireuse | 2800 | 235 | 9,1 cases | *Arc voltaïque* — éclair qui rebondit sur un 2ᵉ ennemi | *Coup de tonnerre* — rayon instantané qui transperce et étourdit |
| **Alizé** ⬟ | Vent | Éclaireuse | 3000 | 250 | 7,0 cases | *Lames de vent* — 2 lames rapides | *Bourrasque* — repousse, dissipe les tirs et accélère |

### Table des fusions (les 10 paires)

| Éléments | Fusion | Effet |
|---|---|---|
| Feu + Eau | **Nuage de vapeur** | Nuage brûlant : les ennemis à l'intérieur sont **aveuglés** |
| Terre + Foudre | **Séisme** | Onde de choc autour du lanceur : dégâts + **étourdissement** |
| Vent + Feu | **Tornade de flammes** | Tornade **mobile** qui pourchasse les ennemis |
| Feu + Terre | **Éruption** | Pluie de roches en fusion qui laissent des flaques de lave |
| Feu + Foudre | **Orage de plasma** | Deux couronnes d'orbes perçants dans toutes les directions |
| Eau + Terre | **Marécage** | Immobilise puis ralentit fortement les ennemis |
| Eau + Foudre | **Marée électrique** | Nappe électrifiée : lourds dégâts continus |
| Eau + Vent | **Blizzard** | Ralentit, puis **gèle** ceux qui restent dedans |
| Terre + Vent | **Tempête de sable** | Suit le lanceur : **camoufle** les alliés, blesse les ennemis |
| Foudre + Vent | **Cyclone** | **Aspire** les ennemis vers son centre, puis les foudroie |

### Événements de l'arène vivante

| Événement | Effet |
|---|---|
| **Coulée de lave** | Des cases s'embrasent (elles clignotent d'abord) et brûlent ceux qui marchent dessus |
| **Brouillard** | Vision réduite à un cercle autour de soi (les porteurs de cristaux restent visibles) |
| **Murs mobiles** | Des murs coulissent le long des rails en pointillés |
| **Orage** | La foudre tombe dans des cercles annoncés une seconde avant |

---

## Lancer le jeu sur son ordinateur

Il faut [Node.js](https://nodejs.org) 20.19 ou plus récent.

```bash
npm install      # installe Phaser et Vite
npm run dev      # lance le jeu sur http://localhost:5173 (rechargement automatique)
npm test         # tests de la simulation (44 tests, ~2 s)
npm run build    # construit la version de production dans dist/
npm run preview  # sert dist/ en local (pour tester la PWA / le hors-ligne)
```

Astuce : `npm run dev` affiche aussi une adresse « Network » (ex. `http://192.168.1.20:5173`) :
ouvre-la sur ton téléphone connecté au même Wi-Fi pour tester en tactile.

Paramètres d'adresse utiles pour tester :

| Paramètre | Effet |
|---|---|
| `?play=volta` | lance directement un match avec ce personnage (`braz`, `ondine`, `dolmen`, `volta`, `alize`) |
| `?difficulty=facile` | `facile`, `normal` ou `difficile` (avec `?play`) |
| `?notch=1` | simule l'encoche / Dynamic Island d'un iPhone tenu en paysage |
| `?debug` | expose `window.__ELEMENTA__` (jeu, match en cours…) dans la console |

---

## Mettre en ligne sur Vercel

Le dépôt est prêt : `vercel.json` indique à Vercel comment construire le jeu (Vite → dossier `dist`).

1. Va sur [vercel.com](https://vercel.com) et connecte-toi **avec ton compte GitHub**.
2. Clique sur **Add New… → Project**, puis **Import** en face du dépôt `Ka-s-ne-`
   (si tu ne le vois pas : *Adjust GitHub App Permissions* et autorise ce dépôt).
3. Vercel détecte **Vite** tout seul. Ne change rien et clique sur **Deploy**.
4. Au bout d'une minute environ tu obtiens une adresse du type `https://ka-s-ne.vercel.app`.

Ensuite, **chaque `git push`** sur la branche de production redéploie le jeu automatiquement.
La branche de production se choisit dans *Settings → Environments → Production → Branch Tracking*
(par défaut Vercel prend `main` ; s'il n'y en a pas, la branche par défaut du dépôt).

## Y jouer depuis un iPhone

1. Ouvre l'adresse Vercel dans **Safari**.
2. Touche le bouton **Partager** (le carré avec une flèche vers le haut).
3. Choisis **« Sur l'écran d'accueil »**, puis **Ajouter**.
4. Lance ÉLÉMENTA depuis la nouvelle icône : le jeu s'ouvre **en plein écran**, sans barre d'adresse.
5. Tiens le téléphone **en paysage** (si le verrouillage de rotation est activé dans le centre de contrôle, désactive-le).

Une fois ouvert une première fois, le jeu fonctionne aussi **hors ligne**.
Sur Android (Chrome) : menu ⋮ → *Installer l'application* / *Ajouter à l'écran d'accueil*.

Ce qui est géré pour l'iPhone :

- plein écran en mode application (`apple-mobile-web-app-capable`, manifest `display: fullscreen`) ;
- **encoche / Dynamic Island / barre d'accueil** : le décor passe dessous, mais joysticks, boutons et textes
  restent dans la zone sûre (`viewport-fit=cover` + `env(safe-area-inset-*)`) ;
- **ni zoom ni défilement** : pincement, double-tap, rebond élastique, sélection de texte et menu d'appui long sont neutralisés ;
- multi-touch (bouger + viser + bouton en même temps), rendu net sur écran Retina (densité plafonnée à ×2 pour la fluidité) ;
- message « tourne ton téléphone » et pause automatique en portrait ; pause quand on quitte l'application ;
- le son démarre au premier toucher (exigence d'iOS).

---

## Organisation du code

```
index.html              page unique (balises iPhone/PWA, styles anti-zoom/anti-défilement)
vite.config.js          build + génération du service worker
vercel.json             configuration du déploiement
public/                 manifest de la PWA et icônes
scripts/                outil de génération des icônes
tests/                  tests de la simulation (Node) et test de bout en bout (navigateur)
src/
├── main.js             démarrage de Phaser
├── config/             ← TOUT L'ÉQUILIBRAGE EST ICI
│   ├── constants.js    durée du match, cristaux, réapparition, portée de fusion…
│   ├── characters.js   les 5 personnages (PV, vitesse, attaque, super)
│   ├── fusions.js      la table des 10 fusions
│   ├── arenaEvents.js  les événements de l'arène vivante
│   ├── maps.js         la carte (dessinée en ASCII, symétrique)
│   └── elements.js     couleurs des éléments et des équipes
├── sim/                LA SIMULATION — JavaScript pur, sans Phaser
│   ├── Match.js        boucle de jeu, dégâts, vision, victoire
│   ├── Arena.js        grille, collisions, lancers de rayon, lave, murs mobiles
│   ├── abilities.js    attaques de base et supers
│   ├── fusionEffects.js  les 10 fusions
│   ├── entities.js     projectiles, zones d'effet, frappes annoncées
│   ├── CrystalMode.js  règles du mode « Cristal d'élément »
│   ├── ArenaDirector.js  déroulement des événements d'arène
│   ├── BotAI.js        intelligence des bots (3 niveaux)
│   └── pathfinding.js  recherche de chemin A*
├── scenes/             écrans Phaser : Boot, Menu, Game, Hud, Result
├── render/             affichage de la simulation (arène, combattants, effets)
├── ui/                 écran (zones sûres, redimensionnement), boutons, thème
├── audio/Sfx.js        sons synthétisés (Web Audio)
└── pwa/                service worker (hors ligne)
```

### Deux couches bien séparées

- **`src/sim/`** contient toutes les règles. Elle n'utilise pas Phaser, avance par **pas fixes de 1/60 s**
  et tire tous ses nombres aléatoires d'une **graine** : un match est rejouable à l'identique.
  C'est ce qui permet de la tester sous Node (`npm test`) et ce qui servira de base au
  **multijoueur en ligne** (la même simulation pourra tourner sur un serveur).
- **`src/scenes/` + `src/render/`** ne font qu'afficher l'état de la simulation et lui transmettre
  les commandes du joueur (déplacement, tir, super, fusion).

### Régler le jeu

| Je veux… | Fichier |
|---|---|
| changer les PV / dégâts / vitesse d'un personnage | `src/config/characters.js` |
| modifier une fusion | `src/config/fusions.js` |
| changer la durée du match, le délai de réapparition, l'apparition des cristaux | `src/config/constants.js` |
| redessiner la carte | `src/config/maps.js` |
| rendre les bots plus ou moins forts | `BOT_SKILL` dans `src/sim/BotAI.js` |

Note de conception : les 3 cristaux apparaissent **l'un après l'autre** (0 s, 20 s, 40 s).
Avec les 3 présents dès le coup d'envoi, l'équipe qui gagnait le premier combat ramassait tout et les matchs
duraient une trentaine de secondes. Pour revenir à ce réglage : `spawnTimes: [0, 0, 0]` dans `constants.js`.

### Tests

- `npm test` — 44 tests de la simulation : carte symétrique et sans cul-de-sac, collisions, chaque personnage,
  **chacune des 10 fusions**, cristaux, événements d'arène, matchs complets bots contre bots, déterminisme.
- `tests/e2e/smoke.cjs` — test de bout en bout dans Chromium (émulation d'un iPhone en paysage, vrais événements
  tactiles) : menu → match → joysticks → fusion → écran de résultat. Optionnel, nécessite
  [Playwright](https://playwright.dev) : `npm run build && npm run preview` puis `node tests/e2e/smoke.cjs`.

---

## Et ensuite ?

Idées pour les prochaines étapes : multijoueur en ligne, vrais graphismes et animations, nouvelles cartes,
progression (niveaux, déblocages), choix des coéquipiers, tutoriel interactif.
