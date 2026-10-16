# Équilibrage — rapport de simulation

Généré par `npm run simulate` : 100 parties de 5 saisons par stratégie, mêmes graines pour les trois.

| Mesure | Équilibrée | Tout sur le stade | Tout sur les joueurs |
| --- | --- | --- | --- |
| Faillites | 1 % | 11 % | 23 % |
| Meilleure division (moyenne, 1 = D3, 3 = Élite) | 1.93 | 1.30 | 1.94 |
| Parties qui atteignent la Division 2 | 88 % | 30 % | 85 % |
| Parties qui atteignent l'Élite | 5 % | 0 % | 9 % |
| Titres par partie | 0.75 | 0.15 | 0.83 |
| Trésorerie finale (médiane) | 939 k€ | 1 174 k€ | 574 k€ |
| Satisfaction finale (moyenne) | 56 | 53 | 67 |
| Meilleure affluence (moyenne) | 6 854 | 5 611 | 5 799 |
| Capacité finale (moyenne) | 7 800 | 11 720 | 6 000 |
| Population finale (moyenne) | 36 160 | 20 000 | 20 000 |
| Arrêts par saison | 13.6 | 8.1 | 12.4 |
| Matchs en direct par saison | 4.7 | 3.0 | 4.9 |
| Événements par saison | 3.3 | 1.9 | 3.1 |
| Durée estimée d’une saison | 19 min | 15 min | 19 min |

Durée estimée : 15 s par arrêt, 75 s par match en direct, 20 s par événement,
4 min d'intersaison et 5 min de gestion (effectif, ville) par saison.

## Arrêts par saison, selon leur raison (stratégie équilibrée)

| Raison | Arrêts par saison |
| --- | --- |
| keyMatch | 4.7 |
| event | 3.3 |
| constructionDelivered | 1.8 |
| starterInjured | 1.4 |
| winterMarket | 1.0 |
| none | 0.8 |
| seasonOver | 0.4 |
| districtUnlocked | 0.2 |

## Fin de partie : stratégie « à fond » sur 15 saisons

30 parties : centre de formation au maximum le plus tôt possible, toute la ville améliorée, tous les jeunes signés, les meilleurs joueurs achetés, toutes les augmentations acceptées.

| Saison | Note moyenne du onze | Trésorerie (médiane) | En Élite | Titre d'Élite (parmi les clubs en Élite) | Faillites cumulées |
| --- | --- | --- | --- | --- | --- |
| 1 | 11.8 | 242 k€ | 0 % | – | 0 % |
| 2 | 11.1 | 397 k€ | 0 % | – | 0 % |
| 3 | 11.5 | 638 k€ | 0 % | – | 0 % |
| 4 | 11.6 | 1 193 k€ | 3 % | 0 % | 3 % |
| 5 | 12.6 | 1 999 k€ | 0 % | – | 10 % |
| 6 | 12.7 | 3 193 k€ | 3 % | 0 % | 10 % |
| 7 | 12.9 | 4 272 k€ | 3 % | 0 % | 10 % |
| 8 | 13.5 | 5 169 k€ | 0 % | – | 10 % |
| 9 | 13.4 | 6 377 k€ | 3 % | 0 % | 10 % |
| 10 | 13.9 | 7 633 k€ | 17 % | 0 % | 10 % |
| 11 | 13.5 | 8 494 k€ | 27 % | 13 % | 10 % |
| 12 | 14.1 | 9 789 k€ | 27 % | 0 % | 10 % |
| 13 | 13.6 | 10 548 k€ | 30 % | 11 % | 10 % |
| 14 | 14.5 | 11 808 k€ | 30 % | 11 % | 10 % |
| 15 | 13.6 | 12 706 k€ | 40 % | 8 % | 10 % |
