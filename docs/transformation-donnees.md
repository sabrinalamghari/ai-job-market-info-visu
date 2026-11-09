# Transformation et chargement des données

## Source et périmètre

Les quatre pages utilisent le fichier local `data/ai_jobs_market_2025_2026.csv`, qui contient 1 500 offres, 25 métiers et 93 libellés de compétences distincts après déduplication au sein des offres. Aucun chargement d’un autre CSV n’est proposé.

Chaque page charge ce fichier une fois et conserve son propre état en mémoire. Les filtres et sélections ne sont pas transférés lors d’un changement de page. Les aperçus SVG de l’accueil sont statiques ; une modification du fichier source demande de les vérifier et, si nécessaire, de les mettre à jour séparément.

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

`js/app.js` lit le CSV avec `d3.csv()`, appelle `JobData.prepareData()` puis transmet l’état aux abonnés. Le chemin est résolu depuis le script avec `new URL()`, indépendamment du dossier de la page HTML.

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

Chaque dossier de visualisation contient sa page HTML, ses styles, son script et son aperçu. Les pages chargent avec `defer`, dans l’ordre : D3, `js/data.js`, `js/app.js`, puis leur script. `JobData` et `JobApp` sont les interfaces partagées. Les calculs et interactions particuliers restent dans les dossiers des visualisations.

| Visualisation | Calcul principal | Rôle de D3 |
| --- | --- | --- |
| Carte | Effectifs par pays et ville | Projection, tracés, zoom, rayons et jointures |
| Coordonnées parallèles | Six indicateurs par métier | Échelles, axes, lignes, plages et glissements |
| Heatmap | Comptes et proportions métier/compétence | Jointures de la matrice et échelle de couleur |
| Treemap | Hiérarchie catégorie/métier, effectifs et médianes | Hiérarchie, découpage, échelles et transitions |

Les modules purs `ParallelData` et `HeatmapData` séparent les calculs du rendu dans les visualisations 2 et 3. La carte et la treemap regroupent leurs fonctions dans leur composant local. Ces différences d’organisation ne changent pas le chargement commun.

Le démarrage et les dépendances sont décrits dans le [README](../README.md). Les quatre notices précisent les mesures, filtres, interactions et points de lecture propres à chaque visualisation : [carte](visualisation-1.md), [coordonnées parallèles](visualisation-2.md), [heatmap](visualisation-3.md), [treemap](visualisation-4.md).
