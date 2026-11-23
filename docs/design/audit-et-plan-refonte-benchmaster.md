# Audit UX/UI et plan de refonte — BenchMaster

**Date :** 23 novembre 2026
**Périmètre :** application web Angular, interface française et anglaise, formats mobile et bureau. Audit fondé sur les sources de `frontend/src/app`, le contexte produit et DESIGN.md, plus le détecteur Impeccable. Il s'agit d'une revue statique du code et des écrans; aucun test utilisateur, contrôle navigateur visuel ou mesure WCAG par pixel n'a été effectué. Les scores sont des estimations UX, et non des résultats de laboratoire.

**Maquettes :** [Prototype HTML — 10 écrans](./benchmaster-redesign-mockups.html)

**Décisions retenues et migration :** [Thème hybride A sombre + B clair et plan de migration](./decisions-et-plan-migration.md)

## Synthèse de direction

BenchMaster porte une promesse métier crédible : préparer l’effectif, décider du cinq, suivre les rotations pendant le match et comprendre le temps de jeu ensuite. L’application a déjà une identité basket et de nombreux parcours utiles. Le problème principal est la traduction visuelle : trop d’effets de surface et une exécution irrégulière des tokens rendent l’outil moins sobre et moins maîtrisé que ses fonctions.

**Direction proposée : « espace coach de club, sobre et premium ».** Conserver le logo, les accents verts/bleus existants selon le thème, l’orange réservé aux informations basket, ainsi que tous les comportements, données, langues et modes invité/connecté. Remplacer le décor parquet permanent, les dégradés répétitifs, le verre décoratif et les cartes très arrondies par un fond uni, des surfaces opaques, des séparateurs fins et une grille typographique disciplinée. Le live reste plus dense et plus contrasté que les écrans de gestion, puisque l’usage au bord du terrain domine.

Cette direction est une proposition de maquette à valider; elle ne met pas à jour `DESIGN.md` et n’a pas été appliquée au produit.

## Score UX — heuristiques de Nielsen

| # | Heuristique | Score /4 | Observation |
|---|---|---:|---|
| 1 | Visibilité de l’état du système | 3 | États live, brouillon, pause, progression et sauvegarde existent. Leur style varie selon les pages. |
| 2 | Correspondance avec le monde réel | 4 | Les notions d’effectif, cinq de départ, temps de jeu et rotations sont spécifiques au coaching basket. |
| 3 | Contrôle et liberté | 3 | Actions d’édition, retour et annulation présentes; les écrans live méritent un retour arrière/correction toujours repérable. |
| 4 | Cohérence et standards | 2 | Plusieurs familles de rayons, tailles, dégradés et traitements coexistent. |
| 5 | Prévention des erreurs | 3 | Préparation progressive et confirmation de fin configurables; bonne protection des actions sensibles. |
| 6 | Reconnaissance plutôt que mémorisation | 3 | Joueurs et statuts visibles; la navigation desktop compacte masque des libellés et dépend des infobulles. |
| 7 | Flexibilité et efficacité | 3 | Mode invité, raccourcis de création depuis l’équipe et actions rapides live; possibilités de batch restent limitées. |
| 8 | Esthétique et minimalisme | 2 | Le fond illustré et les surfaces nombreuses rivalisent avec le contenu opérationnel. |
| 9 | Gestion des erreurs | 3 | Messages d’erreur et états de chargement accessibles présents dans plusieurs parcours. |
| 10 | Aide et documentation | 2 | L’interface guide certaines étapes, mais aide contextuelle documentée peu évidente dans le code observé. |
| **Total** |  | **28/40** | **Acceptable; priorité à la cohérence de système et à la lisibilité au bord du terrain.** |

## Audit technique — indicatif

| Dimension | Score /4 | Constat |
|---|---:|---|
| Accessibilité | 3 | Nombreux labels, annonces ARIA, focus visible et cibles tactiles prévues. Le contraste réel et le parcours clavier complet restent à mesurer. |
| Performance | 3 | Pas d’anomalie majeure mesurable dans cette revue statique. Le flou du shell desktop et les couches décoratives sont à simplifier et profiler. |
| Responsive | 3 | Breakpoints mobile et navigation bas d’écran présents; le live masque volontairement la tabbar mobile, ce qui demande une navigation métier évidente. |
| Thématisation | 3 | Tokens clair/sombre structurés. Le détecteur relève des couleurs littérales et divergences d’échelle; le faux positif `rgb(0,0,0)` issu de rendu dynamique appelle une vérification manuelle. |
| Intégrité de l’implémentation | 2 | Système global documenté mais application des échelles hétérogène, surtout sur live et matchs amicaux. |
| **Total** | **14/20** | **Bon socle, écarts ciblés à harmoniser avant extension de fonctionnalités.** |

