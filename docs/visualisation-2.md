# Visualisation 2 : profils des métiers

## Objectif

Comparer les métiers sur six dimensions : accès débutant, salaire, demande, croissance, télétravail et avantages. Les coordonnées parallèles permettent d’examiner les formes des profils, leurs proximités et leurs différences sans réduire la comparaison à une seule mesure.

## Données et mesures

Chaque ligne relie les six indicateurs agrégés d’un intitulé de métier. Le regroupement passe aux familles si le fichier complet contient plus de 40 intitulés, avant tout filtrage.

| Axe | Calcul |
| --- | --- |
| Offres Entry | Offres exactement libellées `Entry (0-2 yrs)` / offres dont le niveau d’expérience est reconnu |
| Salaire médian | Médiane des salaires annuels valides, tous niveaux ou offres Entry selon le mode choisi |
| Demande moyenne | Moyenne de `demand_score` |
| Croissance moyenne | Moyenne de `demand_growth_yoy_pct` |
| Hybrid + Remote | Offres `Hybrid` ou `Fully Remote` / offres dont le mode de travail est reconnu |
| Avantages moyens | Moyenne des valeurs de `benefits_score_10` comprises entre 0 et 10 |

Les calculs portent sur les offres retenues, sauf la référence Entry décrite ci-dessous. Les valeurs manquantes ou invalides sont exclues indicateur par indicateur, sans imputation. Les salaires doivent être numériques et positifs ou nuls ; les autres mesures numériques, hormis les avantages, utilisent les valeurs finies du fichier. Les effectifs valides (`n`) du détail indiquent combien d’offres contribuent à chaque mesure.

Sans filtre actif, un profil doit avoir au moins dix observations valides pour chacun des six indicateurs. Avec des filtres actifs, une observation valide par indicateur suffit. Un profil sans valeur sur un axe ne peut pas être tracé.

## Filtres et sélections

- Famille, expérience déclarée, pays, mode de travail, secteur, taille d’entreprise et formation filtrent les offres avant l’agrégation.
- La part « Offres Entry » ignore uniquement le filtre Expérience ; tous les autres filtres actifs restent appliqués. Elle conserve ainsi une référence sur la part débutante du métier.
- Le mode salaire Entry utilise les seules offres exactement libellées `Entry (0-2 yrs)`, parmi les offres filtrées. Une combinaison incompatible peut rendre le salaire indisponible.
- Les plages tracées sur les axes sélectionnent des profils déjà agrégés. Elles se combinent avec « ET » et ne recalculent pas les indicateurs.
- La couleur identifie la famille. La légende est informative et ne filtre pas les profils.

## Navigation

Le survol donne le métier, ses effectifs et ses valeurs. Un clic sur une ligne ou les sélecteurs permettent d’examiner un métier et de le comparer à un second. Le panneau affiche les valeurs, leurs effectifs et leurs écarts aux références.

Faites glisser sur un axe pour tracer une plage. Un double-clic sur la plage, ou Échap lorsque l’axe est sélectionné, l’efface. L’ordre des axes se change par glissement de leur titre ou au clavier avec les flèches gauche/droite. La réinitialisation restaure l’ordre et efface aussi les filtres de cette page. Le choix « métiers similaires » recherche des profils proches parmi ceux qui passent les plages actives.

## Points de lecture

- « Offres Entry » décrit une part d’annonces, pas une probabilité d’embauche. « Hybrid + Remote » inclut les hybrides et ne mesure pas le télétravail intégral.
- La demande correspond au score fourni dans le fichier, pas au nombre d’offres. La croissance est également un champ fourni, sans recalcul d’évolution à partir des dates.
- Les axes de proportions restent sur 0–100 %. Les autres axes sont recalculés sur les profils admissibles après filtrage : une position visuelle ne se compare donc pas directement entre deux états de filtres différents.
- Les médianes, quartiles et percentiles de référence portent sur les profils admissibles après filtrage, avant les plages. Chaque profil compte comme une observation dans ces références.
- « Forces » et « Compromis » désignent le quart supérieur ou inférieur sur les indicateurs, pas une évaluation absolue d’un métier.
- La similarité repose sur une distance euclidienne normalisée par l’étendue de chaque axe, avec le même poids pour chaque axe variable. Les axes constants sont ignorés, les profils incomplets exclus. Une proximité de forme n’implique pas une équivalence professionnelle.
- Un profil absent peut manquer d’observations valides ; cela ne signifie pas nécessairement zéro offre. Les salaires agrègent aussi des contextes de pays et d’expérience différents.

## Implémentation

La page, les styles, le script et l’aperçu sont dans `visualizations/visualization-2/`. Le script sépare les calculs purs (`ParallelData`) du rendu DOM/D3. Il reçoit les offres via `JobApp.subscribe()` ; `app.js` construit les contrôles de filtres communs de cette page. D3 gère les échelles, axes, lignes, plages (`brushY`), glissements et jointures SVG.

Le chargement et la préparation communs sont décrits dans [Transformation des données](transformation-donnees.md). L’aperçu de l’accueil est un SVG statique schématique, indépendant des filtres.
