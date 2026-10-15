# Équilibrage — rapport de simulation

Généré par `npm run simulate` : 100 parties de 5 saisons par stratégie, mêmes graines pour les trois.

| Mesure | Équilibrée | Tout sur le stade | Tout sur les joueurs |
| --- | --- | --- | --- |
| Faillites | 2 % | 15 % | 22 % |
| Meilleure division (moyenne, 1 = D3, 3 = Élite) | 1.96 | 1.44 | 2.01 |
| Parties qui atteignent la Division 2 | 88 % | 44 % | 86 % |
| Parties qui atteignent l'Élite | 8 % | 0 % | 15 % |
| Titres par partie | 0.86 | 0.37 | 0.92 |
| Trésorerie finale (médiane) | 1 070 k€ | 1 413 k€ | 769 k€ |
| Satisfaction finale (moyenne) | 56 | 53 | 68 |
| Meilleure affluence (moyenne) | 6 869 | 5 809 | 5 788 |
| Capacité finale (moyenne) | 7 860 | 11 600 | 6 000 |
| Population finale (moyenne) | 35 080 | 20 000 | 20 000 |
| Arrêts par saison | 13.5 | 12.7 | 12.2 |
| Matchs en direct par saison | 4.7 | 4.5 | 4.6 |
| Événements par saison | 3.2 | 3.3 | 3.2 |
| Durée estimée d’une saison | 19 min | 19 min | 19 min |

Durée estimée : 15 s par arrêt, 75 s par match en direct, 20 s par événement,
4 min d'intersaison et 5 min de gestion (effectif, ville) par saison.

## Arrêts par saison, selon leur raison (stratégie équilibrée)

| Raison | Arrêts par saison |
| --- | --- |
| keyMatch | 4.7 |
| event | 3.2 |
| constructionDelivered | 1.7 |
| starterInjured | 1.4 |
| winterMarket | 1.0 |
| none | 0.8 |
| seasonOver | 0.4 |
| districtUnlocked | 0.2 |
