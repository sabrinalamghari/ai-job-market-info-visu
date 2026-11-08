# Visualisation 2
## Objectif

Cette visualisation sert à explorer les compromis entre plusieurs caractéristiques
des métiers dans les données: salaire, demande, croissance,
part d’offres débutantes, télétravail et avantages. Elle peut aider les étudiants,
les personnes en début de carrière ou en reconversion à comparer des pistes
professionnelles.

Le graphique utilise des **coordonnées parallèles** : chaque métier est une ligne
qui relie sa valeur sur six axes. Il est adapté à cette question parce qu’il
permet de repérer d’un coup d’œil des profils aux formes proches, des compromis
et des valeurs qui se distinguent sur plusieurs dimensions. Les filtres et la
sélection permettent ensuite d’examiner ces observations.

## Ce que le graphique permet de voir

- **Comparer la forme des profils** : des lignes proches indiquent des valeurs
  situées à des positions proches dans les distributions affichées.
- **Repérer les compromis** : par exemple, une croissance élevée peut coexister
  avec une faible part d’offres débutantes.
- **Filtrer plusieurs dimensions** : une plage tracée sur un axe sélectionne les
  métiers correspondants ; plusieurs plages se combinent avec « ET ».
- **Examiner et comparer deux métiers** : leurs lignes sont mises en évidence et
  le panneau de détails donne les valeurs, les effectifs et les écarts aux
  médianes.
- **Lire les familles** grâce aux couleurs et à la légende. La légende est
  informative ; cliquer sur une famille ne filtre pas le graphique.
- **Rechercher des métiers au profil proche**: « métiers similaires »
  compare les métiers visibles sur les axes affichés.
- **Réordonner les axes** pour rendre certaines formes ou relations plus faciles
  à observer. Cela ne modifie pas les données.

## Indicateurs et agrégation
Chaque ligne représente un intitulé de métier. Si plus de 40 intitulés sont
présents après agrégation, le graphique regroupe les lignes par famille de
métiers à la place.

| Axe | Calcul pour un métier | À interpréter comme |
| --- | --- | --- |
| **Offres Entry** | Offres libellées exactement `Entry (0-2 yrs)` / offres dont le niveau d’expérience est reconnu | Part des offres déclarées débutantes, et non probabilité d’obtenir un poste |
| **Salaire médian** | Médiane des salaires annuels valides ; au choix, tous niveaux ou offres Entry seulement | Valeur centrale des offres disponibles pour ce métier |
| **Demande moyenne** | Moyenne des valeurs numériques de `demand_score` | Moyenne du score tel qu’il est fourni dans le CSV ; son échelle et sa méthode de calcul ne sont pas documentées ici |
| **Croissance moyenne** | Moyenne des valeurs numériques de `demand_growth_yoy_pct` | Croissance indiquée dans les offres, sans interprétation causale |
| **Hybrid + Remote** | Offres `Hybrid` ou `Fully Remote` / offres au mode de travail reconnu | Part qui n’est pas déclarée `On-site` ; ce n’est pas la part entièrement à distance |
| **Avantages moyens** | Moyenne des valeurs valides de `benefits_score_10` | Score moyen sur 10 tel qu’il est fourni dans le CSV |

Les moyennes et médianes sont calculées **par intitulé**, après application des
filtres. Les valeurs sont calculées à partir des offres ; la médiane ou moyenne
des valeurs individuelles n’est pas remplacée par une estimation. Les effectifs
valides affichés dans les détails (`n`) indiquent combien d’offres contribuent à
chaque indicateur.

### Règles particulières

- Le sélecteur de salaire propose la médiane globale ou la médiane des offres
  Entry. Le mode Entry utilise le libellé exact `Entry (0-2 yrs)`.
- L’indicateur **Offres Entry reste calculé indépendamment du filtre Expérience** :
  changer ce filtre ne transforme pas artificiellement toutes les offres
  affichées en offres débutantes. Les autres filtres actifs continuent de
  s’appliquer à son calcul.
- Les niveaux d’expérience inconnus sont exclus du dénominateur Entry. Les modes
  de travail inconnus sont exclus du dénominateur Hybrid + Remote.
- Un salaire doit être numérique et positif ou nul ; un score d’avantages doit
  être compris entre 0 et 10. Les autres indicateurs numériques utilisent les
  valeurs numériques finies fournies dans le fichier.
- Les valeurs absentes ou invalides sont exclues **indicateur par indicateur**,
  sans imputation. Les effectifs peuvent donc différer d’un axe à l’autre.

## Préparation des données

Le chemin des données est le suivant :

