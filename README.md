# AI Job Market Info Visu

Page de visualisation du marché de l’emploi en intelligence artificielle en 2025–2026.

La page d’accueil présente les quatre visualisations. Cliquer sur la première carte ouvre la page dédiée aux offres par ville et pays. Les trois autres visualisations restent à compléter.

La première carte affiche en arrière-plan un aperçu SVG local de la carte mondiale et des offres du CSV, dans `visualizations/visualization-1/preview.svg`.

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
│   └── visualization-4.js             # Squelette
├── server.js                          # Serveur Express
├── package.json                       # Dépendances npm
├── package-lock.json                  # Versions exactes des dépendances
└── README.md
```

## Ajouter une visualisation

1. Créer une page HTML et une feuille CSS pour la visualisation dans son dossier sous `visualizations/`, comme pour la carte.
2. Charger D3, `js/data.js`, `js/app.js`, puis le script de la visualisation avec `defer`, dans cet ordre. Inclure les éléments `csv-file` et `data-status` utilisés par `app.js`.
3. Ajouter un lien depuis la carte correspondante dans `index.html`.

L’accueil ne charge aucun script de visualisation. Chaque page charge seulement les ressources dont elle a besoin. Un lien de retour permet de rejoindre l’accueil.

`app.js` charge le CSV et transmet les données préparées via `JobApp.subscribe()`. Les chemins de chargement du CSV et du fond de carte sont calculés depuis les scripts avec `new URL()`. Voir `docs/transformation-donnees.md` et `docs/visualisation-1.md` pour les explications.

## Dépendances

D3 et Express sont déclarés dans `package.json` et leurs versions exactes sont enregistrées dans `package-lock.json`. `npm install` les installe dans `node_modules`, qui reste exclu de Git. Le navigateur charge `node_modules/d3/dist/d3.min.js` ; Express sert uniquement ce fichier de dépendance via une route dédiée. La licence de D3 se trouve dans le paquet installé, à `node_modules/d3/LICENSE`. Aucun CDN ni outil de compilation n’est nécessaire.
