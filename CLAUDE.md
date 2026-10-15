# Kop City

Jeu de gestion solo pour iPhone, sans fin et 100 % hors ligne : on dirige un club de football et on fait grandir la ville autour de son stade. Livré en PWA (application web installable via Safari → « Sur l'écran d'accueil »), hébergée sur GitHub Pages. Pas de Mac, pas d'App Store.

**La référence du projet est `docs/CADRAGE.md`.** Règles du jeu, valeurs d'équilibrage, modèle de données, plan par jalons : tout y est. Lis la section concernée avant chaque tâche. Si une règle manque ou se contredit, demande avant d'inventer.

## Stack

- TypeScript (mode `strict`), Vite, Preact
- vite-plugin-pwa (Workbox) pour le manifeste et le service worker
- IndexedDB via idb-keyval pour la sauvegarde
- Vitest pour les tests
- GitHub Actions → GitHub Pages pour le déploiement (penser au `base` de Vite = nom du dépôt)

## Commandes

```bash
npm run dev       # serveur de développement
npm run build     # build de production
npm run preview   # tester le build (et le mode hors ligne) en local
npm test          # tests Vitest
```

## Organisation

```
src/
  core/      logique pure : état, RNG, match, économie, ville, événements, saison
  data/      configuration JSON : bâtiments, quartiers, événements, formations, balance, textes
  ui/        écrans et composants Preact
  storage/   sauvegarde IndexedDB, export/import, migrations
tests/       tests de core et storage
docs/        CADRAGE.md
```

## Règles non négociables

1. **Un seul état de jeu**, un objet JSON sérialisable. Chaque action est une fonction `(state, action) => newState`. L'interface ne fait qu'afficher l'état et envoyer des actions.
2. **`src/core` est pur** : pas de DOM, pas de stockage, pas de `Date.now()`, pas de `Math.random()`. Le hasard vient du générateur à graine dont l'état est dans `state.meta.rngState`. Même graine = même résultat.
3. **Aucune valeur d'équilibrage en dur dans le code.** Coûts, effets, probabilités, seuils : tout vient de `src/data/*.json`.
4. **Aucun texte affiché en dur.** Tous les textes de l'interface sont en français dans `src/data/texts.fr.json`. Identifiants et noms de code en anglais.
5. **Versionnage des sauvegardes** : tout changement de structure de l'état incrémente `schemaVersion` et ajoute une migration dans `src/storage/migrations`.
6. **Chaque règle de calcul a son test** (affluence, revenus, satisfaction, simulation de match, montées et descentes…).
7. **Hors ligne obligatoire** : aucune requête réseau à l'exécution, aucune police ou ressource externe. Tout est inclus dans le build.

## Contraintes iPhone

- Portrait, une main : zones tactiles d'au moins 44 px, texte d'au moins 16 px, actions principales en bas de l'écran.
- `viewport-fit=cover` et marges `env(safe-area-inset-*)` pour l'encoche et la barre du bas.
- Balises `apple-mobile-web-app-capable` et icône `apple-touch-icon`.
- Pas de survol : tout doit marcher au toucher.
- Thème clair et sombre automatique.
- Le stockage n'est pas garanti sur iOS : demander `navigator.storage.persist()` et garder l'export de sauvegarde bien visible.
- Mise à jour du service worker : bandeau « Nouvelle version, relancer », jamais de rechargement forcé en pleine partie.

## Façon de travailler

- **Un jalon à la fois**, dans l'ordre du plan de `docs/CADRAGE.md` (M0 → M7). Ne pas anticiper les jalons suivants.
- Pour chaque jalon : proposer un plan court, attendre validation, coder, écrire les tests, vérifier le critère « Terminé quand », puis committer.
- Petits commits avec des messages clairs, en français.
- Si une valeur d'équilibrage change, la modifier dans `src/data/balance.json` et signaler qu'il faut mettre à jour `docs/CADRAGE.md`.
- Ne rien ajouter qui soit listé « Hors v1 » dans le cadrage sans demande explicite.

## Avant de dire qu'une tâche est finie

- `npm run build` passe sans erreur ni avertissement TypeScript.
- `npm test` passe.
- Le critère « Terminé quand » du jalon est vérifié, et expliqué en une phrase.
- Pour M0, M2 et M4 : rappeler de tester sur l'iPhone réel, en mode avion.
