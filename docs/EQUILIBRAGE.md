# Équilibrage — rapport de simulation

Généré par `npm run simulate` : 100 parties de 5 saisons par stratégie, mêmes graines pour les trois.

| Mesure | Équilibrée | Tout sur le stade | Tout sur les joueurs |
| --- | --- | --- | --- |
| Faillites | 1 % | 16 % | 23 % |
| Meilleure division (moyenne, 1 = D3, 3 = Élite) | 2.04 | 1.42 | 2.07 |
| Parties qui atteignent la Division 2 | 89 % | 42 % | 85 % |
| Parties qui atteignent l'Élite | 15 % | 0 % | 22 % |
| Titres par partie | 0.90 | 0.26 | 1.02 |
| Trésorerie finale (médiane) | 1 096 k€ | 2 079 k€ | 665 k€ |
| Satisfaction finale (moyenne) | 55 | 53 | 67 |
| Meilleure affluence (moyenne) | 6 886 | 5 864 | 5 772 |
| Capacité finale (moyenne) | 7 860 | 11 740 | 6 000 |
| Population finale (moyenne) | 37 480 | 20 000 | 20 000 |
| Arrêts par saison | 13.7 | 12.7 | 12.3 |
| Matchs en direct par saison | 4.8 | 4.7 | 5.0 |
| Événements par saison | 3.2 | 3.1 | 3.1 |
| Durée estimée d’une saison | 20 min | 19 min | 19 min |

Durée estimée : 15 s par arrêt, 75 s par match en direct, 20 s par événement,
4 min d'intersaison et 5 min de gestion (effectif, ville) par saison.

## Arrêts par saison, selon leur raison (stratégie équilibrée)

| Raison | Arrêts par saison |
| --- | --- |
| keyMatch | 4.8 |
| event | 3.2 |
| constructionDelivered | 1.9 |
| starterInjured | 1.3 |
| winterMarket | 1.0 |
| none | 0.8 |
| seasonOver | 0.4 |
| districtUnlocked | 0.2 |
| treasuryNegative | 0.0 |
