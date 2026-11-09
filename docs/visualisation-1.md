# Visualisation 1 : carte des offres

## Objectif

Explorer la répartition des offres par pays et ville, puis examiner les profils des lieux sélectionnés. Les offres sans localisation géographique restent consultables séparément.

## Données et mesures

Les offres sont regroupées par couple pays/ville. Les pays en vert possèdent des offres retenues ; leur couleur ne représente pas un volume. Le rayon des cercles suit une échelle en racine carrée, calculée sur le fichier complet. Un rayon minimal de 5 px assure leur visibilité : les plus petits cercles ne permettent donc pas une comparaison strictement proportionnelle des surfaces. Le nombre inscrit donne l’effectif exact.

Le panneau de détails porte sur la ville, le pays ou les offres non localisées. Il présente les effectifs, leur part dans les offres filtrées, les salaires moyen et médian, les proportions `is_remote_friendly` et `is_senior`, les années d’expérience moyennes, les quatre métiers les plus représentés et la répartition des niveaux d’expérience. Les salaires non positifs sont exclus de ces statistiques de salaire.

## Filtres et sélections

- Secteur, catégorie, intitulé, salaire annuel minimum et télétravail filtrent les offres avant le calcul des effectifs et des détails.
- Le télétravail utilise `is_remote_friendly`, qui couvre aussi les offres hybrides dans ce fichier.
- Les menus pays et continent servent à naviguer par zoom. Le choix d’un pays ouvre aussi ses détails ; il ne filtre pas l’ensemble des offres.
- « Effacer les filtres de la carte » remet les filtres locaux à leur valeur initiale, sans changer le fichier source.

## Navigation

Le survol affiche le nom et l’effectif d’une ville. Un clic sur une ville ou un pays ouvre ses détails. La molette, le déplacement et les gestes tactiles permettent de naviguer. La loupe possède trois modes, accessibles par le bouton ou la touche `L` : automatique sur les zones denses, toujours active ou désactivée. Elle disparaît à partir du niveau de zoom prévu pour lire les villes directement.

Un clic sur le fond ou Échap dans la carte efface la sélection, sans revenir au zoom mondial. Le clic droit ou « Vue mondiale » rétablit le cadrage mondial. Le tableau dépliable donne les effectifs par pays et ville, y compris ceux qui ne peuvent pas être positionnés. Les cercles des villes sont également accessibles au clavier.

## Points de lecture

- `Global` décrit une localisation, pas un mode de travail. Le panneau non localisé rassemble les offres `Global`, les villes `Remote` et les offres sans localisation géographique exploitable.
- Le nombre d’offres hybrides ou à distance repose sur `is_remote_friendly`, y compris dans les offres non localisées. Il ne mesure pas le télétravail intégral.
- « Métiers les plus représentés » correspond au nombre d’offres, pas au champ `demand_score`.
- Le compteur en haut de page donne le nombre d’offres après les filtres de la carte, y compris les offres non positionnées. Un zoom ou la sélection d’un pays ou d’une ville ne change pas ce compteur. Le résumé sous la carte distingue les offres positionnées et non positionnées.
- Les villes absentes de la table locale de coordonnées restent dans les totaux et le tableau, sans cercle. Le fond géographique peut omettre de très petits pays.

## Implémentation

La page, les styles, le script et l’aperçu sont dans `visualizations/visualization-1/`. Le script reçoit les offres via `JobApp.subscribe()` et gère ses filtres localement. D3 assure la projection rectangulaire (`geoEquirectangular`), les tracés géographiques, le zoom, l’échelle des rayons, les regroupements et les jointures SVG. Les coordonnées des villes sont définies dans `cityCoordinates` ; le fond est `data/world-countries.geojson`.

La carte délimite elle-même sa zone de dessin. Les détails se prolongent sous le graphique, avec une liste de mesures et deux répartitions, sans cartes de statistiques imbriquées. Le type de lieu et les actions sont indiqués par le titre et les contrôles, sans badge supplémentaire.

Le fichier actif est choisi sur l’accueil et partagé par les quatre pages. L’import n’ajoute pas de coordonnées : une nouvelle ville reste dans les comptes et le tableau si elle est absente de `cityCoordinates`. Le chargement et la préparation communs sont décrits dans [Transformation des données](transformation-donnees.md). L’aperçu de l’accueil est illustratif et ne change pas avec le fichier choisi.
