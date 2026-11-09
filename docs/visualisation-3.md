# Visualisation 3 : compétences selon les métiers

## Objectif

Explorer les compétences mentionnées selon les métiers, leurs recouvrements et leurs spécialisations. La heatmap croise les 25 métiers et les 93 libellés de compétences du fichier, sans établir un classement des métiers.

## Données et mesures

Chaque ligne représente un `job_title`, chaque colonne un libellé de `required_skills`. Par défaut, une cellule donne le nombre d’offres du métier mentionnant la compétence, divisé par le nombre total d’offres de ce métier après filtrage. Une offre contribue au maximum une fois à chaque compétence. La somme d’une ligne peut dépasser 100 %, puisqu’une offre mentionne plusieurs compétences.

La couleur bleue utilise une échelle fixe de 0 à 100 %. Le mode « Nombre d’offres » utilise un maximum calculé sur toutes les cellules du fichier complet, conservé pendant le filtrage. Une cellule à zéro indique que des offres existent mais ne mentionnent pas cette compétence. Les hachures indiquent qu’aucune offre du métier ne subsiste : la proportion est indisponible. Leur légende apparaît seulement si nécessaire. Les effectifs figurent dans les libellés des lignes.

Le détail d’une cellule présente jusqu’à huit autres compétences des seules offres du métier mentionnant la compétence sélectionnée. Ce sous-ensemble sert de dénominateur au détail ; il ne remplace pas celui des cellules.

## Filtres et sélections

- Expérience déclarée, pays et secteur filtrent les offres avant les calculs. Le panneau est replié au chargement ; les filtres actifs restent indiqués dans le résumé.
- Les cases métiers et compétences ne contrôlent que les lignes et colonnes visibles. Elles ne changent pas les dénominateurs des cellules conservées.
- Les 25 métiers et les 20 compétences les plus fréquentes dans le fichier complet sont sélectionnés initialement. Toutes les compétences sont accessibles par recherche et cases à cocher.
- Les colonnes sélectionnées sont conservées pendant le filtrage. « 20 plus fréquentes des métiers affichés » recalcule explicitement cette sélection sur les offres filtrées de ces métiers.
- Un métier coché reste visible même sans offre. Aucun seuil d’effectif ne supprime implicitement une ligne.

## Navigation

Le survol ou le focus affiche le compte, le dénominateur et la proportion. Un clic ou Entrée/Espace conserve le détail sous la matrice. Tab entre dans la matrice, les flèches déplacent le focus et Début/Fin atteignent les extrémités d’une ligne. Échap ferme l’infobulle et le détail depuis la matrice ; le bouton de fermeture rend le focus à la cellule consultée.

La matrice défile dans son conteneur en gardant les en-têtes visibles. Les valeurs sont accessibles au survol, au focus et dans le détail d’une cellule. « Options de lecture et aide » regroupe les modes de mesure et les tris. Les ordres alphabétique, par fréquence ou par similarité changent la disposition sans modifier les valeurs. La réinitialisation restaure les sélections et ordres initiaux, le mode pourcentage et efface les filtres.

## Points de lecture

- Les libellés de compétences restent distincts : `Cloud` et `Cloud (AWS/GCP/Azure)` ne sont pas fusionnés. Une mention ne mesure ni la maîtrise ni le caractère obligatoire d’une compétence.
- Un petit nombre d’offres peut produire une proportion élevée. Le compte et le dénominateur doivent être lus ensemble.
- Le tri par similarité est un rapprochement visuel déterministe, pas un regroupement statistique. Il part du premier élément alphabétique, puis choisit le plus proche du précédent par distance euclidienne entre proportions. Les lignes utilisent les compétences affichées ; les colonnes, les métiers affichés ayant des offres. Les lignes sans offre vont à la fin ; les égalités sont départagées alphabétiquement.
- Le détail des compétences associées décrit une cooccurrence dans les offres sélectionnées, pas une relation causale.

## Implémentation

La page, les styles, le script et l’aperçu sont dans `visualizations/visualization-3/`. Le script sépare les calculs purs (`HeatmapData`) du rendu DOM/D3, comme la visualisation 2. Les contrôles sont locaux et appliquent les filtres avec `JobApp.setFilters()` ; les offres arrivent via `JobApp.subscribe()`. D3 gère les jointures SVG et l’échelle séquentielle ; le placement des cellules suit une grille calculée dans le script.

Le chargement et la préparation communs sont décrits dans [Transformation des données](transformation-donnees.md). L’aperçu de l’accueil est un SVG statique utilisant un extrait des valeurs du fichier.
