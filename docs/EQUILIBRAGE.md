# Équilibrage — rapport de simulation

Généré par `npm run simulate` : 100 parties de 5 saisons par stratégie, mêmes graines pour les trois.

| Mesure | Équilibrée | Tout sur le stade | Tout sur les joueurs |
| --- | --- | --- | --- |
| Faillites | 1 % | 12 % | 31 % |
| Meilleure division (moyenne, 1 = D3, 3 = Élite) | 1.96 | 1.30 | 1.96 |
| Parties qui atteignent la Division 2 | 88 % | 30 % | 85 % |
| Parties qui atteignent l'Élite | 8 % | 0 % | 11 % |
| Titres par partie | 0.67 | 0.15 | 0.80 |
| Trésorerie finale (médiane) | 1 024 k€ | 1 288 k€ | 517 k€ |
| Satisfaction finale (moyenne) | 56 | 53 | 68 |
| Meilleure affluence (moyenne) | 6 858 | 5 599 | 5 786 |
| Capacité finale (moyenne) | 7 840 | 11 700 | 6 000 |
| Population finale (moyenne) | 35 800 | 20 000 | 20 000 |
| Arrêts par saison | 13.5 | 8.2 | 12.4 |
| Matchs en direct par saison | 4.8 | 3.0 | 4.9 |
| Événements par saison | 3.2 | 2.0 | 3.2 |
| Durée estimée d’une saison | 19 min | 15 min | 19 min |

Durée estimée : 15 s par arrêt, 75 s par match en direct, 20 s par événement,
4 min d'intersaison et 5 min de gestion (effectif, ville) par saison.

## Arrêts par saison, selon leur raison (stratégie équilibrée)

| Raison | Arrêts par saison |
| --- | --- |
| keyMatch | 4.8 |
| event | 3.2 |
| constructionDelivered | 1.7 |
| starterInjured | 1.4 |
| winterMarket | 1.0 |
| none | 0.8 |
| seasonOver | 0.4 |
| districtUnlocked | 0.2 |

## Fin de partie : stratégie « à fond » sur 15 saisons

30 parties : centre de formation puis centre d'entraînement au maximum le plus tôt possible, toute la ville et le stade améliorés, staff au complet au-delà de 3 M€ (licencié sous 1 M€), tous les jeunes signés, les meilleurs joueurs et vedettes achetés s'il reste une saison de leur salaire, toutes les augmentations acceptées.

| Saison | Note moyenne du onze | Trésorerie (médiane) | En Élite | Titre d'Élite (parmi les clubs en Élite) | Faillites cumulées |
| --- | --- | --- | --- | --- | --- |
| 1 | 11.7 | 323 k€ | 0 % | – | 0 % |
| 2 | 11.1 | 437 k€ | 0 % | – | 3 % |
| 3 | 11.4 | 625 k€ | 0 % | – | 3 % |
| 4 | 11.6 | 1 402 k€ | 0 % | – | 7 % |
| 5 | 12.6 | 1 977 k€ | 0 % | – | 7 % |
| 6 | 12.5 | 2 776 k€ | 0 % | – | 7 % |
| 7 | 12.8 | 3 040 k€ | 3 % | 0 % | 7 % |
| 8 | 13.2 | 3 310 k€ | 10 % | 0 % | 7 % |
| 9 | 13.3 | 3 342 k€ | 10 % | 0 % | 10 % |
| 10 | 14.0 | 2 940 k€ | 30 % | 0 % | 10 % |
| 11 | 13.8 | 2 354 k€ | 33 % | 0 % | 10 % |
| 12 | 14.5 | 1 864 k€ | 37 % | 9 % | 13 % |
| 13 | 13.8 | 1 978 k€ | 47 % | 0 % | 13 % |
| 14 | 14.7 | 2 228 k€ | 27 % | 13 % | 17 % |
| 15 | 14.0 | 1 895 k€ | 47 % | 0 % | 20 % |
