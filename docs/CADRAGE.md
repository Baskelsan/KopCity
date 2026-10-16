# Kop City — Cadrage du jeu

Oct 15, 2026 · @Pié

## Vision et principes

Kop City est un jeu de gestion solo, sans fin et 100 % hors ligne : tu diriges un club de football et tu fais grandir la ville autour de son stade.

**La fantasy.** Partir d'un petit club de la division la plus basse, dans un quartier endormi, et le mener jusqu'à l'élite pendant que la ville s'étend quartier par quartier.

**Les 5 principes de conception**

1. **Deux moitiés, une seule boucle.** Le club alimente la ville (victoires, affluence, sponsors) et la ville alimente le club (supporters, recrues locales, budget). Tout système doit servir l'autre moitié.
2. **Rapide par défaut, dense quand ça compte.** Les semaines calmes s'enchaînent d'un geste ; le jeu s'arrête de lui-même aux semaines clés, où se prennent les vraies décisions.
3. **Hors ligne d'abord.** Après le premier chargement, tout fonctionne sans réseau. Aucun serveur, aucun compte.
4. **Peu de systèmes, effets lisibles.** Chaque bâtiment, stat ou événement a un effet clair et visible dans l'interface. On ajoute de la profondeur après, pas avant.
5. **Pensé pour le pouce.** Portrait, grandes zones tactiles, une main, sessions de 5 à 15 minutes.

## Périmètre de la v1

La v1 est une partie sans fin jouable sur plusieurs saisons, avec un club, une ville et une sauvegarde. Le but est de valider que la boucle club ↔ ville donne envie de jouer « encore une saison ».

**Dans la v1**

- Création du club en début de partie : nom et couleurs ; un seul niveau de difficulté, plutôt tranquille
- 3 divisions de 10 équipes, avec montée et descente
- Une ville de 4 quartiers qui se débloquent, avec des emplacements prédéfinis
- 6 types de bâtiments, construits en chantiers de plusieurs semaines
- Effectif de 18 joueurs, 5 formations, 3 styles de jeu
- Matchs en fil minute par minute avec 2 ou 3 décisions, ou en résumé rapide
- Marché des transferts et centre de formation
- 12 à 15 événements, objectifs de saison, palmarès et records
- Sauvegarde automatique, export/import, mode hors ligne (PWA)

**Hors v1 (à garder pour plus tard)**

- Coupes, compétitions européennes
- Rendu animé des matchs, sons, musique
- Vrais noms de clubs et de joueurs (licences)
- Plusieurs parties sauvegardées en parallèle
- Multijoueur, classements en ligne, comptes
- Notifications push

**Critère de réussite de la v1.** Une saison se joue en 30 à 45 minutes, un nouveau quartier est débloqué dans les 3 premières saisons, deux saisons de suite ne se déroulent pas pareil, et on a envie d'en lancer une quatrième.

## Boucle de jeu

Le jeu avance semaine par semaine. Par défaut, le bouton « Avancer » enchaîne les semaines calmes en quelques secondes, et le jeu s'arrête de lui-même dès qu'une décision compte. Une saison compte 18 semaines (18 journées), suivies d'une intersaison.

**Semaine rapide** (la majorité)

- La composition est faite automatiquement (meilleur onze disponible selon la formation choisie), modifiable à tout moment.
- Le match se résout en résumé : score, buteurs, 2 ou 3 faits marquants.
- Le bilan financier tient en une ligne sur l'accueil.
- Le joueur peut toujours s'arrêter de lui-même pour gérer l'effectif ou la ville.

**Semaine clé : le jeu s'arrête quand**

