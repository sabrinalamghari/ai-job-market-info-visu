# AI Job Market Info Visu

Page de visualisation du marché de l’emploi en intelligence artificielle en 2025–2026.

Le projet contient pour le moment une page responsive avec quatre emplacements neutres. Les visualisations et le chargement des données restent à implémenter.

## Démarrage

Ouvrir `index.html` dans un navigateur. Le squelette fonctionne sans installation, compilation ni serveur, avec du HTML, du CSS et du JavaScript natif.

Quand les visualisations chargeront le CSV avec `fetch`, servir le dossier avec un serveur HTTP local. Par exemple, si Python est installé, depuis la racine du projet :

```sh
python -m http.server 8000
```

Puis ouvrir http://localhost:8000.

## Arborescence

```text
.
├── index.html                         # Page et quatre conteneurs
├── css/
│   └── styles.css                     # Styles communs et responsive
├── data/
│   └── ai_jobs_market_2025_2026.csv    # Données source
├── js/
│   └── visualizations/
│       ├── visualization-1.js         # Squelette pour le conteneur 1
│       ├── visualization-2.js         # Squelette pour le conteneur 2
│       ├── visualization-3.js         # Squelette pour le conteneur 3
│       └── visualization-4.js         # Squelette pour le conteneur 4
├── package.json                       # Dépendances précédemment déclarées
└── README.md
```

## Ajouter une visualisation

1. Compléter le fichier `js/visualizations/visualization-N.js` correspondant. Il récupère déjà le conteneur HTML `visualization-N` ; son code est isolé dans une fonction pour éviter les collisions entre fichiers.
2. Remplacer le contenu temporaire du conteneur lors du rendu et adapter son titre dans `index.html`.
3. Ajouter les styles dans `css/styles.css`. Préfixer les règles propres à une visualisation par son identifiant, par exemple `#visualization-1`.

Les quatre scripts sont déjà reliés à la page avec `defer`, pour être exécutés après l’analyse du HTML. Aucun graphique ni traitement des données n’est encore présent.

Le chemin du CSV depuis la page est `data/ai_jobs_market_2025_2026.csv`. Si plusieurs visualisations partagent du chargement ou de la préparation de données, ce code pourra être regroupé dans `js/data.js` au moment de son implémentation.

## Dépendances

D3 et Express sont déjà déclarés dans `package.json`, mais ne sont pas utilisés par ce squelette. `npm install` n’est pas nécessaire pour ouvrir la page. Aucun framework, outil de compilation ou service externe n’a été ajouté.
