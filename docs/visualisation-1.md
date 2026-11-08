# Visualisation 1

## Objectif

Cette visualisation permet d’explorer la répartition géographique des offres
d’emploi en intelligence artificielle. La carte aide à comparer les pays et les
villes, à repérer les principaux pôles d’emploi et à consulter les offres qui ne
sont pas associées à un lieu précis.

La carte utilise un fond géographique et des cercles proportionnels au nombre
d’offres par ville. Les filtres, le zoom et la sélection permettent ensuite
d’examiner les résultats plus précisément.

## Ce que la carte permet de voir

- **Comparer les pays** grâce à la couleur des pays qui possèdent des offres.
- **Comparer les villes** grâce à la taille des cercles.
- **Explorer les zones denses** avec la loupe interactive et les noms des villes.
- **Filtrer les offres** par secteur, catégorie, métier, salaire minimum et
  télétravail.
- **Consulter les détails** d’une ville ou d’un pays sélectionné.
- **Afficher les offres globales** qui ne possèdent pas de localisation précise.

## Données et agrégation

Chaque offre est associée à un pays et, lorsque c’est possible, à une ville.
Les offres sont regroupées par ville pour calculer le nombre affiché dans
chaque cercle. Les pays sont également regroupés afin de colorer la carte.

La taille des cercles utilise une échelle en racine carrée : leur surface reste
proportionnelle au nombre d’offres. L’échelle est calculée sur l’ensemble du
jeu de données afin de conserver une comparaison stable lorsque les filtres
changent.

Les coordonnées des villes sont fournies par une table locale dans
`visualizations/visualization-1/visualization-1.js`. Le fond de carte est le
fichier `data/world-countries.geojson`. Les noms de pays sont rapprochés entre
le CSV et le fond de carte lorsque leur écriture diffère.

## Préparation des données

Le chemin des données est le suivant :

1. `js/app.js` charge le CSV et transmet les données préparées à la carte.
2. `js/data.js` vérifie les colonnes attendues, nettoie les valeurs et convertit
   les nombres et les booléens.
3. La carte construit les listes de filtres et calcule les effectifs visibles.
4. Chaque changement de filtre relance le rendu de la carte et du panneau de
   détails.

Les données importées peuvent être remplacées depuis la barre de contrôle :

- **Importer un CSV** charge un fichier compatible et recalcule la visualisation.
- **Réinitialiser** restaure le fichier `ai_jobs_market_2025_2026.csv`.

Les contrôles de qualité signalent les valeurs manquantes ou invalides sans
supprimer automatiquement les offres.

## Utilisation

- Utilisez les listes et le curseur pour filtrer les offres.
- Cochez le filtre de télétravail pour conserver les offres dont le mode est
  hybride ou entièrement à distance.
- Survolez une ville pour voir son nom et son nombre d’offres.
- Cliquez sur une ville pour afficher sa fiche détaillée.
- Cliquez sur un pays ou choisissez-le dans la liste pour zoomer dessus.
- Utilisez la molette, le déplacement ou les gestes tactiles pour naviguer.
- Cliquez sur le fond, appuyez sur Échap ou faites un clic droit pour revenir à
  la vue mondiale.

La loupe s’active automatiquement au-dessus des zones où les villes sont
proches. Le bouton ou la touche `L` permet de choisir entre les modes
automatique, toujours actif et désactivé. Elle disparaît automatiquement
lorsque le niveau de zoom rend les villes suffisamment lisibles.

## Deux niveaux de visualisation

### Vue d’ensemble

La carte mondiale montre les pays concernés et les volumes par ville. Les
offres `Global`, sans pays ni ville de rattachement, sont présentées dans un
encart séparé et restent incluses dans les totaux et les filtres.

### Détails à la demande

Un clic sur une ville ou un pays met l’élément en évidence et actualise le
panneau de détails. Celui-ci présente notamment :

- le nombre d’offres et sa part dans le marché filtré ;
- les salaires et le taux de télétravail ;
- l’ancienneté ou le niveau d’expérience ;
- les métiers les plus représentés ;
- la répartition des niveaux d’expérience.

Les offres sans coordonnées connues restent visibles dans le tableau. Si une
nouvelle ville doit être affichée sur la carte, ses coordonnées doivent être
ajoutées à `cityCoordinates`.

## Limites des données

- Les offres `Global` ne peuvent pas être positionnées sur la carte.
- Les villes absentes de la table de coordonnées ne sont pas représentées par
  un cercle, mais restent conservées dans le tableau.
- Le fond de carte à petite échelle ne représente pas toujours les très petits
  pays ; leurs villes peuvent néanmoins être affichées.
- Les salaires et les indicateurs dépendent des valeurs présentes dans les
  offres et peuvent contenir des valeurs manquantes ou incohérentes.

## Lancer la visualisation

Depuis la racine du projet :

```sh
npm install
npm start
```

Ouvrez ensuite http://localhost:3000 et sélectionnez « Les offres d’emploi dans
le monde ». Un serveur statique peut aussi être lancé avec
`python -m http.server 8000`.
