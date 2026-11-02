# Comprendre la treemap des métiers

La treemap possède sa propre page dans `visualizations/visualization-4/`. Le fichier `visualization-4.html` contient la structure et les contrôles, `visualization-4.css` les styles de la treemap et `visualization-4.js` le dessin D3 et les interactions. `preview.svg` est l’aperçu affiché sur la carte de l’accueil.

Pour l’afficher, lance `npm start`, puis ouvre http://localhost:3000 et clique sur « Les métiers de l’IA et de la data ». Si les dépendances ne sont pas installées, lance d’abord `npm install`.

## 1. Ce que montre la treemap

Une treemap découpe un rectangle en rectangles plus petits dont la **surface est proportionnelle à une mesure**. Ici, chaque rectangle est un métier (`job_title`) et sa surface correspond à son nombre d’offres. Les métiers sont regroupés par catégorie (`job_category`) : chaque catégorie forme un bloc avec un bandeau qui indique son nom et son total.

Dans le CSV, chaque métier appartient à une seule catégorie. La hiérarchie est donc simple : racine → catégorie → métier.

Ce que la treemap fait ressortir sur le jeu fourni : les métiers ont des volumes proches (de 46 à 75 offres), mais la catégorie **AI Engineering** regroupe 12 métiers et près de la moitié des offres (736 sur 1 500). Huit catégories ne contiennent qu’un seul métier.

## 2. Recevoir et filtrer les données

`JobApp.subscribe()` reçoit les données déjà transformées par `data.js`. La treemap ne relit pas le CSV.

- `jobs` sert à construire les choix des menus et les échelles de couleur.
- `filteredJobs` sert de point de départ au filtrage local. Une sélection faite via `JobApp.setFilters()` est donc respectée.
- Lors du chargement d’un nouveau CSV, les menus et les filtres locaux sont réinitialisés.

Les filtres locaux portent sur `experience_level`, `country`, `remote_work` et `company_size`. Les modalités ordonnées (niveau d’expérience, mode de travail, taille d’entreprise) sont affichées dans leur ordre naturel et non alphabétique. `years_of_experience` n’est pas utilisé : dans ce CSV, sa médiane vaut 6 ans pour tous les niveaux (voir `docs/transformation-donnees.md`).

## 3. Construire la hiérarchie et le découpage

`buildHierarchy()` regroupe les offres avec `d3.group(jobs, catégorie, métier)`, puis crée l’arbre avec `d3.hierarchy()`. `.sum()` additionne le nombre d’offres de chaque métier pour obtenir la valeur de chaque catégorie et de la racine. `.sort()` place les plus grands rectangles en premier.

`d3.treemap()` calcule ensuite la position `x0, y0, x1, y1` de chaque nœud :

- `d3.treemapSquarify` produit des rectangles proches du carré, plus faciles à comparer ;
- `paddingTop(22)` réserve le bandeau de titre de chaque catégorie ;
- `paddingInner` laisse 6 px entre les catégories et 2 px entre les métiers ;
- `round(true)` arrondit les coordonnées au pixel pour des bords nets.

Le SVG prend la largeur réelle de son conteneur, avec une hauteur égale à 60 % de cette largeur et 360 px au minimum. Un `ResizeObserver` recalcule le découpage quand la largeur change. Le texte garde donc sa taille sur mobile au lieu d’être rétréci.

## 4. Étiquettes et couleurs

Une étiquette n’est affichée que si elle tient dans son rectangle. `fitText()` mesure le texte avec un canvas, le raccourcit avec « … » si nécessaire, et le retire s’il ne reste pas au moins quatre caractères. Les valeurs restent lisibles dans l’infobulle et dans le tableau.

Par défaut, tous les rectangles ont la même couleur verte : la surface est la seule mesure codée. Douze catégories ne peuvent pas recevoir chacune une couleur distincte et lisible, surtout pour les personnes daltoniennes. Le regroupement et les bandeaux identifient donc les catégories.

Le menu « Couleur des rectangles » ajoute une seconde mesure par métier :

- **Salaire annuel médian** (`annual_salary_usd`) ;
- **Croissance médiane de la demande** (`demand_growth_yoy_pct`).

La couleur suit une rampe séquentielle d’une seule teinte, du bleu clair au bleu foncé (`d3.scaleSequential` et `d3.interpolateRgbBasis`). Le domaine de l’échelle est calculé sur le CSV complet et reste fixe pendant le filtrage, pour que les couleurs restent comparables d’une vue à l’autre. Un métier sans valeur apparaît en gris. Le texte passe en blanc sur les rectangles foncés, selon la luminance de la couleur de fond.

## 5. Interactions

- **Survol ou focus clavier** : une infobulle affiche le métier, la catégorie, le nombre d’offres, la part des offres affichées et de la catégorie, le salaire médian et la croissance médiane.
- **Clic sur un métier ou un bandeau** : ouvre la catégorie. La treemap se redessine avec ses seuls métiers, et les parts sont alors calculées par rapport à cette catégorie. Le menu « Catégorie affichée » fait la même chose.
- **Retour** : le bouton « ← Toutes les catégories » ou la touche Échap.
- **Regrouper par catégorie** : décocher la case affiche tous les métiers à plat, sans bandeaux.

Les rectangles sont associés à leur élément SVG avec la clé `catégorie|métier`. D3 déplace donc chaque rectangle vers sa nouvelle position au lieu de le recréer. Les transitions durent 450 ms et sont désactivées si le système demande de réduire les animations.

Le tableau dépliable donne, pour chaque métier visible, la catégorie, le nombre d’offres, la part et le salaire médian. Il sert de version accessible de la treemap.

## 6. L’aperçu de l’accueil

`preview.svg` est une image statique de la treemap groupée, calculée avec le même découpage D3 à partir du CSV fourni. Elle ne change pas si un autre CSV est chargé dans la page.
