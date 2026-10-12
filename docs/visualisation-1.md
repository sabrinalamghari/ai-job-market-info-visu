# Comprendre la carte des offres

La carte possède sa propre page dans `visualizations/visualization-1/`. Le fichier `visualization-1.html` contient la structure et les contrôles, `visualization-1.css` les styles de la carte et `visualization-1.js` le dessin D3 et les interactions. Les styles communs restent dans `css/styles.css`.

Pour l’afficher, lance `npm start`, puis ouvre http://localhost:3000 et clique sur « Les offres d’emploi dans le monde ». Un lien sur la page de la carte permet de revenir à l’accueil. Si les dépendances ne sont pas installées, lance d’abord `npm install`. D3 est chargé directement depuis `node_modules/d3/dist/d3.min.js`. Le projet fonctionne aussi avec `python -m http.server 8000` après installation des dépendances npm.

Les liens vers les ressources communes utilisent `../../` depuis cette page. Le CSV et le fond de carte sont résolus avec `new URL(..., document.currentScript.src)` à partir du chemin de leur script, pour que leur chargement fonctionne indépendamment de la profondeur de la page HTML.

## 1. Recevoir les données préparées

`JobApp.subscribe()` reçoit les données déjà transformées par `data.js`. La carte ne relit pas le CSV et ne modifie pas les offres.

- `jobs` sert à construire les choix des menus et les limites du curseur.
- `filteredJobs` sert de point de départ au filtrage de la carte. Une sélection faite par une autre visualisation via `JobApp.setFilters()` est donc respectée.
- Lors du chargement d’un nouveau CSV, les menus, le curseur et les filtres locaux sont réinitialisés.

Le menu « Choisir un pays » contient uniquement les pays présents dans `jobs`, sans doublons. `Global` reste dans son encart, car il ne désigne pas un pays vers lequel zoomer.

Les filtres ajoutés ici sont locaux à la carte. Les filtres communs de `app.js` restent indépendants. Le bouton « Effacer les filtres de la carte » efface seulement les filtres locaux.

## 2. Passer des coordonnées à la carte

Le CSV donne des noms de villes, sans latitude ni longitude. `cityCoordinates` contient donc les coordonnées approximatives des 19 villes du fichier, dans l’ordre `[longitude, latitude]`. La clé associe le pays et la ville, par exemple `France|Paris`, pour éviter de confondre des villes qui auraient le même nom.

`d3.geoEquirectangular()` transforme ces coordonnées en positions `[x, y]` dans le SVG. Cette projection donne une carte rectangulaire. `fitExtent()` ajuste la taille de la planète à l’espace disponible. Le `viewBox` permet au navigateur de redimensionner le SVG selon la largeur de la page.