## Résultat du détecteur

Commande : `impeccable detect --json src/app/pages src/app/app.component.html`.

**75 avertissements consultatifs :** 37 tailles de police hors échelle documentée, 22 rayons hors échelle, 16 couleurs hors palette documentée. Le plus grand nombre d’écarts se trouve dans `live-match.page.scss` (16) et `friendlies.page.scss` (11). Le détecteur ne rapporte pas 75 défauts utilisateur distincts : il compte chaque valeur isolément, et le signal `rgb(0,0,0)` dans certains templates rendus peut être un artefact de calcul. Ces valeurs sont à contrôler dans le navigateur avant correction.

## Points forts à préserver

- Le produit exprime un workflow reconnaissable de coach, de la préparation au bilan de rotation.
- La configuration de match en étapes rend explicite la disponibilité puis le cinq de départ.
- Le thème clair/sombre, le français/anglais, l’usage invité et connecté sont déjà des contraintes intégrées au produit.
- Des messages live, états de chargement, libellés accessibles et confirmations existent déjà; la refonte doit les conserver.
- Les résumés s’appuient sur les données réellement suivies (temps, rotations, chronologie) plutôt que sur des promesses marketing inventées.

## Problèmes prioritaires

### P1 — Fond sportif trop présent dans toutes les situations

**Emplacement :** `frontend/src/app/shell-global.scss`, pseudo-élément `.shell::before`.
**Impact :** lignes de terrain, motif répété et effet parquet restent derrière des pages de formulaire et de lecture de données; le contenu semble posé sur une scène décorative, avec un rendu typique de template génératif.
**Recommandation :** fond uni neutre pour la majorité des pages; garder le vocabulaire basket dans les données, l’orange sémantique et, si souhaité, une seule zone de score live. Réserver une atmosphère plus marquée au seul écran match, sans motif sous chaque carte.

### P1 — Surfaces et relief trop uniformes

**Emplacement :** `frontend/src/styles.scss` (`.surface-card`, `--shadow-card`) et styles des pages.
**Impact :** ombre large, grands rayons, surfaces vitrées et gradients donnent le même poids à des éléments qui n’ont pas la même importance; l’ensemble évoque un kit de composants plus qu’un outil métier.
**Recommandation :** surfaces opaques, rayon principal entre 4–8 px pour les panneaux de travail (et 10–12 px seulement quand l’usage le justifie), séparateurs fins; supprimer les ombres sauf superposition réelle. Introduire listes et tableaux compacts au lieu d’imbriquer les cartes.

### P1 — Dérive des tokens entre pages

**Emplacement :** styles de `live-match`, `friendlies`, `game-summary`, `home`, `coach-settings`, `team-roster`, `new-game-setup`.
**Impact :** contrôles semblables n’ont pas toujours même densité, rayon ou taille; le produit paraît amateur même lorsque chaque écran fonctionne seul.
**Recommandation :** définir une échelle typographique courte, deux rayons fonctionnels, des tailles d’espacement et les couleurs d’état sémantiques; aligner les composants partagés et retirer les valeurs locales répétées. Refaire ensuite le scan.

### P1 — Écran live : hiérarchie opérationnelle à protéger

**Emplacement :** `frontend/src/app/pages/live-match/live-match.page.html` et `.scss`.
**Impact :** l’écran réunit chronomètres, contrôles d’état, joueurs sur le terrain, banc, statistiques, événements et actions de fin. Pendant un match, une compétition visuelle ou une action difficile à atteindre coûte du temps au coach.
**Recommandation :** chrono/période/statut en premier, cinq sur le terrain immédiatement après, remplacements accessibles en un geste, actions rapides regroupées; réserver les contrôles destructifs et les détails historiques à une zone secondaire. Conserver les cibles tactiles d’au moins 44 px et tester le format mobile réel.

### P2 — Navigation de bureau iconographique et parcours multi-fonctions

