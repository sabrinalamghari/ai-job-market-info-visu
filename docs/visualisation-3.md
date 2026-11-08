# Visualisation 3 : compétences selon les métiers

## Objectif

La heatmap croise les métiers et les compétences mentionnées dans les offres. Elle permet d’explorer des profils, des recouvrements et des spécialisations, sans attribuer de valeur ou de classement aux métiers. Le fichier fourni contient 25 métiers et 93 libellés de compétences.

## Architecture

La page suit la structure de la visualisation 2 : une page HTML autonome, une feuille CSS locale et un script comprenant les calculs purs (`HeatmapData`, exportable avec Node) puis le composant DOM/D3. Elle charge D3 localement, `js/data.js`, `js/app.js`, puis son script avec `defer`. Aucun paquet supplémentaire n’est nécessaire.

`JobApp.subscribe()` transmet les offres préparées et filtrées. `JobData` a déjà converti `required_skills` en liste sans doublons. La heatmap ne relit pas le CSV et ne modifie pas les offres. Elle construit localement ses trois contrôles de filtre et appelle `JobApp.setFilters()` ; leurs styles restent dans `visualization-3.css`. Elle ne modifie ni le générateur de contrôles de `app.js` ni les styles de la visualisation 2. Les filtres et sélections sont en mémoire sur cette page uniquement.

## Mesure

Chaque ligne représente un `job_title` ; chaque colonne un libellé de `required_skills`.

La mesure par défaut est : **nombre d’offres du métier mentionnant la compétence / nombre total d’offres du métier après filtrage**. Une offre contribue au maximum une fois à une compétence. La somme des proportions d’une ligne peut dépasser 100 %, puisqu’une offre mentionne plusieurs compétences.

L’échelle séquentielle bleue reste fixe de 0 à 100 %. Le mode alternatif « Nombre d’offres » utilise un maximum calculé sur toutes les cellules du fichier complet, conservé pendant le filtrage. Une cellule claire à 0 % signifie que des offres sont disponibles mais ne mentionnent pas cette compétence. Une cellule hachurée signifie qu’aucune offre du métier ne subsiste après filtrage : la proportion est indisponible. L’explication des hachures apparaît uniquement si des métiers affichés sont dans ce cas. L’effectif est indiqué dans le libellé de chaque ligne.

Les libellés restent ceux du CSV : `Cloud` et `Cloud (AWS/GCP/Azure)`, par exemple, ne sont pas fusionnés. Une mention ne donne ni un niveau de maîtrise ni un caractère obligatoire. Les proportions décrivent les offres sélectionnées, pas les personnes occupant ces métiers.

## Filtres et sélections

- « Filtrer les offres », replié au chargement, regroupe le niveau d’expérience déclaré (`experience_level`), le pays et le secteur. Ces contrôles filtrent les offres via `JobApp` **avant** le calcul des comptes et proportions. Le résumé indique le nombre de filtres actifs ; leurs valeurs restent visibles à côté des effectifs quand le panneau est fermé.
- Les cases métiers et compétences contrôlent seulement les lignes et colonnes affichées. Elles ne filtrent pas les offres et ne changent donc pas les dénominateurs des cellules conservées.
- Initialement, les 25 métiers et les 20 compétences les plus fréquentes dans le fichier complet sont sélectionnés. Les choix de colonnes sont conservés après changement des filtres pour permettre des comparaisons stables.
- Toutes les compétences restent accessibles dans les options, par recherche et cases à cocher. « 20 plus fréquentes des métiers affichés » recalcule explicitement la sélection de colonnes à partir des offres filtrées de ces métiers. Cette action donne accès aux compétences spécialisées lorsque les métiers sont sélectionnés.
- Un métier sans offre est conservé si sa ligne est cochée. Les états sans ligne, sans colonne ou sans offre affichent un message adapté. Aucun seuil ne supprime implicitement les petits effectifs.

## Navigation

Le graphique est visible directement sous deux panneaux repliés : « Filtrer les offres » et « Métiers et compétences ». Le mode de mesure, les tris, la réinitialisation et l’aide au clavier sont réunis sous la matrice dans « Options de lecture et aide », également replié. La légende reste visible pour expliquer la couleur sans ouvrir de contrôle. Les libellés des lignes utilisent « 57 offres », sans notation statistique abrégée.

Les lignes sont initialement alphabétiques ; les colonnes sont ordonnées par nombre d’offres mentionnant la compétence dans les métiers affichés. L’ordre peut être alphabétique, par fréquence ou par similarité. Ces changements n’affectent pas les valeurs.

Le tri par similarité part du premier élément alphabétique disponible puis choisit successivement le plus proche du précédent par distance euclidienne entre vecteurs de proportions. Les lignes utilisent les compétences affichées ; les colonnes utilisent les métiers affichés ayant des offres. Les lignes sans offre sont placées à la fin. Les égalités sont résolues par l’ordre alphabétique. Il s’agit d’un rapprochement visuel déterministe, pas d’un clustering statistique ni d’une équivalence professionnelle.

Le survol et le focus affichent le compte, le dénominateur et la proportion dans une seule infobulle personnalisée, ancrée à côté de la cellule et repositionnée selon l’espace disponible. Le SVG conserve un nom accessible (`aria-label`) mais pas de `<title>` natif, afin de ne pas déclencher une deuxième infobulle par-dessus celle de la cellule. L’infobulle a le rôle `tooltip`, est associée à la cellule avec `aria-describedby`, peut être survolée et se ferme avec Échap. Un clic ou Entrée/Espace conserve le détail sous la matrice et ferme l’infobulle. Ce détail donne jusqu’à huit autres compétences des **seules offres du métier mentionnant la compétence sélectionnée**, avec ce sous-ensemble comme dénominateur ; il ne remplace pas les valeurs de la matrice. Il est recalculé après filtrage et fermé si sa ligne ou sa colonne est masquée.

Tab entre dans la matrice ; les flèches déplacent le focus de cellule en cellule, Début/Fin atteignent les extrémités d’une ligne. Le déplacement garde la cellule visible sous les en-têtes fixes et repositionne son infobulle après défilement. Une infobulle fermée avec Échap reste fermée lors du défilement. Le bouton « Fermer le détail » rend le focus à la cellule consultée. Échap ferme le détail et l’infobulle depuis la matrice. Un tableau dépliable expose toutes les valeurs affichées. La matrice conserve des cellules de taille lisible et défile dans son conteneur sur les petits écrans. Les noms des métiers restent fixes pendant le défilement horizontal et les compétences pendant le défilement vertical. La marge droite du SVG tient compte de l’encombrement réel des libellés inclinés pour ne pas couper la dernière compétence. Sur mobile, les intitulés longs des lignes sont raccourcis ; le libellé complet reste accessible dans les cellules et le tableau.

« Réinitialiser la vue et les filtres » restaure les sélections initiales, les ordres initiaux, le mode pourcentage et efface les filtres. L’aperçu SVG de l’accueil est statique et utilise un extrait des valeurs réelles du fichier.

## Vérification

`npm test` vérifie les comptes et dénominateurs, la déduplication, la distinction zéro/absence, les tris sans mutation et des valeurs connues du CSV après passage par la préparation commune.