1. `js/app.js` charge le CSV local une fois au démarrage de la page.
2. `js/data.js` vérifie la présence des colonnes attendues, retire les espaces
   superflus, convertit les nombres et booléens et ajoute des informations de
   qualité. Les catégories sont associées à des familles de métiers ; une
   catégorie non répertoriée est rangée dans « Autres métiers ».
3. Les contrôles signalent notamment les valeurs manquantes ou invalides,
   les incompatibilités entre niveau déclaré et années d’expérience, les salaires
   hors de la fourchette annoncée et les identifiants en double.
4. Les filtres (famille, expérience, pays, mode de travail, secteur, taille
   d’entreprise et formation) s’appliquent aux offres avant leur regroupement par
   métier et le calcul des six indicateurs.
5. Les profils admissibles sont dessinés ; les médianes et quartiles de référence
   sont calculés sur ces profils, après filtres et avant les plages tracées sur le
   graphique.

Les anomalies sont signalées, mais les lignes ne sont pas supprimées ni
« corrigées » automatiquement. Chaque agrégation ignore les valeurs invalides
pour l’indicateur concerné. Dans les détails, le nombre d’offres avec au moins
une alerte de qualité est donné à titre de diagnostic : une alerte peut concerner
une colonne qui n’entre pas dans les six indicateurs et ne signifie donc pas que
toutes les mesures de ces offres sont erronées.

Sans filtre actif, un métier n’est affiché que s’il possède au moins dix
observations valides pour chacun des six indicateurs. Avec des filtres actifs, le
seuil d’affichage descend à une observation valide afin d’éviter de masquer tous
les résultats ; les petits effectifs sont signalés et doivent être interprétés
avec prudence. Un indicateur sans aucune valeur valide reste indisponible et le
profil ne peut pas être tracé.

## Comparaisons et références

Les références grisées (médiane et intervalle interquartile Q1–Q3) sont calculées
sur les profils actuellement admissibles, après filtres avancés et avant les
plages. Les détails comparent chaque métier à cette médiane et indiquent son
percentile parmi les profils admissibles. Les percentiles sont des rangs relatifs
dans cet ensemble, pas des probabilités.

« Forces » et « Compromis » désignent les indicateurs situés respectivement dans
le quart supérieur ou inférieur des profils affichés. Ce sont des repères
descriptifs, pas une évaluation absolue de la qualité d’un métier.

Pour les métiers similaires, chaque valeur est ramenée à l’étendue min–max de
son axe dans les profils admissibles. La distance est la racine de la moyenne
des différences normalisées au carré ; chaque axe variable a le même poids et
les axes constants sont ignorés. Les profils incomplets sont exclus. Les
candidats sont limités aux métiers qui passent les plages actives. Une faible
distance signifie une forme de profil proche, pas une équivalence des métiers ni
un classement de qualité.

## Limites des données
- Le contrôle de qualité relève des incohérences dans de nombreuses offres,
  notamment entre le niveau d’expérience et les années déclarées ainsi qu’entre
  le salaire et sa fourchette. Comme les lignes sont conservées, les indicateurs
  calculés peuvent en être affectés.
- Les salaires mélangent pays et niveaux d’expérience ; ils ne constituent pas
  une prévision de salaire d’embauche, en particulier pour un débutant.
- `demand_score`, la croissance et le score d’avantages sont utilisés tels quels :
  le projet ne documente pas leur méthode de production.
- La moyenne peut être sensible aux valeurs extrêmes. La médiane du salaire est
  moins sensible, mais reste affectée par les biais et incohérences des offres.
- La géométrie des lignes dépend de l’ordre des axes. Les croisements de lignes
  sont utiles pour explorer, mais peuvent rendre une grande quantité de profils
  difficile à lire.

## Utilisation

- Survolez une ligne pour voir son métier, son nombre d’offres et ses valeurs.
- Cliquez sur une ligne ou choisissez un métier dans le sélecteur pour afficher
  ses détails ; sélectionnez un second métier pour comparer les deux profils.
- Faites glisser sur un axe pour créer une plage. Les plages de plusieurs axes se
  combinent avec « ET ». Double-cliquez sur une plage ou appuyez sur Échap lorsque
  l’axe est sélectionné pour l’effacer.
- Réordonnez les axes en faisant glisser leur titre ou en le sélectionnant puis
  en utilisant les flèches gauche/droite. Le bouton de réinitialisation restaure
  l’ordre initial.
- Les filtres avancés agissent sur les offres avant l’agrégation. Les plages
  agissent ensuite sur les profils déjà agrégés.