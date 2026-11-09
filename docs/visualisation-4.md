# Visualisation 4 : treemap des métiers

## Objectif

Comparer le poids des métiers dans les offres et explorer leur répartition par catégorie. La surface des rectangles représente le nombre d’offres ; les bandeaux identifient les catégories.

## Données et mesures

Les offres sont regroupées par `job_category`, puis par `job_title`. Dans le fichier fourni, chaque métier appartient à une seule catégorie. Les volumes sont additionnés du métier vers sa catégorie, puis vers l’ensemble affiché.

Par défaut, tous les rectangles ont la même couleur verte. Deux mesures peuvent être ajoutées par la couleur : le salaire annuel médian (`annual_salary_usd`) ou la croissance médiane de la demande (`demand_growth_yoy_pct`). Les médianes portent sur les valeurs numériques disponibles dans les offres retenues. Une valeur indisponible apparaît en gris.

Les échelles de couleur sont calculées sur le fichier complet et restent fixes pendant le filtrage. L’infobulle donne le nombre d’offres, leur part dans l’ensemble affiché et, lorsque pertinent, leur part dans la catégorie, ainsi que les deux médianes.

## Filtres et sélections

- Expérience déclarée, pays, mode de travail et taille d’entreprise filtrent les offres avant le regroupement et le calcul des médianes.
- Le menu « Catégorie affichée » ou un clic sur un métier ou un bandeau ouvre cette catégorie. Les parts sont alors rapportées à cette catégorie.
- « Regrouper par catégorie » modifie la disposition : décoché, les métiers sont présentés à plat, sans bandeaux. Les offres retenues restent les mêmes.
- Le choix de couleur change la mesure colorée, jamais la mesure de surface.

## Navigation

Le survol ou le focus clavier ouvre l’infobulle. Entrée/Espace permet d’ouvrir une catégorie depuis un métier ; « Toutes les catégories » ou Échap revient à l’ensemble. Un tableau dépliable donne les catégories, métiers, effectifs, parts et salaires médians visibles.

Les étiquettes sont raccourcies ou masquées lorsqu’elles ne tiennent pas dans un rectangle. Les informations complètes restent dans l’infobulle et le tableau. Le découpage s’adapte à la largeur du conteneur. Les transitions sont désactivées si le système demande de réduire les animations.

## Points de lecture

- Une grande catégorie peut regrouper plusieurs métiers : sa surface ne décrit pas la fréquence d’un métier unique.
- `Hybrid` et `Fully Remote` sont deux choix distincts du filtre de mode de travail. `Global`, dans le filtre pays, ne signifie pas automatiquement télétravail intégral.
- Les surfaces comparent des volumes ; les couleurs comparent des médianes. Les espaces et bandeaux réduisent la précision d’une comparaison visuelle des surfaces : les effectifs donnent les valeurs exactes.
- La croissance provient du champ fourni dans chaque offre. Elle n’est pas recalculée à partir des dates du fichier ; la visualisation 2 en montre une moyenne, et celle-ci une médiane.
- Le compteur en haut de page donne le nombre d’offres après les filtres locaux. Ouvrir une catégorie ne change pas ce compteur ; le résumé de la treemap indique le nombre d’offres de la catégorie affichée.

## Implémentation

La page, les styles, le script et l’aperçu sont dans `visualizations/visualization-4/`. Le script reçoit les offres via `JobApp.subscribe()` et applique ses filtres localement. D3 construit la hiérarchie avec `group` et `hierarchy`, calcule le découpage avec `treemap` et `treemapSquarify`, puis gère les jointures, transitions et échelles séquentielles. Un `ResizeObserver` déclenche le recalcul à la largeur disponible.

Le fichier actif est choisi sur l’accueil et partagé par les quatre pages. La hiérarchie, les menus et les domaines de couleur sont reconstruits à partir de cette source. Le chargement et la préparation communs sont décrits dans [Transformation des données](transformation-donnees.md). L’aperçu de l’accueil est illustratif et ne change pas avec le fichier choisi.
