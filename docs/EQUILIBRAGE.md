# Équilibrage — rapport de simulation

Généré par `npm run simulate` : 100 parties de 5 saisons par stratégie, mêmes graines pour les trois.

| Mesure | Équilibrée | Tout sur le stade | Tout sur les joueurs |
| --- | --- | --- | --- |
| Faillites | 2 % | 11 % | 20 % |
| Meilleure division (moyenne, 1 = D3, 3 = Élite) | 2.02 | 1.37 | 1.96 |
| Parties qui atteignent la Division 2 | 89 % | 37 % | 81 % |
| Parties qui atteignent l'Élite | 13 % | 0 % | 15 % |
| Titres par partie | 0.86 | 0.25 | 0.82 |
| Trésorerie finale (médiane) | 981 k€ | 1 228 k€ | 750 k€ |
| Satisfaction finale (moyenne) | 52 | 53 | 66 |
| Meilleure affluence (moyenne) | 6 824 | 5 615 | 5 739 |
| Capacité finale (moyenne) | 7 840 | 11 600 | 6 000 |
| Population finale (moyenne) | 36 780 | 20 000 | 20 000 |
| Arrêts par saison | 15.6 | 15.0 | 14.4 |
| Matchs en direct par saison | 4.6 | 4.6 | 4.6 |
| Événements par saison | 5.5 | 5.2 | 5.5 |
| Durée estimée d’une saison | 21 min | 20 min | 20 min |

Durée estimée : 15 s par arrêt, 75 s par match en direct, 20 s par événement,
4 min d'intersaison et 5 min de gestion (effectif, ville) par saison.

## Arrêts par saison, selon leur raison (stratégie équilibrée)

| Raison | Arrêts par saison |
| --- | --- |
| event | 5.5 |
| keyMatch | 4.6 |
| constructionDelivered | 1.8 |
| starterInjured | 1.3 |
| winterMarket | 1.0 |
| none | 0.8 |
| seasonOver | 0.4 |
| districtUnlocked | 0.2 |
| treasuryNegative | 0.0 |
