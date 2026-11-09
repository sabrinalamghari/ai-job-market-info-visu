# Transformation et chargement des données

## Source et périmètre

Par défaut, les quatre pages utilisent le fichier local `data/ai_jobs_market_2025_2026.csv`, qui contient 1 500 offres, 25 métiers et 93 libellés de compétences distincts après déduplication au sein des offres. Un CSV externe compatible peut être choisi sur l’accueil et remplace cette source pour les quatre visualisations.

Chaque page charge le fichier actif une fois et conserve son propre état en mémoire. Les filtres et sélections ne sont pas transférés lors d’un changement de page. Un onglet déjà ouvert doit être rechargé pour prendre en compte un changement effectué ailleurs. Les aperçus SVG de l’accueil sont statiques et signalés comme illustratifs ; ils ne changent pas avec la source.

## Import depuis l’accueil

« Changer de fichier CSV » permet de choisir un fichier `.csv` UTF-8, avec ou sans BOM, séparé par des virgules, des points-virgules ou des tabulations. L’aide « Format et limites » apparaît au survol ou au focus clavier, et au toucher sur écran tactile ; Échap ou un clic extérieur la ferme. Les champs contenant le séparateur doivent être entourés de guillemets doubles selon le format CSV. Les compétences restent séparées par `|` à l’intérieur du champ `required_skills`.

Les 25 colonnes suivantes doivent être présentes, avec ces noms exacts, dans un ordre quelconque :

```text
job_id, job_title, job_category, experience_level, education_required,
city, country, remote_work, company_size, industry, required_skills,
salary_tier, years_of_experience, annual_salary_usd, salary_min_usd,
salary_max_usd, ai_salary_premium_pct, demand_score, demand_growth_yoy_pct,
benefits_score_10, posting_year, posting_month, is_senior,
is_remote_friendly, is_llm_role
```

Les noms de colonnes doivent être non vides et uniques. Les colonnes supplémentaires sont tolérées et ignorées par la préparation. Chaque ligne doit avoir le même nombre de champs que l’en-tête et renseigner `job_title` et `job_category`. Un fichier sans offre est refusé. Pour garder un affichage praticable, l’import est limité à 5 Mo, 20 000 offres, 200 métiers et 300 compétences distinctes.

Les nombres utilisent un point décimal, sans symbole monétaire. Les booléens attendent `1` ou `0`. Pour conserver le sens des indicateurs, les niveaux d’expérience reconnus sont `Entry (0-2 yrs)`, `Mid (3-5 yrs)`, `Senior (6-9 yrs)`, `Lead (10+ yrs)` ; les modes de travail sont `On-site`, `Hybrid`, `Fully Remote`. Les valeurs manquantes ou incohérentes hors contraintes structurelles sont signalées par les contrôles communs, sans correction arbitraire. Un fichier accepté peut donc donner des mesures indisponibles, notamment dans les coordonnées parallèles si les profils sont incomplets.

`js/dataset.js` valide et prépare le CSV avant de le conserver dans IndexedDB. Une erreur de validation ou d’écriture conserve le fichier actif précédent. Le contenu n’est jamais envoyé au serveur et ne remplace pas le CSV du dépôt. Il reste disponible entre les pages et après rechargement sur la même origine (protocole, hôte et port), jusqu’au retour au fichier du projet ou à la suppression du stockage du site. Changer de port ou de navigateur ne transfère pas ce choix.

Le bouton de retour au fichier du projet vérifie d’abord que celui-ci est lisible, puis supprime le CSV importé. En cas de stockage inaccessible ou de fichier conservé incompatible, les pages utilisent le fichier du projet avec un message explicite. La source active est indiquée sur l’accueil, accessible depuis chaque visualisation par « Toutes les visualisations ». Les limites particulières restent celles des représentations : la carte ne positionne que les villes connues de sa table locale ; les catégories inconnues rejoignent « Autres métiers » dans le regroupement en familles.

## Préparation commune

`js/data.js` vérifie la présence des 25 colonnes attendues. Une colonne absente provoque une erreur explicite. `JobData.prepareData(rows)` renvoie les offres préparées (`jobs`) et un bilan de qualité (`quality`).

| Valeur du CSV | Valeur préparée | Utilisation |
| --- | --- | --- |
| `"239000"` | `239000` | Calculs numériques de salaire |
| `"7"` | `7` | Calculs sur les années d’expérience |
| `"1"` ou `"0"` | `true` ou `false` | Indicateurs senior, télétravail et LLM |
| `" Paris "` | `"Paris"` | Textes sans espaces périphériques |
| `"Python\|SQL\|Python"` | `["Python", "SQL"]` | Liste de compétences sans doublons |

Un nombre vide ou non fini devient `null`. Un booléen différent de `"1"` ou `"0"` devient aussi `null`. Les libellés de compétences différents ne sont pas fusionnés.

