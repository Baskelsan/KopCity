# Équilibrage — rapport de simulation

Généré par `npm run simulate` : 100 parties de 5 saisons par stratégie, mêmes graines pour les trois.

| Mesure | Équilibrée | Tout sur le stade | Tout sur les joueurs |
| --- | --- | --- | --- |
| Faillites | 4 % | 12 % | 31 % |
| Meilleure division (moyenne, 1 = D3, 3 = Élite) | 1.84 | 1.30 | 1.96 |
| Parties qui atteignent la Division 2 | 80 % | 30 % | 85 % |
| Parties qui atteignent l'Élite | 4 % | 0 % | 11 % |
| Titres par partie | 0.57 | 0.15 | 0.80 |
| Trésorerie finale (médiane) | 789 k€ | 1 288 k€ | 517 k€ |
| Satisfaction finale (moyenne) | 74 | 53 | 68 |
| Meilleure affluence (moyenne) | 9 270 | 5 599 | 5 786 |
| Capacité finale (moyenne) | 9 680 | 11 700 | 6 000 |
| Population finale (moyenne) | 31 820 | 20 000 | 20 000 |
| Arrêts par saison | 13.6 | 8.2 | 12.4 |
| Matchs en direct par saison | 4.9 | 3.0 | 4.9 |
| Événements par saison | 3.1 | 2.0 | 3.2 |
| Durée estimée d’une saison | 20 min | 15 min | 19 min |

Durée estimée : 15 s par arrêt, 75 s par match en direct, 20 s par événement,
4 min d'intersaison et 5 min de gestion (effectif, ville) par saison.

## Arrêts par saison, selon leur raison (stratégie équilibrée)

| Raison | Arrêts par saison |
| --- | --- |
| keyMatch | 4.9 |
| event | 3.1 |
| constructionDelivered | 1.9 |
| starterInjured | 1.4 |
| winterMarket | 1.0 |
| none | 0.8 |
| seasonOver | 0.4 |
| districtUnlocked | 0.2 |
| treasuryNegative | 0.0 |

## Fin de partie : stratégie « à fond » sur 15 saisons

30 parties : centre de formation puis centre d'entraînement au maximum le plus tôt possible, toute la ville et le stade améliorés, staff au complet au-delà de 3 M€ (licencié sous 1 M€), tous les jeunes signés, les meilleurs joueurs et vedettes achetés s'il reste une saison de leur salaire, toutes les augmentations acceptées.

| Saison | Note moyenne du onze | Trésorerie (médiane) | En Élite | Titre d'Élite (parmi les clubs en Élite) | Faillites cumulées |
| --- | --- | --- | --- | --- | --- |
| 1 | 11.7 | 353 k€ | 0 % | – | 0 % |
| 2 | 11.1 | 391 k€ | 0 % | – | 3 % |
| 3 | 11.5 | 350 k€ | 0 % | – | 7 % |
| 4 | 11.7 | 402 k€ | 0 % | – | 10 % |
| 5 | 12.4 | 481 k€ | 0 % | – | 13 % |
| 6 | 12.7 | 647 k€ | 0 % | – | 13 % |
| 7 | 12.8 | 1 462 k€ | 3 % | 0 % | 13 % |
| 8 | 13.5 | 3 028 k€ | 3 % | 0 % | 13 % |
| 9 | 13.3 | 3 347 k€ | 17 % | 0 % | 13 % |
| 10 | 14.0 | 4 722 k€ | 13 % | 25 % | 13 % |
| 11 | 13.6 | 4 771 k€ | 33 % | 0 % | 13 % |
| 12 | 14.5 | 4 819 k€ | 37 % | 0 % | 13 % |
| 13 | 13.9 | 4 358 k€ | 47 % | 7 % | 13 % |
| 14 | 14.8 | 3 221 k€ | 40 % | 0 % | 13 % |
| 15 | 13.9 | 4 705 k€ | 57 % | 6 % | 13 % |