Le fichier local `data/world-countries.geojson` contient les contours des pays. Il vient du [jeu Natural Earth à l’échelle 1:110 millions](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), dans le [domaine public](https://www.naturalearthdata.com/about/terms-of-use/). Seul le nom de chaque pays est conservé parmi ses propriétés. `d3.geoPath(projection)` transforme chaque contour en tracé SVG.

`countryAliases` rapproche les noms du fond de carte et du CSV : `United States of America` devient `USA`, par exemple.

Les très petits pays comme Singapour n’ont pas de contour dans ce fond à petite échelle. Leur cercle est présent et le menu des pays peut zoomer vers les coordonnées de leurs villes.

## 3. Filtrer et compter dans render()

`render()` est appelée lorsque les données ou un contrôle changent. Elle conserve les offres qui respectent tous les critères choisis :

- `annual_salary_usd` supérieur ou égal au salaire minimum ; à la position initiale, tous les salaires sont acceptés, y compris les valeurs manquantes ;
- le secteur `industry`, la catégorie `job_category` et l’intitulé `job_title` sélectionnés ;
- `is_remote_friendly === true` lorsque la case est cochée.

Cette dernière condition utilise le booléen préparé par `data.js`. Elle inclut les modalités hybrides lorsque leur indicateur vaut `true`. Elle ne se limite pas aux offres `Fully Remote`.

Le curseur règle un seuil de salaire annuel en dollars, par pas de 1 000 dollars. Sa mise à jour est manuelle, sans lecture automatique.

`d3.group()` rassemble les offres par ville. La longueur de chaque groupe donne le nombre d’offres. `d3.rollup()` compte aussi les offres par pays pour colorer les pays ayant au moins une offre.

`d3.scaleSqrt()` transforme les comptes en rayons : la surface d’un cercle dépend du carré de son rayon, donc utiliser une racine carrée rend sa surface proportionnelle au nombre d’offres. Un rayon minimum de 4 unités conserve la visibilité des petits comptes. L’échelle est calculée sur le CSV complet et reste fixe pendant le filtrage pour faciliter la comparaison.

`.data(cities, city => city.key).join(...)` associe chaque ville à son élément SVG. D3 crée les nouveaux cercles, actualise les villes conservées et supprime celles qui n’ont plus d’offres.

Un clic sur un point vert affiche une étiquette à côté avec la ville, le pays et le compte exact. Un deuxième clic sur ce point ou un clic sur le fond la ferme. Le clavier fonctionne aussi : Tab pour sélectionner un point, Entrée ou Espace pour ouvrir son étiquette, Échap pour la fermer. L’étiquette suit le point pendant le zoom et actualise son compte lors du filtrage ; elle disparaît si cette ville n’a plus d’offres.

Les infobulles au survol restent disponibles. À partir d’un zoom ×3, les nombres apparaissent dans les cercles. Le tableau dépliable donne tous les comptes, même si des cercles se chevauchent.

## 4. Zoomer vers une bounding box

Une bounding box est le plus petit rectangle qui contient une forme. `zoomToCountry()` récupère ce rectangle avec `path.bounds()`. Pour un pays composé de plusieurs polygones, le zoom vise la plus grande masse terrestre : par exemple, les États-Unis continentaux.

`zoomToBounds()` calcule le facteur de zoom à partir de la largeur et de la hauteur du rectangle. La valeur `0.85` laisse une marge autour de la forme. Le facteur est limité entre 1 et 20.

```js
d3.zoomIdentity
  .translate(width / 2, height / 2)
  .scale(scale)
  .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
```

Ces opérations placent le centre du rectangle au centre du SVG et agrandissent la carte. `zoom.transform` applique le résultat. Le principe suit l’exemple [Zoom to bounding box de D3](https://observablehq.com/@d3/zoom-to-bounding-box).

Pour les continents, `continentBounds` fournit des rectangles de cadrage de leur zone principale. Ces cadrages évitent les vues trop larges dues aux îles éloignées ou aux territoires traversant le bord du monde. Ils servent uniquement à la navigation et ne filtrent pas les offres.

`d3.zoom()` gère aussi la molette, le déplacement et les gestes tactiles. `updateCityPositions()` applique une échelle inverse `1 / currentZoom.k` aux marqueurs pour conserver leur taille pendant le zoom : leur taille représente les offres, tandis que leur position suit la carte.

## 5. Conserver les offres Global et les lieux inconnus

Les offres dont `country === "Global"` n’ont pas de position géographique précise. Elles apparaissent dans un encart permanent et dans le tableau, avec les mêmes filtres que les autres offres. Elles sont incluses dans le total et restent visibles lorsque la carte est zoomée.

Les autres offres sans coordonnées connues sont signalées et conservées dans le tableau. Si un nouveau CSV contient une nouvelle ville, il suffit d’ajouter sa clé et ses coordonnées à `cityCoordinates` pour la placer sur la carte. `has_geographic_location` vérifie la présence d’un nom de ville et de pays ; il ne remplace pas cette recherche de coordonnées.

Si le fond de carte ne peut pas être chargé, un message l’indique et le tableau reste disponible.
