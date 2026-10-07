# À quoi sert `data.js` ?

`js/data.js` prépare les données du CSV pour les graphiques. Les valeurs lues dans un CSV sont des textes : il faut convertir certaines d'entre elles pour pouvoir calculer, trier et filtrer correctement.

## Les transformations principales

| Avant | Après | Pourquoi ? |
| --- | --- | --- |
| `"239000"` | `239000` | Utiliser le salaire comme un nombre pour les calculs |
| `"7"` | `7` | Comparer les années d'expérience comme des nombres |
| `"1"` ou `"0"` | `true` ou `false` | Utiliser les indicateurs senior, télétravail et LLM comme des booléens |
| `" Paris "` | `"Paris"` | Retirer les espaces inutiles autour des textes |
| `"Python\|SQL\|Python"` | `["Python", "SQL"]` | Obtenir un tableau de compétences sans doublons |

## Les vérifications

Le code vérifie que les 25 colonnes attendues existent. S'il en manque, il renvoie une erreur avec leurs noms.

Il signale aussi les problèmes rencontrés, par exemple :

- un profil « débutant, 0–2 ans » associé à 7 ans d'expérience ;
- un salaire annuel hors de la fourchette indiquée ;
- une localisation « Remote » associée au travail sur site ;
- un identifiant répété.

Ces incohérences sont conservées et signalées : le code ne décide pas arbitrairement quelle valeur corriger et ne supprime aucune ligne.

## Les informations ajoutées

Chaque ligne reçoit trois champs utiles :

- `posting_period` : l'année et le mois réunis, par exemple `"2026-03"` ;
- `has_geographic_location` : indique si ville et pays sont renseignés et différents de « Remote » et « Global », sans vérifier les coordonnées ;
- `issues` : la liste des problèmes repérés sur cette ligne.

## Comment utiliser le résultat ?

`transformJob()` prépare une ligne. `prepareData()` prépare toutes les lignes et renvoie :

```js
const { jobs, quality } = JobData.prepareData(rows);
```

- `rows` : les lignes brutes déjà lues depuis le CSV ;
- `jobs` : les lignes préparées pour les graphiques ;
- `quality` : le nombre de lignes et le bilan des problèmes détectés.

**Le CSV original reste intact.** La préparation crée de nouveaux objets en mémoire. `data.js` prépare les valeurs ; les calculs propres aux graphiques restent dans les scripts de visualisation.

## Chargement commun entre toutes les visualisations

`server.js` sert la page et D3 installé avec npm. Pour lancer le projet : `npm install`, puis `npm start`, et ouvrir http://localhost:3000.

`js/app.js` charge le CSV une seule fois, appelle `JobData.prepareData()` et transmet le résultat aux quatre visualisations. Le sélecteur de fichier permet de changer de CSV ; un fichier incompatible est signalé et les données précédentes sont conservées.

Chaque graphique reçoit les données au chargement et après chaque changement de filtre :

```js
JobApp.subscribe(({ filteredJobs, jobs, quality, filters }) => {
});
```

`jobs` contient toutes les lignes préparées ; `filteredJobs` contient celles qui correspondent aux filtres. Une sélection peut appeler `JobApp.setFilters({ country: "France" })` pour actualiser tous les graphiques, et `JobApp.resetFilters()` efface les filtres. Les filtres disponibles sont `job_category`, `experience_level`, `country` et `remote_work`.
