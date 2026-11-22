# Mode entraînement — spécification produit

**Statut :** proposition produit revue sur la base de l’application existante, prête pour validation métier avant implémentation.
**Périmètre :** suivi en direct des joueurs d’une équipe pendant une séance, dans le même écran opérationnel que le match.

## Résumé

Le coach peut démarrer une séance d’entraînement et enregistrer les statistiques de chaque joueur de l’équipe, sans sélectionner un cinq de départ et sans limite de cinq joueurs actifs. Le suivi s’appuie sur l’interface live du match : horloge, cartes joueurs, actions de statistiques, pause/reprise, rotations et récapitulatif. La séance est identifiée comme entraînement dès sa création et reste distinguable dans l’historique.

## Problème et résultat attendu

Aujourd’hui, le flux live est conçu pour un match : la préparation demande un groupe disponible et exactement cinq titulaires, et le service métier vérifie ces contraintes au démarrage. Un coach qui veut suivre un exercice ou un entraînement collectif ne peut donc pas enregistrer tout le groupe avec le même outil.

**Résultat attendu :** le coach lance rapidement une séance, suit chaque joueur de son effectif, et utilise les mêmes contrôles de saisie que pendant un match, avec une capacité active flexible.

## Utilisateurs et besoin

- **Utilisateur principal :** coach de basket utilisant BenchMaster au bord du terrain, généralement sur téléphone.
- **Besoin :** « Pendant un entraînement, je veux suivre les stats de tout mon groupe et voir la même interface live que pour un match, sans devoir composer un cinq. »

## Décisions produit proposées

1. Une séance est une session distincte d’un match, avec un type explicite `TRAINING` (le match reste `GAME`).
2. La séance part de l’effectif complet de l’équipe. Le coach peut retirer un joueur absent/blessé avant de démarrer; cette sélection est optionnelle et peut inclure tout l’effectif.
3. Les titulaires n’existent pas en entraînement. Le coach peut activer/désactiver n’importe quel nombre de joueurs suivis, y compris zéro ou tout le groupe. L’indicateur « sur le terrain » devient « actif » pour éviter d’affirmer une présence réelle sur le terrain pendant les ateliers.
4. L’écran live réutilise la structure et les contrôles du match : horloge, stats, corrections, liste suivie / non active, événements de rotation, pause/reprise et fin.
5. Aucun format de quart-temps n’est demandé pour démarrer. Les segments sont facultatifs; le compteur de séance est l’horloge principale. Les événements de rotation restent horodatés à la durée écoulée.
6. Le résumé d’entraînement montre les stats par joueur, temps actif et chronologie. Les insights propres aux titulaires/banc et aux cinq joueurs sont masqués.
7. Les statistiques disponibles initialement sont celles du live actuel : points, rebonds, passes décisives, contres, interceptions et fautes. Le libellé « points » est conservé même si la séance utilise des exercices plutôt qu’un score d’équipe.
8. Les modes invité et connecté sont pris en charge selon les mêmes règles de persistance que les matchs.

## Parcours principal

1. Depuis la carte équipe, le coach choisit **Nouvel entraînement**.
2. Il choisit l’équipe si nécessaire et donne un nom à la séance (par défaut « Entraînement — [date] »).
3. La liste de l’effectif complet est présélectionnée. Le coach peut retirer les absents; aucune étape « cinq de départ » n’est affichée.
4. Un aperçu indique `N joueurs suivis` et le coach démarre.
5. L’écran live affiche l’horloge de séance, l’état, les joueurs actifs et les joueurs suivis non actifs. Chaque carte conserve les contrôles rapides de stats et le détail/correction existant.
6. Le coach active ou désactive des joueurs à tout moment. Aucun message de contrainte à cinq joueurs n’apparaît et les actions restent disponibles avec un nombre actif arbitraire.
7. Le coach met en pause/reprend ou termine la séance, puis ouvre le résumé.

## Exigences fonctionnelles

### Création et historique

- Le point d’entrée **Nouvel entraînement** est disponible pour chaque équipe, à côté de l’action de nouveau match.
- Le formulaire conserve la sélection d’équipe existante et ajoute un nom de séance facultatif.
- Tous les joueurs de l’effectif sont cochés par défaut; la sélection vide bloque la création avec une explication et un lien vers l’effectif.
- L’entraînement n’exige ni cinq joueurs sélectionnés ni cinq titulaires.
- Les listes/détails distinguent clairement match et entraînement par texte et icône, avec nom d’équipe, date et état.
- Les sessions en brouillon, en cours, en pause et terminées restent accessibles selon les règles actuelles.

### Suivi live

- Le même écran de référence est utilisé que pour un match; son en-tête porte le badge **Entraînement**.
- Les actions existantes de stats et de correction restent disponibles pour tous les joueurs sélectionnés.
- Le nombre de joueurs actifs est affiché sous la forme `Actifs X / N`; aucune validation ne limite X à cinq.
- Les changements d’état actif produisent des événements horodatés et mettent à jour le temps actif sans perdre les séquences précédentes.
- Pause/reprise, fin et reprise après rechargement suivent le comportement du match.
- Les périodes de match (quarts) ne sont pas imposées. L’horloge de séance est continue; si des segments sont proposés ultérieurement, ils doivent être configurables et facultatifs.
- Les erreurs réseau conservent le feedback actuel; une action non confirmée ne doit pas être présentée comme enregistrée.

### Résumé