- c'est le mercato (intersaison et semaine 9) ;
- le match a un enjeu : derby, choc contre un concurrent direct (3 points d'écart ou moins), ou une des 3 dernières journées avec montée ou descente en jeu. Ce match se joue alors en fil minute par minute avec décisions ;
- un chantier est livré ou un nouveau quartier se débloque ;
- un événement demande un choix ;
- une alerte tombe : titulaire blessé, trésorerie négative, riverains sous 40.

Un réglage permet de jouer tous les matchs en minute par minute pour qui le préfère.

**Une saison**

- 18 journées à 10 équipes (aller-retour).
- **Intersaison** : montées et descentes (les 2 premiers montent, les 2 derniers descendent), bilan des objectifs, fins de contrat, arrivée des jeunes du centre de formation, progression et vieillissement, mercato, budget de la saison suivante.
- La ville est conservée d'une saison à l'autre : c'est la progression à long terme.

**Partie sans fin et faillite**

- **Pas de fin** : on joue tant qu'on veut. Trois moteurs pour continuer : monter jusqu'à l'élite puis y gagner des titres, débloquer les 4 quartiers, et battre ses records (palmarès, affluence, trésorerie).
- **Faillite = game over** : trésorerie négative pendant 4 semaines d'affilée. Chaque semaine dans le rouge est une semaine clé avec alerte, pour laisser une chance de redresser. À la faillite, un écran de bilan affiche le palmarès de la partie, puis on recommence une nouvelle partie.

## Système sportif

Le sport reste volontairement simple : 4 stats par joueur notées sur 20, 5 formations, 3 styles, et un match qui se résout en quelques secondes avec un peu de hasard. Les coefficients exacts vivent dans un fichier de configuration pour pouvoir les équilibrer sans toucher au code.

**Le joueur**

| Attribut | Valeurs | Rôle dans le jeu |
| --- | --- | --- |
| Poste | GAR, DEF, MIL, ATT | Détermine la ligne où il compte |
| Attaque, défense, passes, physique | 1 à 20 | Entrent dans la force des lignes (le gardien a « arrêts » à la place d'attaque) |
| Âge | 16 à 38 | Progression jusqu'à environ 25 ans, déclin après 31 |
| Potentiel | 1 à 20, caché ; affiché de 0,5 à 5 étoiles (demi-étoiles comprises) | Plafond de progression ; les étoiles ne sont qu'une estimation |
| Moral | 0 à 100 | Bonus ou malus de performance, baisse s'il ne joue pas |
| Salaire, contrat | € par mois, saisons restantes | Charge fixe, renégociation à l'échéance |
| Blessure | semaines restantes | Indisponible tant que > 0 |

**Affichage du potentiel.** Le vrai potentiel (1 à 20) n'est jamais montré. Les étoiles affichées valent le potentiel divisé par 4, arrondi à la demi-étoile, plus une erreur d'estimation propre à chaque joueur, tirée une fois entre −1 et +1 étoile, et bornée entre 0,5 et 5. Un jeune à 3 étoiles peut donc se révéler à 4, ou plafonner à 2. Proposition : le niveau du centre de formation réduit cette erreur pour les jeunes formés au club.

**Effectif.** 18 joueurs sous contrat, dont 11 titulaires et 7 remplaçants sur la feuille de match, avec 5 changements autorisés.

**Tactique.** 5 formations (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2) qui changent le nombre de joueurs par ligne, et 3 styles (offensif, équilibré, défensif) qui déplacent un bonus de la défense vers l'attaque ou l'inverse.

**Simulation d'un match**

1. Calculer pour chaque équipe trois forces (attaque, milieu, défense) à partir des joueurs alignés, de la formation, du style, du moral et de l'avantage du terrain.
2. Tirer 8 à 15 occasions au total, réparties selon le rapport de force au milieu.
3. Pour chaque occasion : l'attaque affronte la défense (tir cadré ou non), puis le tir affronte le gardien (but ou arrêt).
4. Produire un fil du match minute par minute (occasions, buts, cartons, blessures).
5. Interrompre 2 ou 3 fois pour une décision : ajustement à la mi-temps, remplacement après blessure, choix de forcer ou de gérer le score en fin de match.
6. Tout le tirage repose sur une graine aléatoire enregistrée avec le résultat, pour pouvoir rejouer ou déboguer un match.

**Deux façons de vivre un match.** La simulation est identique, seul l'affichage change. En résumé (semaines rapides), on voit le score et les faits marquants, et les décisions par défaut s'appliquent (ne rien changer). En minute par minute (semaines clés, ou toujours si le réglage est activé), le fil défile en une minute environ, accélérable, et s'arrête à chaque moment de décision.

**Compétition.** 3 divisions de 10 équipes (Division 3, Division 2 et Élite, noms provisoires). Victoire 3 points, nul 1 point, départage à la différence de buts. Les 2 premiers montent, les 2 derniers descendent, et le club démarre en Division 3. Les 29 autres équipes sont générées en début de partie avec une force qui dépend de leur division, puis évoluent un peu à chaque saison (progression, transferts simulés) pour que le championnat ne soit jamais figé.

**Transferts.** Un marché de 6 à 8 joueurs proposés à chaque intersaison, plus une fenêtre d'hiver en milieu de saison (semaine 9). Le prix dépend de la note globale et de l'âge ; tu peux aussi vendre.

**Centre de formation.** Son niveau (0 à 3) dépend du bâtiment. Chaque intersaison, il fait sortir 1 à 3 jeunes de 16 à 18 ans, dont le potentiel monte avec le niveau du centre et avec la population de la ville (vivier local).

## Système urbain

La ville est faite de 4 quartiers, chacun avec un nombre fixe d'emplacements. On touche un emplacement libre, on choisit quoi y construire, et le chantier démarre. Il n'y a pas de grille ni de placement libre : la stratégie porte sur quoi construire et dans quel quartier.

**Les quartiers**

| Quartier | Emplacements | Se débloque | Particularité |
| --- | --- | --- | --- |
| Quartier du stade | 4 | Dès le départ | Seul quartier où bars et boutique donnent leur plein effet (50 % ailleurs) |
| Faubourg | 5 | 26 000 habitants | Pas de nuisance pour les riverains du stade, idéal pour les logements |
| Quartier de la gare | 4 | Montée en Division 2 | Un parking ou arrêt de transport y compte double (plafond d'accès et satisfaction) |
| Nouveau quartier | 6 | Montée en Élite et 40 000 habitants | Le plus grand, pour la fin de partie |

**Les 6 bâtiments** (valeurs de départ, à équilibrer en test)

| Bâtiment | Coût (€) | Entretien (€/sem.) | Chantier | Effet | Contrepartie |
| --- | --- | --- | --- | --- | --- |
| Stade (3 paliers, sans emplacement) | 400 000 par palier | 5 000 par palier | 6 semaines | +2 000 places par palier | Riverains −5 par palier |
| Bar / brasserie (un par quartier) | 60 000 | 800 | 2 semaines | affluence × 1,5 € par match à domicile | Riverains −2 s'il est dans le quartier du stade |
| Boutique du club (une seule) | 90 000 | 1 200 | 3 semaines | supporters × 1 € par semaine | Aucune |
| Logements | 150 000 | 1 500 | 4 semaines | +2 000 habitants | Riverains −2 s'ils sont dans le quartier du stade |
| Parking / arrêt de transport | 200 000 | 2 000 | 4 semaines | +2 500 au plafond d'accès | Occupe un emplacement |
| Centre de formation (3 niveaux, un seul) | 250 000 par niveau | 3 000 par niveau | 6 semaines | Meilleurs jeunes, progression plus rapide | Aucune |

**Règles de construction**

- Le coût est payé au lancement du chantier, et un achat ne peut jamais faire passer la trésorerie sous zéro.
- 2 chantiers au maximum en même temps. La livraison d'un chantier est une semaine clé.
- Un seul exemplaire pour la boutique et le centre de formation dans toute la ville, un seul bar par quartier. Logements et transports sont libres.
- Démolir libère l'emplacement tout de suite et rembourse 25 % de tout ce qui a été investi (tous niveaux compris).
- Un chantier lancé ne s'annule pas : il faut attendre sa livraison, puis démolir.

**Habitants et supporters.** Population de départ : 20 000 habitants, plus 2 000 par immeuble de logements. Part de supporters au départ : 20 %, +1 point par victoire, −0,5 point par défaite, bornée entre 10 % et 60 %. Les supporters déterminent l'affluence au stade.

**Satisfaction des riverains (0 à 100).** Elle tend chaque semaine, de 2 points au plus, vers une valeur cible ; les événements la font bouger ponctuellement.

```latex
\text{cible} = 70 - 5 \times \text{paliers du stade} - 2 \times \text{bars et logements du quartier du stade} + 5 \times \text{transports}
```

- En dessous de 40 : plus aucune extension du stade n'est autorisée.
- En dessous de 20 : amendes hebdomadaires et risque d'événement négatif.

C'est le frein qui empêche de tout miser sur le stade et sur son quartier.

## Économie et liens club ↔ ville

Le budget est serré par construction : au départ, une saison dégage environ 200 000 € de marge, ce qui oblige à choisir entre renforcer l'équipe et construire. Tout est en euros, avec une trésorerie de départ de 500 000 €.

&#91;embedded content: boucle club ↔ ville · 7 éléments\]

Les deux boucles passent par l'argent : les résultats le font entrer, il sert à recruter ou à construire. Les riverains sont le frein posé sur la ville.

**L'affluence, pivot de l'économie**

```latex
\text{affluence} = \min(\text{capacité},\ \text{plafond d'accès},\ \text{supporters} \times \text{attrait du match})
```

Capacité de départ : 6 000 places. Plafond d'accès de départ : 7 000 spectateurs, plus 2 500 par parking ou arrêt de transport. Population de départ : 20 000 habitants, dont 20 % de supporters. Attrait du match : de 0,7 à 1,2 selon l'adversaire et la forme des 5 derniers matchs.

**Flux d'argent** (valeurs de départ)

| Flux | Quand | Formule |
| --- | --- | --- |
| Billetterie | Match à domicile (9 par saison) | affluence × prix du billet (25 €, 35 € puis 50 € selon la division) |
| Bars | Match à domicile | affluence × 1,5 € par bar, chaque bar suivant rapporte 60 % du précédent |
| Boutique du club | Chaque semaine | supporters × 1 € |
| Sponsors | Chaque semaine | 10 000 €, 20 000 € ou 40 000 € selon la division, × 0,8 à 1,4 selon le classement |
| Prime de fin de saison | Fin de saison | Selon le classement final |
| Salaires | Chaque semaine | Salaires mensuels ramenés à la semaine (× 12 ÷ 52), soit environ 40 000 € par semaine au départ |
| Entretien des bâtiments | Chaque semaine | Somme des entretiens (stade de départ : 4 000 €) |
| Frais de fonctionnement | Chaque semaine | 5 000 € |
| Transferts, amendes | À l'événement | Achat de joueurs, amendes si riverains < 20 |

Monter de division augmente les recettes, mais aussi les salaires des joueurs capables d'y jouer : la marge ne grossit vraiment que si la ville suit (supporters, capacité, accès).

**Comment le club et la ville s'influencent**

- **Résultats → supporters** : chaque victoire augmente la part de supporters, chaque défaite la réduit un peu.
- **Classement → sponsors** : un bon classement monte le coefficient de sponsoring.
- **Supporters → affluence → argent** : plus de monde au stade, plus de billetterie et de revenus des bars.
- **Argent → ville** : tu construis (logements, parking, boutique, formation) et tu étends le stade ; les montées et la population débloquent de nouveaux quartiers.
- **Ville → club** : plus de logements donnent plus d'habitants, donc plus de supporters et un meilleur vivier de jeunes.
- **Ville → freins** : bruit et trafic baissent la satisfaction des riverains, qui peut bloquer l'extension du stade.

## Événements et objectifs

Les événements cassent la routine et créent des décisions. Chaque semaine, il y a une chance sur cinq qu'un événement se déclenche (une sur trois à l'origine, réduite en M7 pour le rythme) (jamais pendant les 2 premières semaines, jamais plus d'un par semaine), tiré parmi ceux dont la condition est remplie. Chacun propose 2 choix avec un coût et un effet visibles avant de décider.

**Catalogue de départ (12 événements)**

| Événement | Condition | Choix possibles |
| --- | --- | --- |
| Star blessée | Hasard, un titulaire | La faire jouer malgré tout (risque d'aggravation) ou la reposer |
| Voisins excédés | Satisfaction < 50 | Payer un mur antibruit (30 000 €, +10 satisfaction) ou ignorer (−10) |
| Subvention municipale | Top 5 au classement | Accepter 80 000 € en s'engageant à construire un parking dans la saison, ou refuser |
| Offre pour un joueur | Joueur à forte note | Vendre au prix proposé ou refuser (le moral monte) |
| Sponsor maillot | 4 victoires de suite | Contrat de 8 semaines avec revenu en plus, ou exclusivité plus chère à long terme |
| Jeune prodige du quartier | Centre de formation niveau ≥ 1 | Le signer gratuitement ou le laisser filer |
| Dispute au vestiaire | Moral moyen < 50 | Réunion d'équipe ou sanction financière |
| Pelouse abîmée | Hasard | Réparer (20 000 €) ou jouer dessus (−5 % de force à domicile pendant 2 matchs) |
| Match amical rémunéré | Hasard | Accepter (revenu en plus, risque de blessure) ou refuser |
| Grève des transports | Au moins un arrêt de transport | Affluence réduite un match, ou navettes payantes |
| Inspection de sécurité | Capacité > 8 000 | Mise aux normes (40 000 €) ou risque d'amende |
| Série de défaites | 3 défaites de suite | Conférence de presse (moral ou supporters) ou silence radio |

Le catalogue peut grandir ensuite : chaque événement est une entrée de données, pas du code.

**Objectifs de saison.** Au début de chaque saison, la direction fixe 3 objectifs tirés d'un pool : un sportif (finir dans le top 5, ne pas perdre à domicile pendant 5 matchs), un financier (terminer avec au moins 300 000 € de trésorerie) et un urbain (satisfaction des riverains ≥ 60, construire 2 bâtiments). Chaque objectif atteint rapporte une prime ; Les atteindre tous augmente aussi les sponsors de la saison suivante.

**Palmarès et records.** Un écran garde la trace de la partie : titres, montées, meilleure affluence, plus grosse trésorerie, meilleur buteur de l'histoire du club. Les records battus sont signalés en fin de saison. À la faillite, le palmarès de la partie est conservé à part, pour pouvoir comparer ses parties successives.

## Modèle de données

Toute la partie tient dans un seul objet JSON, l'état de jeu. L'interface ne fait que l'afficher, et chaque action du joueur est une fonction qui prend l'état et renvoie un nouvel état. C'est ce qui rend les sauvegardes, les tests et le débogage simples.

```json
{
  "schemaVersion": 1,
  "meta": { "createdAt": "2026-10-15T10:00:00Z", "lastSavedAt": "2026-10-15T10:30:00Z", "rngState": 123456789 },
  "settings": { "alwaysLiveMatches": false },
  "time": { "season": 1, "week": 1 },
  "club": { "name": "FC Exemple", "colors": ["#1d4ed8", "#ffffff"], "treasury": 500000, "weeksInRed": 0 },
  "squad": {
    "formation": "4-4-2",
    "style": "balanced",
    "autoLineup": true,
    "lineup": ["p1", "p2"],
    "players": [
      { "id": "p1", "name": "A. Martin", "pos": "MIL", "age": 24,
        "stats": { "att": 11, "def": 10, "pas": 13, "phy": 12 },
        "potential": 15, "potentialStarsShown": 3.5, "morale": 70, "monthlySalary": 9500, "contractYears": 2, "injuryWeeks": 0 }
    ]
  },
  "city": {
    "stadiumLevel": 0,
    "population": 20000,
    "supporterShare": 0.2,
    "residentSatisfaction": 70,
    "districts": [
      { "id": "stade", "unlocked": true,
        "slots": [ { "id": "stade-1", "building": { "type": "bar", "level": 1 } }, { "id": "stade-2", "building": null } ] }
    ],
    "constructions": [ { "slotId": "stade-2", "type": "shop", "level": 1, "weeksLeft": 2 } ]
  },
  "league": {
    "myDivision": "D3",
    "divisions": [
      { "id": "D3",
        "teams": [ { "id": "t1", "name": "AS Exemple", "strength": { "att": 11, "mid": 10, "def": 10 } } ],
        "fixtures": [ { "week": 1, "home": "t1", "away": "me", "result": null, "live": false } ],
        "table": [ { "team": "t1", "played": 0, "points": 0, "goalsFor": 0, "goalsAgainst": 0 } ] }
    ]
  },
  "market": { "offers": [] },
  "events": { "pending": null, "history": [] },
  "objectives": [],
  "records": { "titles": 0, "promotions": 0, "bestAttendance": 0, "bestTreasury": 500000 },
  "log": []
}
```

**Règles à respecter**

- **Données de jeu séparées du code.** Les bâtiments, événements, formations et coefficients d'équilibrage vivent dans des fichiers de configuration (par exemple `buildings.json`, `events.json`, `balance.json`), jamais écrits en dur dans la logique.
- **Logique pure.** Les fonctions de calcul n'accèdent ni à l'heure, ni au DOM, ni au stockage ; le hasard vient d'un générateur à graine dont l'état est dans `meta.rngState`.
- **Versionnage.** `schemaVersion` est incrémenté à chaque changement de structure, avec une fonction de migration par version pour ne pas casser les anciennes sauvegardes.
- **Sauvegardes.** Une seule sauvegarde courante, écrasée chaque semaine. À la faillite, la partie est close et seul son palmarès est gardé, sous une clé séparée.

## Architecture technique

Le jeu est une PWA (application web installable) : tout se code et se teste sur PC, se déploie gratuitement sur GitHub Pages, et s'installe sur l'iPhone via Safari (Partager → Sur l'écran d'accueil). Après le premier chargement, plus aucune connexion n'est nécessaire.

&#91;embedded content: architecture du jeu · 7 composants\]

Tout ce qui change l'état passe par la logique pure ; l'interface, la sauvegarde et le mode hors ligne sont des couches autour.

**Stack proposée**

| Choix | Pourquoi |
| --- | --- |
| TypeScript | Les erreurs de structure d'état se voient à l'écriture, pas en jouant |
| Vite | Démarrage instantané, build simple, déploiement statique |
| Preact | Interface réactive très légère, pratique pour synchroniser les écrans avec l'état |
| vite-plugin-pwa (Workbox) | Génère le manifeste et le service worker pour le mode hors ligne |
| IndexedDB (via idb-keyval) | Stockage de la sauvegarde, plus robuste que localStorage |
| Vitest | Tests de la logique pure (match, économie, saison) |
| GitHub Actions + Pages | Build et déploiement automatiques à chaque push |

**Organisation du code**

- `src/core/` : la logique pure (état, générateur aléatoire, match, économie, ville, événements, saison). Aucune dépendance à l'interface.
- `src/data/` : les fichiers de configuration (bâtiments, événements, formations, équilibrage).
- `src/ui/` : les écrans et composants.
- `src/storage/` : sauvegarde, export/import, migrations.
- `tests/` : les tests de `core` et `storage`.

**Contraintes iOS à traiter dès le départ**

- **Installation** : iOS n'affiche pas d'invite d'installation. Prévoir un écran d'aide qui explique le geste « Sur l'écran d'accueil ».
- **Plein écran et encoche** : balises `apple-mobile-web-app-capable`, icône `apple-touch-icon`, `viewport-fit=cover` et marges `env(safe-area-inset-*)`.
- **Stockage non garanti** : demander `navigator.storage.persist()` au premier lancement, et proposer l'export de la sauvegarde (fichier JSON) de façon visible, par exemple un rappel toutes les 5 semaines de jeu.
- **Mises à jour** : le service worker met à jour le cache en arrière-plan ; afficher un bandeau « Nouvelle version, relancer » plutôt que de recharger de force en pleine partie.
- **Test hors ligne** : l'activer dans les outils de développement du navigateur, puis le vérifier sur l'iPhone réel en mode avion.

## Interface mobile

L'interface est pensée en portrait, à une main, avec une barre de navigation en bas à 5 onglets et un gros bouton « Avancer » toujours accessible, qui enchaîne les semaines jusqu'à la prochaine décision.

| Onglet | Contenu | Actions principales |
| --- | --- | --- |
| Accueil | Trésorerie, classement, prochain match, alertes, objectifs | Avancer, ou s'arrêter pour gérer |
| Effectif | Liste des joueurs, stats, moral, blessures, contrats | Choisir la composition, la formation et le style, acheter ou vendre |
| Ville | Quartiers et leurs emplacements, chantiers en cours, satisfaction des riverains | Lancer un chantier, améliorer, démolir |
| Matchs | Calendrier, classement, fil du match | Prendre les décisions pendant le match |
| Club | Budget détaillé, objectifs, sauvegarde et réglages | Export / import, palmarès, réglage des matchs, nouvelle partie |

**Règles d'ergonomie**

- **Zones tactiles d'au moins 44 px**, texte d'au moins 16 px.
- **Actions principales en bas de l'écran**, à portée du pouce. Les informations passent dans des panneaux qui montent du bas (feuilles modales).
- **La ville** s'affiche quartier par quartier, en cartes qu'on fait défiler. On touche un emplacement, puis on valide dans un panneau du bas qui montre le coût, l'effet et la durée du chantier avant de payer.
- **Pas de survol** : toute information accessible au survol doit l'être aussi au toucher.
- **Chaque effet est expliqué.** Au toucher long ou via un bouton d'information, on voit le détail du calcul (pourquoi l'affluence est de 4 200, par exemple).
- **Toute action coûteuse se confirme**, et les décisions importantes d'un match ne se défont pas.
- **Style graphique** : icônes et tuiles très simples, des couleurs fixes pour chaque type de bâtiment, thème clair et sombre automatique.

## Plan de développement

Le développement avance en 8 jalons, chacun jouable ou testable seul et terminé par un critère vérifiable. L'ordre met le risque technique d'abord (PWA hors ligne sur iPhone), puis la boucle club ↔ ville, avant le contenu.

1. **M0, Fondations.** Dépôt, Vite + TypeScript + Preact, déploiement automatique sur GitHub Pages, PWA minimale. *Terminé quand* la page s'installe sur l'iPhone et s'ouvre en mode avion.
2. **M1, État et sauvegarde.** Type de l'état de jeu, générateur aléatoire à graine, sauvegarde IndexedDB, export/import, première migration. *Terminé quand* une partie se recharge à l'identique après fermeture, et un export se réimporte.
3. **M2, Effectif et match.** Génération de l'équipe, stats, composition automatique, formations et styles, simulation, affichage en résumé et en minute par minute avec décisions. *Terminé quand* un match se joue dans les deux modes et que la même graine donne le même résultat.
4. **M3, Ville.** Quartiers et emplacements, 6 bâtiments, chantiers, démolition, écran Ville. *Terminé quand* un chantier lancé est livré après sa durée, que son effet chiffré se voit, et qu'aucun achat ne fait passer la trésorerie sous zéro.
5. **M4, Semaines et économie.** Bouton « Avancer » avec arrêts aux semaines clés, flux d'argent, affluence, supporters, satisfaction des riverains, écran Accueil. *Terminé quand* 18 semaines s'enchaînent avec une trésorerie cohérente et des arrêts aux bons moments.
6. **M5, Divisions et saisons.** 3 divisions, calendrier, classement, montées et descentes, équipes adverses, intersaison, déblocage des quartiers. *Terminé quand* 3 saisons s'enchaînent sans erreur, avec montée et descente possibles.
7. **M6, Événements, objectifs et fin de partie.** Les 12 événements, objectifs de saison, palmarès et records, faillite et écran de bilan. *Terminé quand* chaque événement se déclenche en test et que la faillite mène bien au bilan puis à une nouvelle partie.
8. **M7, Équilibrage et finitions.** Script qui simule 100 saisons pour ajuster les coefficients, création du club, écran d'aide à l'installation, icônes, rappels d'export. *Terminé quand* les stratégies « tout sur le stade » et « tout sur les joueurs » échouent, et qu'une saison se joue en 30 à 45 minutes.

**Comment travailler avec Claude Code**

- Exporter ce document en Markdown dans `docs/CADRAGE.md`, et ajouter à la racine un court `CLAUDE.md` qui le référence avec les règles non négociables : logique pure dans `core`, données dans `data`, tests pour chaque règle de calcul, jamais de `Date.now` dans la logique.
- Traiter un jalon par session : demander d'abord un plan, puis le code, puis les tests, puis un commit.
- Tester sur l'iPhone réel à la fin de M0, M2 et M4, pas seulement dans le navigateur du PC.
- Quand une valeur d'équilibrage change, la modifier dans `balance.json` et ajouter une ligne dans ce document, pour qu'il reste la référence.

## Précisions décidées en cours de développement

Règles que le cadrage ne fixait pas, validées pendant les jalons. Les valeurs vivent dans `src/data/balance.json`.

**Match (M2)**
- Forces : chaque ligne additionne les notes pondérées de ses joueurs (attaquant : 60 % attaque, 20 % passes, 20 % physique…) ; le milieu soutient l'attaque et la défense à 30 %. Hors de son poste, un joueur vaut 80 % (40 % dans les buts).
- Style : ±10 % entre attaque et défense. Fin de match : forcer ou gérer déplace 20 %. Moral : de −10 % à +10 %. Domicile : +5 %.
- Les adversaires n'ont pas de joueurs mais une force `{att, mid, def, gk}` sur la même échelle que le club.
- Les cartons sont décoratifs en v1 (pas de suspension).
- Moral après un match : +5 victoire, +1 nul, −5 défaite pour ceux qui ont joué, −3 pour les autres.
- Les blessés guérissent d'une semaine à chaque semaine jouée.
- Le match en cours est sauvegardé (`currentMatch`) : quitter puis revenir ne permet pas de le rejouer.

**Semaines et économie (M4)**
- Attrait du match : 0,85, +0,15 pour le derby, de +0,10 (adversaire premier) à −0,10 (dernier), ±0,03 par victoire ou défaite sur les 5 derniers matchs, borné entre 0,7 et 1,2.
- Coefficient sponsor : 1,4 pour le premier, 0,8 pour le dernier, régulier entre les deux, 1 avant la 1re journée.
- Amende si les riverains sont sous 20 : 10 000 € par semaine.
- Un rival est tiré dans la division pour le derby. Chaque club d'une division vient d'une ville différente.
- Concurrent direct : 3 points d'écart au plus et 2 places au plus, à partir de la 4e journée.
- Montée ou maintien « en jeu » dans les 3 dernières journées : l'écart avec la ligne de montée ou de descente peut encore être comblé.
- Mesuré sur 100 saisons : marge moyenne d'environ 200 000 €, 7 à 8 matchs à enjeu par saison.
- Le marché des transferts (et donc l'arrêt du mercato en semaine 9) est rattaché à M5, avec l'intersaison.

**Divisions, saisons et intersaison (M5)**
- Les 3 divisions se jouent chaque semaine. Chaque équipe a un niveau caché qui dérive un peu à chaque intersaison, avec un rappel vers le niveau de sa division (une équipe promue reste d'abord plus faible).
- Effectif de 16 à 22 joueurs (18 au départ).
- Prime de fin de saison : 100 000 € (Division 3), 200 000 € (Division 2), 400 000 € (Élite) pour le premier, puis régulièrement jusqu'à 20 % pour le dernier.
- Âge : jusqu'à 23 ans, +1 à +2 par stat et par saison sans dépasser le potentiel (+1 par niveau du centre pour les jeunes formés au club) ; stable de 24 à 30 ans ; −1 à −2 dès 31 ans ; retraite possible dès 35 ans (35 %), obligatoire à 38.
- Contrats : le joueur en fin de contrat se prolonge de 1 à 3 saisons avec un salaire recalculé (+10 %) ; sinon il part au lancement de la saison.
- Centre de formation : 1 jeune au niveau 0, 1 à 2 au niveau 1, 2 à 3 au niveau 2, 3 au niveau 3, de 16 à 18 ans ; le potentiel monte avec le niveau et la population ; le niveau réduit l'erreur sur les étoiles (−25 % par niveau).
- Mercato : 6 à 8 joueurs à l'intersaison et en semaine 9 (fenêtre d'hiver, qui se referme en repartant). Valeur selon la note et l'âge (note 10 à 25 ans : 150 000 €) ; une vente rapporte 80 % de la valeur, tout de suite.
- À l'intersaison, les blessés sont guéris et le moral se rapproche de 70.

**Événements, objectifs et fin de partie (M6)**
- Un tirage par semaine à partir de la 3e, 1 chance sur 3 (1 sur 5 depuis M7), jamais deux fois de suite le même événement. L'événement arrête « Avancer » ; un choix qui coûte plus que la trésorerie est refusé.
- Chiffres des 12 événements : star blessée (jouer : 40 % de risque de 3 à 5 semaines ; reposer : 1 semaine) ; voisins excédés (mur −30 000 €, +10 ; ignorer −10) ; subvention (+80 000 € avec engagement de construire un transport dans la saison, sinon remboursement et riverains −10) ; offre pour un joueur noté au moins 2 de plus que le niveau de la division (vendre à 120 % de sa valeur ; refuser : moral +15) ; sponsor maillot après 4 victoires (+6 000 €/sem. pendant 8 sem. ou +3 000 €/sem. pendant 25 sem.) ; jeune prodige (centre ≥ 1) ; dispute au vestiaire si moral moyen < 50 (réunion +10 ; sanction +20 000 €, moral −5) ; pelouse abîmée (−20 000 € ou −5 % de force à domicile pendant 2 matchs) ; match amical rémunéré (+30 000 €, 25 % de risque de blessure de 1 à 3 sem.) ; grève des transports (affluence −30 % un match ou navettes −15 000 €) ; inspection si capacité > 8 000 (−40 000 € ou 50 % de risque d'amende de 80 000 €) ; série de 3 défaites (défendre l'équipe : moral +10 ; s'excuser : supporters +1 point).
- Les comptes ont une ligne « Transferts et événements » en recettes et en dépenses, pour que le récapitulatif colle à la trésorerie.
- Objectifs : un sportif (top 5, top 3 ou invaincu à domicile 5 matchs de suite), un financier (300 000 € en caisse ou résultat positif), un urbain (riverains à 60 ou 2 bâtiments livrés). 50 000 € par objectif atteint (×1,5 en D2, ×2 en Élite) ; les trois atteints donnent +10 % de sponsors la saison suivante.
- Un titre = finir premier de sa division, quelle qu'elle soit.
- Faillite après 4 semaines de suite dans le rouge ; le bilan de la partie est gardé à part (parties précédentes, onglet Club).
- L'aide municipale contre la spirale négative est reportée à M7.

**Équilibrage et finitions (M7)**
- `npm run simulate` fait jouer 3 joueurs automatiques (équilibré, tout sur le stade, tout sur les joueurs) sur 100 parties de 5 saisons ; le rapport est dans `docs/EQUILIBRAGE.md`.
- Valeurs modifiées : salaires plus raides avec la note (exposant 3, 7 000 €/mois pour une note de 10 ; masse de départ toujours ≈ 40 000 €/sem.) ; contrats de départ de 2 à 4 saisons ; joueurs du marché de ±4 autour du niveau de la division ; concurrent direct = 3 points au plus et rang voisin, à partir de la 6e journée ; montée ou maintien « en jeu » = 3 points au plus de la ligne, dans les 3 dernières journées.
- Événements : 1 chance sur 5 par semaine au lieu de 1 sur 3, pour se rapprocher d'une semaine clé toutes les 2 à 3 semaines.
- Résultat : faillite dans 2 % des parties pour la stratégie équilibrée, 15 % pour « tout sur le stade » (qui plafonne en Division 3), 22 % pour « tout sur les joueurs » (avec moins d'argent) ; environ 13 arrêts par saison, dont 3 événements. L'aide municipale n'est pas nécessaire.
- Création du club (nom et 2 couleurs), aide à l'installation dans Safari, icônes définitives, rappel d'export (en fin de saison depuis les retours de jeu), temps de jeu affiché dans l'onglet Club.

**Retours de jeu après M7**
- Durée d'une saison mesurée sur iPhone : environ 10 minutes, jugée satisfaisante (au lieu des 30 à 45 minutes visées au départ).
- Les événements et alertes présentent le joueur avec son poste et sa note, par exemple « J. Diallo (ATT, note 14) ».
- Statistiques des joueurs, pour la saison et la carrière au club : matchs, buts, passes décisives et note moyenne sur 10. Note de match : 6 de base, +0,5 victoire / −0,5 défaite, +1 par but, +0,6 par passe décisive, +0,2 par tir cadré, −0,1 par tir non cadré ; gardiens et défenseurs : +0,8 sans but encaissé, −0,3 par but encaissé ; entre 3 et 10.
- Le rappel d'export n'apparaît plus qu'à l'intersaison, tant qu'on n'a pas exporté depuis la fin de la saison.

**Après la v1 — lot A : économie et ville**
- Prix du billet réglable de 50 % à 200 % du prix de base, par pas de 10 % ; demande × (prix de base ÷ prix)^1,2 ; au-delà de +30 %, −0,2 point de part de supporters par match à domicile.
- Nouveaux contrats (prolongations, mercato) payés ×1 en Division 3, ×1,3 en Division 2, ×1,7 en Élite. À l'intersaison, un joueur avec une note moyenne ≥ 7 sur au moins 10 matchs demande +20 % ; refuser (ou ne pas répondre) coûte 20 de moral.
- Bar et boutique sur 3 niveaux (prix d'achat par niveau, +50 % de recettes par niveau). Centre de formation : 1, 2, 3 ou 4 jeunes selon le niveau, note de départ +1 et potentiel +2 par niveau.

**Après la v1 — lot B : coupe nationale**
- Les 30 clubs, 5 tours à élimination directe en semaines 3, 7, 11, 15 et 17 (finale), joués avant le match de championnat de la semaine. Les deux premiers de l'Élite de la saison précédente entrent au 2e tour.
- Le club de la plus petite division reçoit ; en cas d'égalité, tirs au but (le meilleur gardien a un peu plus de chances).
- Matchs du club en résumé jusqu'aux huitièmes, en direct à partir des quarts (ou toujours avec le réglage).
- Recettes : billetterie et bars à domicile (attrait +0,2 par division d'écart avec l'adversaire) ; primes 20 000, 40 000, 60 000, 100 000 €, et 250 000 € pour le vainqueur. Ligne « Coupe » dans les comptes.
- La coupe gagnée et le parcours de chaque saison entrent au palmarès. Pour une partie en cours, la coupe commence à la saison suivante.

**Après la v1 — lot C : historique et succès**
- Onglet Stats (dans Matchs) : buteurs, passeurs et meilleures notes de la saison (au moins 5 matchs), saison par saison (rang, coupe, trésorerie, affluence moyenne), bilan face à chaque adversaire (championnat et coupe).
- 15 succès gardés d'une partie à l'autre (stockés à part, avec la date et le club) : première victoire, première montée, premier titre, atteindre l'Élite, titre en Élite, coupe, petit poucet (battre en coupe un club de deux divisions au-dessus), 10 000 spectateurs, 1 M€ en caisse, centre de formation niveau 3, 4 quartiers, 50 buts pour un joueur, 10 matchs sans défaite, 3 objectifs d'une saison, sortir du rouge après 3 semaines. Notification au déblocage, liste dans l'onglet Club.

**Fin de partie — plan A : progression, salaires, Élite**
- Progression des jeunes : 0 à +2 par stat et par saison ; le centre de formation donne, par niveau, 15 % de chance de +1 sur chaque stat (au lieu de +1 par stat et par niveau). Potentiel des jeunes du centre : 9 + 1,5 par niveau + population ÷ 20 000 ± 3.
- Salaire juste = celui du marché pour la note et la division. Un joueur payé moins de 75 % de ce salaire le réclame ; après une bonne saison, il demande au moins +20 %. Refuser coûte 20 de moral ; au 2e refus d'affilée, le joueur part au lancement de la saison, vendu à sa valeur.
- En Élite, les clubs visent le niveau du onze du joueur moins 1,5 (au moins 16, au plus 19) : plus il domine, plus ils recrutent.
- Mesuré sur 15 saisons avec une stratégie « à fond » : note moyenne du onze autour de 14, titres d'Élite rares (environ 10 % des saisons en Élite). Reste à traiter : la trésorerie continue de grimper faute de dépenses utiles en fin de partie.

## Décisions ouvertes et risques

**À trancher avant ou pendant M0**

- [x] Fin de partie : partie sans fin, faillite = game over.
- [x] Rythme : semaines rapides, avec arrêts aux semaines clés.
- [x] Ville : quartiers à débloquer, emplacements prédéfinis.
- [x] Matchs : fil minute par minute avec 2 ou 3 décisions aux moments clés, résumé sinon.
- [x] Création du club : nom et couleurs seulement en v1.
- [x] Divisions : 3 pour commencer.
- [x] Difficulté : un seul niveau, plutôt tranquille.
- [x] Noms des joueurs et des équipes : fictifs, générés depuis des listes.
- [x] Langue : français, avec tous les textes dans des fichiers.
- [x] Nom du jeu : Kop City.

**Risques et parades**

- **Spirale négative** : des défaites font baisser les supporters, donc l'argent, donc la qualité de l'équipe. Parade : sponsors avec un plancher, prime minimale de fin de saison, aide municipale quand la trésorerie est très basse.
- **Stratégie dominante** : tout miser sur le stade, ou tout sur les joueurs. Parade : satisfaction des riverains, rendements décroissants des bars, salaires qui montent avec la note ; vérifié par la simulation de 100 saisons en M7.
- **Match trop complexe** : la simulation est le piège à temps. Parade : s'en tenir à 3 forces par équipe et 8 à 15 occasions, ajouter de la finesse seulement après M5.
- **Perte de sauvegarde sur iPhone** : stockage non garanti. Parade : stockage persistant demandé, export visible, rappel régulier.
- **Dérive du périmètre** : l'envie d'ajouter coupes, animations. Parade : tout ce qui est hors v1 reste dans la liste « plus tard » jusqu'à la fin de M7.

**Valeurs à équilibrer en priorité en test**

- Marge de départ d'une saison (environ 200 000 €) et trésorerie initiale (500 000 €).
- Coûts et rendements des 6 bâtiments, et les seuils de déblocage des quartiers.
- Poids de la forme et du moral dans l'attrait du match.
- Part de hasard dans les occasions du match, pour qu'une équipe plus forte gagne souvent mais pas toujours.

Cible de rythme : environ une semaine clé toutes les 2 à 3 semaines, mercato non compris. Si le jeu s'arrête plus souvent, les semaines rapides perdent leur intérêt.

Difficulté « tranquille » : un joueur attentif ne doit presque jamais faire faillite, et les erreurs doivent coûter du temps plutôt que la partie.
