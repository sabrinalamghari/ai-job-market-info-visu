# Visualisation 3 : compétences selon les métiers

## Objectif

Explorer les compétences mentionnées selon les métiers, leurs recouvrements et leurs spécialisations. La heatmap croise les métiers et les compétences du fichier actif, sans établir un classement des métiers. Le fichier du projet contient 25 métiers et 93 libellés de compétences.

## Données et mesures

Chaque ligne représente un `job_title`, chaque colonne un libellé de `required_skills`. Par défaut, une cellule donne le nombre d’offres du métier mentionnant la compétence, divisé par le nombre total d’offres de ce métier après filtrage. Une offre contribue au maximum une fois à chaque compétence. La somme d’une ligne peut dépasser 100 %, puisqu’une offre mentionne plusieurs compétences.

La couleur bleue utilise une échelle fixe de 0 à 100 %. Le mode « Nombre d’offres » utilise un maximum calculé sur toutes les cellules du fichier complet, conservé pendant le filtrage. Une cellule à zéro indique que des offres existent mais ne mentionnent pas cette compétence. Les hachures indiquent qu’aucune offre du métier ne subsiste : la proportion est indisponible. Leur légende apparaît seulement si nécessaire. Les effectifs figurent dans les libellés des lignes.

Le détail d’une cellule présente jusqu’à huit autres compétences des seules offres du métier mentionnant la compétence sélectionnée. Ce sous-ensemble sert de dénominateur au détail ; il ne remplace pas celui des cellules.

## Filtres et sélections

- Expérience déclarée, pays et secteur filtrent les offres avant les calculs. Les contrôles sont repliés au chargement ; les filtres actifs restent indiqués dans le résumé.
- Les cases métiers et compétences ne contrôlent que les lignes et colonnes visibles. Elles ne changent pas les dénominateurs des cellules conservées.
- Tous les métiers et jusqu’à 20 compétences les plus fréquentes dans le fichier complet sont sélectionnés initialement. Toutes les compétences sont accessibles par recherche et cases à cocher.
- Les colonnes sélectionnées sont conservées pendant le filtrage. « 20 plus fréquentes des métiers affichés » recalcule explicitement cette sélection sur les offres filtrées de ces métiers.
- Un métier coché reste visible même sans offre. Aucun seuil d’effectif ne supprime implicitement une ligne.

## Navigation

Le survol ou le focus affiche le compte, le dénominateur et la proportion. Un clic ou Entrée/Espace conserve le détail sous la matrice. Tab entre dans la matrice, les flèches déplacent le focus et Début/Fin atteignent les extrémités d’une ligne. Échap ferme l’infobulle et le détail depuis la matrice ; le bouton de fermeture rend le focus à la cellule consultée.

Des contours discrets repèrent la ligne et la colonne consultées, avec leurs libellés mis en évidence, sans modifier la couleur des cellules. Les changements explicites de tri déplacent ensemble cellules et libellés en 260 ms. Les filtres, sélections et changements de mesure restent immédiats. Le mouvement est désactivé avec la préférence système de réduction des animations ou au-delà de 5 000 cellules ; une interaction clavier pendant le mouvement termine immédiatement le placement pour garder la navigation précise.

La matrice défile dans son conteneur en gardant les en-têtes visibles. Les valeurs sont accessibles au survol, au focus et dans le détail d’une cellule. « Affichage et tri », replié sous la matrice et sans encadré, réunit la mesure, les deux tris et la réinitialisation. Les ordres alphabétique, par fréquence ou par similarité changent la disposition sans modifier les valeurs. La réinitialisation restaure les sélections et ordres initiaux, le mode pourcentage et efface les filtres.

## Points de lecture

- Les libellés de compétences restent distincts : `Cloud` et `Cloud (AWS/GCP/Azure)` ne sont pas fusionnés. Une mention ne mesure ni la maîtrise ni le caractère obligatoire d’une compétence.
- Un petit nombre d’offres peut produire une proportion élevée. Le compte et le dénominateur doivent être lus ensemble.
- Le tri par similarité est un rapprochement visuel déterministe, pas un regroupement statistique. Il part du premier élément alphabétique, puis choisit le plus proche du précédent par distance euclidienne entre proportions. Les lignes utilisent les compétences affichées ; les colonnes, les métiers affichés ayant des offres. Les lignes sans offre vont à la fin ; les égalités sont départagées alphabétiquement.
- Le détail des compétences associées décrit une cooccurrence dans les offres sélectionnées, pas une relation causale.

## Implémentation

La page, les styles, le script et l’aperçu sont dans `visualizations/visualization-3/`. Le script sépare les calculs purs (`HeatmapData`) du rendu DOM/D3, comme la visualisation 2. Les contrôles sont locaux et appliquent les filtres avec `JobApp.setFilters()` ; les offres arrivent via `JobApp.subscribe()`. D3 gère les jointures SVG et l’échelle séquentielle ; le placement des cellules suit une grille calculée dans le script.

Le cadre est réservé à la matrice défilante. Les menus et les listes de choix restent organisés par leurs libellés et leurs espacements, sans encadrés supplémentaires. L’instruction de sélection des cellules reste disponible pour les technologies d’assistance.

Le fichier actif est choisi sur l’accueil et partagé par les quatre pages. Les métiers, compétences et maxima sont reconstruits à partir de cette source. Le chargement et la préparation communs sont décrits dans [Transformation des données](transformation-donnees.md). L’aperçu de l’accueil est illustratif et ne change pas avec le fichier choisi.
