# ÉLÉMENTA

Brawler élémentaire **3 contre 3** vu de dessus, pensé pour mobile (paysage, plein écran, tactile).
Jeu web en JavaScript avec **Phaser 3**, installable sur l'écran d'accueil (PWA) et optimisé pour iPhone.

> Personnages cartoon animés, décor peint, particules par élément, musique et bruitages :
> **tout est original et fabriqué par le code** (aucun fichier image ni audio). Les personnages, le décor et les
> icônes du menu sont dessinés au démarrage (Canvas 2D), la musique est composée et jouée en direct (Web Audio).

Autour des matchs : un **menu de jeu mobile complet** (accueil, personnages, boutique, pass de saison,
classement) et une **progression sauvegardée sur le téléphone** — trophées, pièces, gemmes, niveaux.

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
| **Braz** | Feu | Attaquant | 3600 | 215 | 6,6 cases | *Salve ardente* — 3 boules de feu en éventail | *Boule de magma* — explose et laisse un brasier |
| **Ondine** | Eau | Soutien | 3300 | 215 | 8,4 cases | *Trait d'eau* — traverse les ennemis | *Source vive* — zone qui soigne les alliés et ralentit les ennemis |
| **Dolmen** | Terre | Tank | 5200 | 190 | 3,7 cases | *Éclats de roc* — 5 éclats à courte portée | *Charge de granit* — fonce, étourdit et se protège |
| **Volta** | Foudre | Tireuse | 2800 | 235 | 9,1 cases | *Arc voltaïque* — éclair qui rebondit sur un 2ᵉ ennemi | *Coup de tonnerre* — rayon instantané qui transperce et étourdit |
| **Alizé** | Vent | Éclaireuse | 3000 | 250 | 7,0 cases | *Lames de vent* — 2 lames rapides | *Bourrasque* — repousse, dissipe les tirs et accélère |

À quoi ils ressemblent : **Braz**, petit forgeron à la chevelure de flammes et son canon à braises ; **Ondine**,
esprit des sources à la capuche en goutte d'eau, avec son bâton de corail ; **Dolmen**, golem de pierre moussue
aux poings énormes ; **Volta**, inventrice aux cheveux en éclairs et lunettes d'aviatrice ; **Alizé**, coursière
du vent à la longue écharpe, armée d'un éventail.

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

Astuce : un combattant dont le super est prêt est entouré d'un **anneau doré**. Quand ton super est prêt,
un allié prêt lui aussi vient vers toi et garde son super quelques secondes ; un trait relie vos deux
personnages et devient lumineux dès que vous êtes assez proches. Les bots (alliés entre eux, et ennemis)
déclenchent aussi leurs propres fusions.

### Événements de l'arène vivante

| Événement | Effet |
|---|---|
| **Coulée de lave** | Quelques petites flaques s'embrasent (elles clignotent d'abord) et brûlent ceux qui marchent dessus |
| **Brouillard** | Vision réduite à un cercle autour de soi (les porteurs de cristaux restent visibles) |
| **Murs mobiles** | Des murs coulissent le long des rails en pointillés |
| **Orage** | La foudre tombe dans des cercles annoncés une seconde avant |

---

## Menu et progression

Tout se gagne **en jouant** : il n'y a aucun achat en argent réel.

### L'accueil

- **Au centre** : ton personnage, en grand et animé, sur un fond aux couleurs de son élément.
  Les flèches changent de personnage ; le toucher ouvre sa fiche.