Quatre champs sont ajoutés :

- `job_family` : regroupement des catégories en cinq familles ; une catégorie non répertoriée devient « Autres métiers » ;
- `posting_period` : année et mois réunis, ou `null` si la période est invalide ;
- `has_geographic_location` : ville et pays renseignés et différents de `Remote` et `Global`, sans vérification des coordonnées ;
- `issues` : liste des anomalies repérées sur l’offre.

## Contrôles et calculs

Les contrôles signalent notamment les valeurs manquantes, les incohérences entre niveau déclaré et années d’expérience, les salaires hors fourchette, les contradictions entre localisation et mode de travail, et les identifiants répétés.

Aucune ligne n’est supprimée et aucune valeur contradictoire n’est choisie arbitrairement comme correction. Le CSV reste intact ; de nouveaux objets sont créés en mémoire. Les règles d’exclusion propres aux mesures restent dans chaque script de visualisation. Une alerte sur une offre peut concerner une colonne inutilisée par une mesure.

Les champs `experience_level` et `years_of_experience` restent distincts. De même, `job_family` est un regroupement dérivé de `job_category`, pas un synonyme. Le drapeau `is_remote_friendly` inclut les hybrides dans ce fichier ; `Global` décrit une localisation et ne garantit pas le télétravail intégral.

## Chargement et API

`js/dataset.js` charge le CSV choisi ou lit le fichier du projet avec `d3.csv()`, puis appelle `JobData.prepareData()`. Il expose `JobDataset.load()`, `JobDataset.importFile(file)` et `JobDataset.reset()`. `js/home.js` pilote le choix depuis l’accueil ; `js/app.js` reçoit les données via `JobDataset.load()` puis transmet l’état aux abonnés. Le chemin du fichier par défaut est résolu depuis le script avec `new URL()`, indépendamment du dossier de la page HTML. L’état inclut `source: { name, imported }` en plus des offres, du bilan et des filtres.

```js
JobApp.subscribe(({ jobs, filteredJobs, quality, filters }) => {
  // Calculs et rendu de la visualisation de cette page.
});
JobApp.setFilters({ country: "France" });
JobApp.resetFilters();
```

`subscribe()` renvoie une fonction de désabonnement. `jobs` contient toutes les offres préparées ; `filteredJobs` contient celles qui correspondent aux filtres communs. L’API accepte les clés `job_category`, `job_family`, `experience_level`, `country`, `remote_work`, `industry`, `company_size` et `education_required`. Une valeur vide désactive le filtre ; les filtres actifs se combinent avec « ET ».

Les visualisations 2 et 3 utilisent ces filtres communs avec des contrôles adaptés à leur page. Les visualisations 1 et 4 appliquent leurs filtres locaux à `filteredJobs`, puis actualisent le compteur avec `JobApp.updateOfferCount(count)`, sans modifier l’état des données. Sur les quatre pages, `data-status` compte les offres retenues après filtrage. Le zoom, les sélections visuelles, les plages sur les profils et l’ouverture d’une catégorie ne changent pas ce compteur ; les résumés locaux précisent le sous-ensemble affiché lorsque nécessaire.

## Organisation et D3

Chaque dossier de visualisation contient sa page HTML, ses styles, son script et son aperçu. Les pages chargent avec `defer`, dans l’ordre : D3, `js/data.js`, `js/dataset.js`, `js/app.js`, puis leur script. `JobData`, `JobDataset` et `JobApp` sont les interfaces partagées. L’accueil utilise `js/home.js` à la place de `js/app.js`. Les calculs et interactions particuliers restent dans les dossiers des visualisations.

| Visualisation | Calcul principal | Rôle de D3 |
| --- | --- | --- |
| Carte | Effectifs par pays et ville | Projection, tracés, zoom, rayons et jointures |
| Coordonnées parallèles | Six indicateurs par métier | Échelles, axes, lignes, plages et glissements |
| Heatmap | Comptes et proportions métier/compétence | Jointures de la matrice et échelle de couleur |
| Treemap | Hiérarchie catégorie/métier, effectifs et médianes | Hiérarchie, découpage, échelles et transitions |

Les modules purs `ParallelData` et `HeatmapData` séparent les calculs du rendu dans les visualisations 2 et 3. La carte et la treemap regroupent leurs fonctions dans leur composant local. Ces différences d’organisation ne changent pas le chargement commun.

Le démarrage et les dépendances sont décrits dans le [README](../README.md). Les quatre notices précisent les mesures, filtres, interactions et points de lecture propres à chaque visualisation : [carte](visualisation-1.md), [coordonnées parallèles](visualisation-2.md), [heatmap](visualisation-3.md), [treemap](visualisation-4.md).
