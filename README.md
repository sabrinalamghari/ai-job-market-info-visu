# AI Job Market Info Visu

Page de visualisation du marché de l’emploi en intelligence artificielle en 2025–2026.
La page d’accueil présente les quatre visualisations. La première ouvre la carte des offres par ville et pays, la deuxième les coordonnées parallèles des profils de métiers, et la quatrième la treemap des métiers par catégorie. La visualisation 3 reste à compléter.

Les cartes de la carte mondiale et de la treemap affichent leurs aperçus SVG locaux.

## Démarrage

Depuis la racine du projet, lancer le serveur Express :

```sh
npm install
npm start
```

Ouvrir http://localhost:3000, puis cliquer sur « Les offres d’emploi dans le monde ».

Après `npm install`, un serveur statique Python fonctionne également :

```sh
python -m http.server 8000
```

Ouvrir http://localhost:8000. Le CSV, D3 et le fond de carte sont servis localement. Le chargement des données nécessite HTTP : ouvrir directement le fichier HTML ne suffit pas.

## Arborescence

```text
.
├── index.html                         # Accueil et liens vers les visualisations
├── css/
│   ├── favicon.svg                    # Icône du site
│   └── styles.css                     # Styles communs et responsive
├── data/
│   ├── ai_jobs_market_2025_2026.csv    # Données source
│   └── world-countries.geojson        # Fond de carte local
├── js/
│   ├── app.js                        # Chargement et filtres communs
│   └── data.js                       # Préparation du CSV
├── visualizations/
│   ├── visualization-1/
│   │   ├── visualization-1.html       # Page de la carte
│   │   ├── visualization-1.css        # Styles de la carte
│   │   └── visualization-1.js         # Dessin D3 et interactions
│   ├── visualization-2.js             # Squelette
│   ├── visualization-3.js             # Squelette
│   └── visualization-4/
│       ├── visualization-4.html       # Page de la treemap des métiers
│       ├── visualization-4.css        # Styles de la treemap
│       ├── visualization-4.js         # Dessin D3 et interactions
│       └── preview.svg                # Aperçu pour l’accueil
├── server.js                          # Serveur Express
├── package.json                       # Dépendances npm
├── package-lock.json                  # Versions exactes des dépendances
└── README.md
```

Les tests vérifient l’agrégation des profils, les filtres avant les calculs, les
valeurs incomplètes, la combinaison des plages et la compatibilité du chargement
commun avec la page de la carte.

## Visualisations

- Carte mondiale : zoom, navigation par pays et continent, effectifs par ville,
  filtres métier, secteur, salaire minimum et télétravail.
  [Documentation](docs/visualisation-1.md).
- Coordonnées parallèles : six axes agrégés par métier, filtres famille de métiers,
  expérience, pays et mode de travail, brushing combiné, tooltip et détails.
  [Objectif, traitement des données, interprétation et limites](docs/visualisation-2.md).
- Treemap : répartition des métiers par catégorie.
  [Documentation](docs/visualisation-4.md).

Chaque page charge les données source du projet et possède son état en mémoire.
Les sélections ne persistent pas lors du passage à une autre page. Les profils des coordonnées
parallèles sont recalculés après chaque changement de filtre ; la réinitialisation
efface aussi les filtres de cette page. Le CSV présente des incohérences entre niveaux déclarés et années d’expérience,
documentées avec les métriques.

## Architecture

- `index.html` : accueil sans scripts, liens vers les pages des visualisations.
- `css/styles.css` et `css/favicon.svg` : styles communs et icône du site.
- `data/ai_jobs_market_2025_2026.csv` : données source.
- `data/world-countries.geojson` : fond de carte local.
- `js/data.js` : nettoyage et alertes de qualité ; [explications](docs/transformation-donnees.md).
- `js/app.js` : chargement unique des données source par page et API des filtres.
- `visualizations/visualization-1/` : HTML, CSS, JS et aperçu de la carte.
- `visualizations/visualization-2/` : HTML, CSS, JS et aperçu schématique des coordonnées parallèles.
- `visualizations/visualization-3.js` : squelette à compléter.
- `tests/parallel-data.test.js` : vérification du pipeline et de l’intégration.
- `server.js` : serveur Express, ressources locales et route D3.

La première carte affiche l’aperçu local `visualizations/visualization-1/preview.svg`.

## Ajouter une visualisation

1. Créer un dossier avec une page HTML, une feuille CSS et un script sous `visualizations/`.
2. Charger D3, `js/data.js`, `js/app.js`, puis le composant avec `defer`.
   Inclure l’élément `data-status` utilisé par `app.js`.
3. Ajouter le lien sur l’accueil et un lien de retour sur la nouvelle page.

L’accueil ne charge aucun script de visualisation. Chaque page charge seulement les ressources dont elle a besoin. Un lien de retour permet de rejoindre l’accueil.

`app.js` charge le CSV et transmet les données préparées via `JobApp.subscribe()`. Les chemins de chargement du CSV et du fond de carte sont calculés depuis les scripts avec `new URL()`. Voir `docs/transformation-donnees.md`, `docs/visualisation-1.md` et `docs/visualisation-4.md` pour les explications.

## Dépendances

D3 et Express sont déclarés dans `package.json` et leurs versions exactes sont enregistrées dans `package-lock.json`. `npm install` les installe dans `node_modules`, qui reste exclu de Git. Le navigateur charge `node_modules/d3/dist/d3.min.js` ; Express sert uniquement ce fichier de dépendance via une route dédiée. La licence de D3 se trouve dans le paquet installé, à `node_modules/d3/LICENSE`. Aucun CDN ni outil de compilation n’est nécessaire.