**Emplacement :** `frontend/src/app/app.component.html` et `.scss`; navigation latérale desktop repliable.
**Impact :** les libellés disparaissent sous 768–959 px ou lorsque le panneau est replié; les routes de l’effectif et de configuration sont contextuelles, tandis que l’accueil concentre équipes et sessions. La découverte repose parfois sur la mémoire.
**Recommandation :** libellés visibles sur les destinations principales ou zone latérale persistante, avec indication de section active; rendre les accès contextuels effectif / match / entraînement cohérents depuis une équipe.

### P2 — Un grand nombre de vues d’organisation sans même grammaire

**Emplacement :** `new-game-setup`, `training-setup`, `friendlies`, `history`, `coach-settings`.
**Impact :** les formulaires, filtres, listes et étapes n’ont pas une structure visuelle assez prévisible à travers le produit.
**Recommandation :** composants de page standardisés : titre sans eyebrow décoratif, action principale au même emplacement, groupes de formulaire alignés, listes tabulaires au bureau et lignes tactiles sur mobile, états vides explicatifs avec prochaine action.

## Direction de maquettes — couverture

Le prototype HTML contient dix écrans statiques à parcourir avec sa barre de navigation :

1. **Accueil** — équipes, sessions récentes et accès direct à une session en cours.
2. **Effectif** — recherche, équipe et liste structurée des joueurs.
3. **Préparation de match** — progression en trois étapes, groupe disponible, choix des titulaires.
4. **Match en direct** — tableau de score, chrono, cinq actif et banc.
5. **Résumé** — indicateurs de session, temps par joueur, lecture coach et chronologie.
6. **Historique** — recherche, filtres et statuts comparables.
7. **Entraînement** — paramètres simples et présence de l’effectif.
8. **Réglages coach** — préférences regroupées et sauvegarde explicite.
9. **Matchs amicaux** — propositions et disponibilité d’équipe.
10. **Invitation** — réponse de disponibilité publique, optimisée pour mobile.

Les noms et valeurs d’exemple de ces maquettes servent à illustrer l’interface; ils ne décrivent pas des données réelles. Les comportements de filtres et boutons sont ici représentatifs, pas fonctionnels.

## Plan de refonte proposé

### Phase 1 — Valider la direction

Confirmer le caractère « sobre et premium », l’équilibre entre accent marque et signal basket, et le statut d’écran prioritaire du live. La présente maquette est une base de discussion, non une approbation de production.

### Phase 2 — Poser le système visuel

Mettre à jour DESIGN.md après validation : fond et surfaces opaques, échelles typographique et spatiale, rayons, couleurs d’état et comportements clair/sombre. Maintenir des contrastes lisibles au soleil et en salle, sans décor sous les données.

### Phase 3 — Refaire le shell et les composants communs

Navigation, titres, boutons, formulaires, tags d’état, lignes joueurs, tableaux, bannières d’erreur/vide/chargement. Conserver navigation clavier, focus visible, labels ARIA et 44 px minimum pour les cibles tactiles.

### Phase 4 — Implémenter par valeur d’usage

1. Match en direct et changements.
2. Accueil et reprise de session.
3. Préparation de match et effectif.
4. Résumé et historique.
5. Entraînement et réglages.
6. Matchs amicaux, candidatures, invitations externes.

### Phase 5 — Vérifier le résultat

Captures desktop et mobile en clair et sombre; parcourir les états vide, chargement, erreur, brouillon, live, pause, fini et contenu long; vérifier navigation clavier, zoom et contraste des textes. Refaire le scan déterministe après harmonisation des tokens.

## Mise à jour de migration — 23 novembre 2026

La direction retenue est maintenant Proposition A avec la palette claire « Ardoise & cuivre » et la palette sombre « Forêt de club ». L’implémentation UI a commencé dans les tokens globaux et plusieurs feuilles de style; compilation et inspection des états restent à effectuer. Voir [les décisions et le plan de migration](./decisions-et-plan-migration.md).

## Maquette et limites

Prototype autonome : [benchmaster-redesign-mockups.html](./benchmaster-redesign-mockups.html). Il ne modifie pas l’application. Les contrôles y sont illustratifs, les chiffres et noms sont fictifs, et une revue navigateur/contraste n’a pas été réalisée. Aucun code de production n’a été modifié.
