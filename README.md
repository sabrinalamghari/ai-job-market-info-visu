# AI Job Market Info Visu

Site d’exploration du marché de l’emploi en intelligence artificielle à partir du fichier fourni pour 2025–2026 : 1 500 offres, 25 métiers et 93 compétences.

## Démarrage

Depuis la racine du projet :

```sh
npm install
npm start
```

Ouvrir http://localhost:3000 et choisir une visualisation. Sous PowerShell, utiliser `npm.cmd install` et `npm.cmd start` si la politique d’exécution bloque `npm.ps1`.

Après installation des dépendances, un serveur statique fonctionne aussi :

```sh
python -m http.server 8000
```

Ouvrir alors http://localhost:8000. Le CSV, D3 et le fond de carte sont servis localement. Les pages doivent être ouvertes via HTTP pour charger les données.

## Visualisations

| Page | Ce qu’elle permet d’explorer | Documentation |
| --- | --- | --- |
| Carte | Répartition géographique des offres et détails des pays et villes | [Visualisation 1](docs/visualisation-1.md) |
| Coordonnées parallèles | Profils des métiers sur six indicateurs et comparaison entre métiers | [Visualisation 2](docs/visualisation-2.md) |
| Heatmap | Compétences mentionnées selon les métiers et associations entre compétences | [Visualisation 3](docs/visualisation-3.md) |
| Treemap | Poids des métiers et regroupement des offres par catégorie | [Visualisation 4](docs/visualisation-4.md) |

Les quatre pages utilisent le CSV choisi sur l’accueil. Par défaut, il s’agit de `data/ai_jobs_market_2025_2026.csv`. L’accueil permet d’importer un CSV compatible et de revenir au fichier du projet. Le fichier importé reste dans le stockage local du navigateur, sans envoi au serveur, et est utilisé lors du chargement des quatre pages. Les chiffres de l’accueil reflètent ce fichier ; les aperçus restent illustratifs.

Chaque page conserve ses filtres et sélections dans son propre état en mémoire ; ils ne persistent pas lors de la navigation entre les pages. Les notices décrivent les mesures, le périmètre des filtres et les points de lecture. La [préparation commune des données](docs/transformation-donnees.md) décrit le format d’import, ses limites, les conversions et les contrôles, qui ne suppriment aucune offre d’un fichier accepté.

## Architecture

```text
.
├── index.html                         # Accueil et liens vers les quatre pages
├── css/
│   ├── favicon.svg                    # Icône du site
│   └── styles.css                     # Styles communs et responsive
├── data/
│   ├── ai_jobs_market_2025_2026.csv    # Source par défaut des quatre visualisations
│   └── world-countries.geojson        # Fond de carte local
├── js/
│   ├── app.js                         # État et filtres communs aux visualisations
│   ├── dataset.js                     # Lecture, validation et stockage du CSV choisi
│   ├── home.js                        # Import et résumé sur l’accueil
│   └── data.js                        # Préparation et contrôles du CSV
├── visualizations/
│   ├── visualization-1/               # Carte
│   ├── visualization-2/               # Coordonnées parallèles
│   ├── visualization-3/               # Heatmap
│   └── visualization-4/               # Treemap
├── docs/                              # Préparation commune et quatre notices
├── server.js                          # Serveur Express
├── package.json                       # Dépendances et commande de démarrage
└── package-lock.json                  # Versions exactes des dépendances
```

Chaque dossier de visualisation contient une page HTML, une feuille CSS, un script et un aperçu SVG statique. L’accueil ne charge aucun script de visualisation. Chaque page reçoit les offres via `JobApp.subscribe()`, puis calcule et dessine sa représentation avec D3. Les visualisations 2 et 3 séparent leurs calculs purs du rendu ; les fonctions de la carte et de la treemap restent dans leurs composants locaux.

Les aperçus de l’accueil ne changent pas avec les filtres ou un import. Ils illustrent les représentations, sans prétendre décrire le fichier choisi.

## Ajouter une visualisation

1. Créer un dossier sous `visualizations/` avec une page HTML, une feuille CSS, un script et un aperçu SVG.
2. Charger avec `defer`, dans l’ordre, D3, `js/data.js`, `js/dataset.js`, `js/app.js`, puis le script de la visualisation. Inclure l’élément `data-status` utilisé par `app.js`.
3. Recevoir les offres avec `JobApp.subscribe()` et placer les calculs, styles et interactions propres à la vue dans son dossier.
4. Ajouter le lien et l’aperçu sur l’accueil, un lien de retour dans la page et une notice suivant la structure des quatre notices existantes.

Les chemins du CSV et du fond de carte sont résolus depuis leurs scripts avec `new URL()`.

## Dépendances

D3 et Express sont déclarés dans `package.json`, avec leurs versions exactes dans `package-lock.json`. `npm install` les installe dans `node_modules`, exclu de Git. Le navigateur charge `node_modules/d3/dist/d3.min.js` ; Express expose ce fichier par une route dédiée. La licence de D3 est dans `node_modules/d3/LICENSE`. Aucun CDN ni outil de compilation n’est nécessaire.