- Afficher durée totale, joueurs suivis, temps actif individuel, points et autres stats enregistrées, ainsi que la chronologie.
- Ne pas afficher « titulaire », « banc », répartition titulaires/banc ou recommandations d’utilisation fondées sur un cinq.
- Le partage public, si conservé, indique clairement qu’il s’agit d’un entraînement et n’invente aucun score adverse.

## Maquette et composants

Voir [maquette du mode entraînement](../mockups/mode-entrainement.html). Elle couvre la préparation avec sélection facultative de l’effectif et l’écran live partagé : badge d’entraînement, compteurs actifs et cartes de stats. Les styles suivent `DESIGN.md`; la maquette est interactive pour basculer les joueurs actifs et simuler la sélection.

Composants ou adaptations à prévoir :

- entrée **Nouvel entraînement** sur la carte équipe;
- variante d’en-tête de type de session;
- préparation d’effectif sans cinq de départ;
- libellé et compteur des joueurs actifs;
- cartes réutilisées avec actions statistiques existantes;
- résumé adapté aux entraînements et badges dans l’historique.

## Modèle et implications techniques à valider

Le modèle courant s’appelle `Game` et les invariants de match sont appliqués dans les services backend (dont `ensureExactlyFiveStarters`). Pour éviter de casser le flux match, ajouter un type de session explicite avec migration additive et appliquer les validations selon le type. Une première livraison peut garder les tables/routes partagées sous le concept de session, tant que type et règles sont explicites côté API, stockage invité, sérialisation, export et résumé.

- `sessionType: GAME | TRAINING`, valeur par défaut `GAME` pour compatibilité.
- En entraînement, `isStarter` est absent/ignoré et la contrainte de cinq titulaires est désactivée.
- Les transitions de joueurs actifs en entraînement peuvent être enregistrées avec l’événement existant `SUBSTITUTION`, mais l’API/UI doit le présenter comme changement d’activité. Un événement métier dédié sera préférable si l’analytique distingue les rotations de match des exercices.
- La période de match et les fautes collectives ne doivent pas être des prérequis en entraînement. L’horloge continue s’appuie sur les mêmes mécanismes de temps serveur.
- Vérifier migration, sérialisation invité, partage/export, liste d’accueil et statistiques récapitulatives avant implémentation.

## Critères d’acceptation

1. Un coach peut créer un entraînement avec un, cinq, six ou davantage de joueurs sélectionnés, jusqu’à tout l’effectif.
2. La création et le démarrage réussissent sans sélectionner de titulaires.
3. Tous les joueurs suivis sont visibles dans l’expérience live, avec les mêmes contrôles statistiques que lors d’un match.
4. Le coach peut avoir 0, 1, 5, 6 ou N joueurs actifs; aucune règle de match n’empêche l’action.
5. Les stats et temps d’activité restent attribués au bon joueur après pause, reprise, changement d’activité et rechargement.
6. Une séance terminée est identifiée comme entraînement dans l’historique et le résumé.
7. Le résumé n’expose pas de statistiques trompeuses de titulaires/banc ni d’adversaire/score de match.
8. Le match existant conserve son exigence actuelle de cinq titulaires et ses validations.
9. Le flux fonctionne en français/anglais, mobile/desktop, thème clair/sombre et modes invité/connecté.

## Hors périmètre initial

- Planification d’exercices, chronomètres par atelier ou bibliothèques de drills.
- Présence/absences persistantes dans l’effectif, notes individuelles, évaluations qualitatives.
- Stats avancées telles que tirs tentés, réussis, rebonds offensifs/défensifs, charges ou temps par atelier.
- Comparaison automatique entraînement/match et partage avec les joueurs.
- Plusieurs équipes ou plusieurs coachs sur une même séance.

## Risques et questions de validation

- **Sémantique des statistiques :** points, fautes et interceptions peuvent ne pas être pertinents pour chaque exercice. La V1 les reprend pour conserver la même interface; faut-il permettre de masquer/configurer des métriques ?
- **Temps actif :** le modèle actuel assimile le suivi à une présence sur le terrain. Valider que l’indicateur « actif » décrit bien les séquences suivies par le coach, sans prétendre à une mesure automatique de participation.
- **Historique :** confirmer si entraînements et matchs doivent partager une seule liste filtrable ou apparaître dans deux sections.
- **Segments :** confirmer si les segments (ex. ateliers) sont nécessaires à la première version ou si l’horloge continue suffit.
- **Données existantes :** confirmer la conservation d’une session après suppression d’un joueur, selon la politique actuelle des matchs.

## Validation produit

**Évaluation :** proposition cohérente avec le besoin et l’architecture visible; bonne candidate pour une V1 après arbitrage des quatre questions de périmètre ci-dessus. Les règles clés sont non ambiguës : réutiliser le live, suivre tout l’effectif sélectionné, ne jamais imposer cinq joueurs actifs, et préserver les contraintes des matchs.

**Décisions à obtenir avant le développement :**

- confirmer les statistiques identiques à celles du match ou une sélection de métriques;
- confirmer une horloge continue sans segments configurables en V1;
- confirmer la présentation dans l’historique;
- confirmer le vocabulaire « joueurs actifs » dans l’interface.

## Mesure de réussite

- Taux de séances créées puis terminées sans erreur.
- Part des séances avec au moins un joueur suivi et une statistique enregistrée.
- Temps entre l’ouverture de la préparation et le démarrage.
- Événements d’abandon dans la préparation et erreurs de démarrage.

Ne fixer des objectifs chiffrés qu’après collecte d’une baseline; aucune baseline n’est actuellement documentée.