- **En haut à gauche** : ton profil (pseudo, niveau, barre d'XP) et tes trophées.
  Toucher le profil ouvre les réglages (pseudo, sons, musique, aide, remise à zéro).
- **En haut à droite** : tes pièces et tes gemmes (le **+** mène à la boutique).
- **À gauche** : Boutique, Personnages, Pass de saison, Classement. Une pastille rouge signale
  une récompense à récupérer ou une amélioration possible.
- **En bas** : la **Voie des Cristaux** (paliers de trophées), le **mode de jeu** (toucher pour choisir
  la difficulté des bots) et le gros bouton **JOUER**.

### Ce que rapporte un match

| | Trophées | Pièces | XP | Points de saison |
|---|---|---|---|---|
| Victoire | +8 | +24 | +40 | +30 |
| Égalité | +1 | +12 | +20 | +16 |
| Défaite | −4 (−2 sous 20 trophées) | +8 | +14 | +12 |

- Chaque élimination ajoute **2 pièces** (16 au maximum par match).
- Bots **Normal** : trophées gagnés et pièces ×1,25 ; bots **Difficile** : ×1,5.
- Les trophées sont comptés **par personnage** ; leur total fait avancer la Voie des Cristaux.
- Chaque niveau de joueur gagné rapporte 40 pièces et 2 gemmes.

### Ce qu'on en fait

- **Améliorer un personnage** (niveau 1 à 9, de 80 à 1 250 pièces) : chaque niveau donne
  **+5 % de PV et de dégâts** en match.
- **Voie des Cristaux** : 10 paliers, de 10 à 400 trophées. Un palier atteint reste acquis, même si
  l'on reperd des trophées ensuite.
- **Pass de saison** (« Saison 1 · L'Éveil des Éléments ») : 12 paliers gratuits, un tous les 100 points.
- **Boutique** : un **cadeau gratuit par jour**, deux offres qui changent à minuit, et trois coffres —
  *Coffre d'éveil* (120 pièces, 3 récompenses), *Coffre des marées* (25 gemmes, 5 récompenses),
  *Coffre de fusion* (60 gemmes, 8 récompenses). À l'ouverture, les récompenses sortent une par une.
- **Classement** : pour l'instant ton score est comparé à des **joueurs fictifs** ; le vrai classement
  viendra avec le multijoueur en ligne.

La progression est enregistrée **sur l'appareil** (`localStorage`) : elle survit à la fermeture du jeu et
aux mises à jour, mais ne suit pas d'un téléphone à l'autre, et disparaît si l'on efface les données du site.

---

## Lancer le jeu sur son ordinateur

Il faut [Node.js](https://nodejs.org) 20.19 ou plus récent.

```bash
npm install      # installe Phaser et Vite
npm run dev      # lance le jeu sur http://localhost:5173 (rechargement automatique)
npm test         # tests de la simulation et de la progression (59 tests, ~2 s)
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
| `?debug` | expose `window.__ELEMENTA__` (jeu, match en cours, profil…) dans la console |

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

**Mises à jour** : après un nouveau déploiement, le jeu se recharge tout seul quand tu reviens dans le menu
(jamais en plein match). Si tu vois encore l'ancienne version, ferme complètement l'application
(balaye-la vers le haut dans le sélecteur d'apps) puis rouvre-la.
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
tests/                  tests de la simulation et de la progression (Node), test de bout en bout (navigateur)
src/
├── main.js             démarrage de Phaser
├── config/             ← TOUT L'ÉQUILIBRAGE EST ICI
│   ├── constants.js    durée du match, cristaux, réapparition, portée de fusion…
│   ├── characters.js   les 5 personnages (PV, vitesse, attaque, super)
│   ├── fusions.js      la table des 10 fusions
│   ├── arenaEvents.js  les événements de l'arène vivante
│   ├── maps.js         la carte (dessinée en ASCII, symétrique)
│   ├── elements.js     couleurs des éléments et des équipes
│   └── meta.js         l'économie : récompenses de match, coûts, Voie des Cristaux, pass, coffres, offres
├── meta/
│   └── profile.js      LE PROFIL DU JOUEUR — JavaScript pur : monnaies, trophées, niveaux, sauvegarde
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
├── art/                LES DESSINS, faits par le code (Canvas 2D)
│   ├── characterArt.js les 5 personnages, en pièces séparées (tête, corps, arme…)
│   ├── mapArt.js       sol (herbe, dallage, fleurs), murs de pierre, buissons
│   ├── fxArt.js        particules, projectiles, emblèmes des éléments, cristal
│   └── uiArt.js        icônes du menu : pièce, gemme, trophée, coffres…
├── scenes/             écrans Phaser du match : Boot, Game, Hud, Result (fin de match)
│   └── menu/           écrans du menu : Home (accueil), Chars, Shop, Chest (ouverture de coffre),
│                       Track (Voie des Cristaux et pass), Ranks — et MenuBase, leur socle commun
├── render/             affichage de la simulation
│   ├── CharacterRig.js pantin animé : marche, tir, clignement, mort…
│   ├── Effects.js      particules par élément, ondes de choc, animation de fusion
│   └── …               arène, combattants, projectiles, zones
├── ui/                 écran (zones sûres, redimensionnement), thème,
│                       kit.js (gros boutons, panneaux, barres, pastilles du menu)
├── audio/              Sfx.js (bruitages) et Music.js (musique), synthétisés
└── pwa/                service worker (hors ligne, mises à jour)
```

### Deux couches bien séparées

- **`src/sim/`** contient toutes les règles. Elle n'utilise pas Phaser, avance par **pas fixes de 1/60 s**
  et tire tous ses nombres aléatoires d'une **graine** : un match est rejouable à l'identique.
  C'est ce qui permet de la tester sous Node (`npm test`) et ce qui servira de base au
  **multijoueur en ligne** (la même simulation pourra tourner sur un serveur).
- **`src/scenes/` + `src/render/`** ne font qu'afficher l'état de la simulation et lui transmettre
  les commandes du joueur (déplacement, tir, super, fusion).

La progression suit le même principe : **`src/meta/profile.js`** contient toutes les règles (récompenses,
achats, paliers) sans Phaser, donc testables sous Node ; les écrans de `src/scenes/menu/` ne font que
l'afficher. Le jour où il y aura des comptes en ligne, c'est ce fichier qui passera côté serveur.

### Régler le jeu

| Je veux… | Fichier |
|---|---|
| changer les PV / dégâts / vitesse d'un personnage | `src/config/characters.js` |
| modifier une fusion | `src/config/fusions.js` |
| changer la durée du match, le délai de réapparition, l'apparition des cristaux | `src/config/constants.js` |
| redessiner la carte | `src/config/maps.js` (le décor se repeint tout seul) |
| changer l'apparence d'un personnage | `src/art/characterArt.js` |
| régler la caméra (zoom) | `VIEW` dans `src/config/constants.js` |
| modifier la musique | `TRACKS` dans `src/audio/Music.js` |
| rendre les bots plus ou moins forts | `BOT_SKILL` dans `src/sim/BotAI.js` |
| changer les récompenses de match, le prix des améliorations ou des coffres | `src/config/meta.js` |
| modifier les paliers de la Voie des Cristaux ou du pass de saison | `ROAD` et `PASS` dans `src/config/meta.js` |
| redessiner une icône du menu | `src/art/uiArt.js` |

Note de conception : les 3 cristaux apparaissent **l'un après l'autre** (0 s, 20 s, 40 s).
Avec les 3 présents dès le coup d'envoi, l'équipe qui gagnait le premier combat ramassait tout et les matchs
duraient une trentaine de secondes. Pour revenir à ce réglage : `spawnTimes: [0, 0, 0]` dans `constants.js`.

### Tests

- `npm test` — 59 tests. **Simulation** (45) : carte symétrique et sans cul-de-sac, collisions, chaque personnage,
  **chacune des 10 fusions**, cristaux, événements d'arène, matchs complets bots contre bots, déterminisme.
  **Progression** (14) : récompenses de match, niveaux, améliorations, paliers, coffres, offres du jour,
  sauvegarde et relecture d'un profil abîmé.
- `tests/e2e/smoke.cjs` — test de bout en bout dans Chromium (émulation d'un iPhone en paysage, vrais événements
  tactiles) : accueil → fiche d'un personnage → amélioration → boutique → ouverture d'un coffre → match →
  joysticks → fusion → écran de fin (trophées, pièces) → sauvegarde après rechargement. Optionnel, nécessite
  [Playwright](https://playwright.dev) : `npm run build && npm run preview` puis `node tests/e2e/smoke.cjs`.

---

## Et ensuite ?

Idées pour les prochaines étapes : multijoueur en ligne (avec un vrai classement et une progression
liée à un compte), nouveaux modes de jeu, nouvelles cartes, nouveaux personnages à débloquer,
apparences à gagner dans le pass, choix des coéquipiers, tutoriel interactif.
