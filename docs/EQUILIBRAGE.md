# Équilibrage — rapport de simulation

Généré par `npm run simulate` : 100 parties de 5 saisons par stratégie, mêmes graines pour les trois.

| Mesure | Équilibrée | Tout sur le stade | Tout sur les joueurs |
| --- | --- | --- | --- |
| Faillites | 1 % | 18 % | 42 % |
| Meilleure division (moyenne, 1 = D3, 3 = Élite) | 2.04 | 1.44 | 1.86 |
| Parties qui atteignent la Division 2 | 93 % | 44 % | 79 % |
| Parties qui atteignent l'Élite | 11 % | 0 % | 7 % |
| Titres par partie | 0.81 | 0.36 | 0.67 |
| Trésorerie finale (médiane) | 831 k€ | 1 328 k€ | 307 k€ |
| Satisfaction finale (moyenne) | 56 | 53 | 68 |
| Meilleure affluence (moyenne) | 6 807 | 5 821 | 5 679 |
| Capacité finale (moyenne) | 7 740 | 11 620 | 6 000 |
| Population finale (moyenne) | 36 540 | 20 000 | 20 000 |
| Arrêts par saison | 13.4 | 12.8 | 12.1 |
| Matchs en direct par saison | 4.7 | 4.6 | 4.6 |
| Événements par saison | 3.2 | 3.1 | 3.2 |
| Durée estimée d’une saison | 19 min | 19 min | 19 min |

Durée estimée : 15 s par arrêt, 75 s par match en direct, 20 s par événement,
4 min d'intersaison et 5 min de gestion (effectif, ville) par saison.

## Arrêts par saison, selon leur raison (stratégie équilibrée)

| Raison | Arrêts par saison |
| --- | --- |
| keyMatch | 4.7 |
| event | 3.2 |
| constructionDelivered | 1.8 |
| starterInjured | 1.4 |
| winterMarket | 1.0 |
| none | 0.8 |
| seasonOver | 0.4 |
| districtUnlocked | 0.2 |
