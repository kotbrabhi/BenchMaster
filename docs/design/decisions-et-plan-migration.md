# Décisions de design et plan de migration — BenchMaster

**Statut :** migration UI en cours; socle tokens/shell et lots principaux modifiés, compilation et revue finale en attente.
**Date :** 23 novembre 2026

## Décisions retenues

### Structure et concept

- La **proposition A** est retenue comme direction de structure et de présentation : espace coach sobre et premium, pages centrées sur une tâche, surfaces calmes et données faciles à lire.
- La **proposition B « centre de pilotage du club » n’est pas retenue** comme architecture de l’application. Elle reste une exploration comparative et ne doit pas guider l’implémentation.
- Garder les routes, fonctions métier, parcours existants, identité BenchMaster, français/anglais, mode invité/connecté et fonctionnement mobile.
- Le suivi du match en direct reste le parcours à traiter en premier, car c’est le point d’usage distinctif de BenchMaster.

### Palette de production décidée

La palette est hybride, par thème :

| Mode | Source choisie | Direction | Couleurs de référence des maquettes |
|---|---|---|---|
| Clair | Palette B « Ardoise & cuivre » | Fond gris bleuté très clair, panneaux blancs, texte ardoise, actions bleu ardoise, cuivre réservé aux accents basket | Fond `#F2F3F5`, surface `#FFFFFF`, texte `#202A35`, texte secondaire `#6F7B88`, bordure `#D9DFE5`, accent `#31556D`, accent fort `#426E89`, cuivre `#B66C3F` |
| Sombre | Palette A « Forêt de club » | Fond vert-noir, surfaces vert ardoise, texte craie, actions menthe, ambre réservé aux accents basket | Fond `#111B17`, surface `#1B2721`, texte `#EDF2EE`, texte secondaire `#A5B2AA`, bordure `#34443A`, accent `#82C49A`, accent fort `#A4D9B5`, ambre `#E3A15B` |

Ces valeurs sont les couleurs de référence observées dans la maquette comparative, pas encore une rampe de production complète. Elles devront être adaptées pour les états de succès, avertissement, erreur, sélection, désactivation, graphiques et superpositions, puis vérifiées en contraste. Le cuivre/ambre ne devient pas la couleur d’action principale par défaut.

**Contraste de thèmes :** on conserve le choix clair/sombre à la demande de l’utilisateur. Le thème reste mémorisé dans `localStorage` via `benchmaster.theme`; l’apparence système ne remplacera pas la préférence existante.

### Direction visuelle

- Supprimer l’illustration parquet et les lignes de terrain en arrière-plan global; le basket doit apparaître dans le contenu et les données.
- Préférer des surfaces opaques, séparateurs fins et relief réservé aux menus/dialogues réellement superposés.
- Réduire l’impression de cartes imbriquées et de grands rayons uniformes; employer une grille et des lignes de données quand elles servent mieux la tâche.
- Conserver la navigation actuelle adaptée aux tailles d’écran; ne pas introduire la barre latérale permanente de la proposition B sans nouvelle décision.
- Préserver le contraste et la taille des actions utiles au bord du terrain, les cibles tactiles (44 px au minimum) et les états textuels qui complètent la couleur.

## Plan de migration

### État d’avancement au 23 novembre 2026

- [x] Direction A, thèmes clair Ardoise & cuivre et sombre Forêt de club consignés dans `DESIGN.md` et son sidecar `.impeccable/design.json`.
- [x] Prompt d’exécution réutilisable ajouté dans [prompt-migration-ui.md](./prompt-migration-ui.md).
- [x] Tokens globaux, surfaces partagées, shell et fond global adaptés aux palettes choisies.
- [x] Lots de styles live, effectif/préparation, résumé, entraînement, réglages et matchs amicaux modifiés en parallèle.
- [x] Compiler l’application : `npm run build` réussit après réduction du SCSS préparation. Aucun blocage de compilation; avertissements de budgets conservés ci-dessous.
- [ ] Revoir les routes et états en clair/sombre et desktop/mobile. L’aperçu local a servi une ancienne version; un serveur neuf ne démarre pas dans cet environnement (`EPERM` sur bind localhost), donc la revue visuelle reste en attente. Les ratios statiques des paires de palette principales dépassent 4,5:1; vérifier encore les états réels.
- [ ] Finaliser accueil/historique et documenter les exceptions après inspection visuelle.
- [x] Lancer le détecteur Impeccable une fois après les changements : il reste des avis de tailles typographiques/rayons/couleurs hors échelle, dont des faux positifs `rgb(0,0,0)` de templates dynamiques; les occurrences n’ont pas toutes été retouchées. La consolidation finale après revue visuelle reste à faire.

Les cases de code ci-dessus décrivent des modifications effectuées; elles ne valent pas validation visuelle ou fonctionnelle.

**Budgets Angular :** compilation réussie. Avertissements non bloquants : bundle initial 625,83 Ko (cible 600 Ko), `new-game-setup.page.scss` 10,57 Ko (cible 10 Ko), `live-match.page.scss` 10,62 Ko, `app.component.scss` 11,48 Ko et `player-card.component.scss` 11,99 Ko. La feuille préparation est passée sous son seuil bloquant de 12 Ko.

**Contrastes statiques des paires principales :** texte léger/fond clair 13,1:1; secondaire clair/surface blanche 5,21:1; texte bouton clair/action 7,92:1; cuivre/surface blanche 5,48:1; texte sombre/fond sombre 15,54:1; secondaire sombre/surface 7,03:1; texte bouton sombre/action 7,88:1; ambre/surface sombre 7,0:1. Ce calcul ne remplace pas la vérification des états composites dans le navigateur.

### Phase 0 — Mettre à jour la source de vérité — réalisée

1. Réviser `DESIGN.md` pour enregistrer le choix A comme système actif et inscrire les palettes clair/sombre hybrides ci-dessus.
2. Remplacer les prescriptions actuelles qui contredisent la direction retenue : fond parquet global, bleu clair et menthe sombre comme paire obligatoire, cartes systématiquement arrondies et ombrées.
3. Compléter les tokens sémantiques (accent action, accent basket, danger, succès, avertissement, statut live/pause/terminé, contrôle, focus, overlay et graphiques) pour chaque thème.
4. Garder `PRODUCT.md` inchangé : aucune décision ne modifie la finalité ou les fonctions du produit.

**Livrable de sortie :** DESIGN.md cohérent avec la décision, rampes clair/sombre complètes et exemples de composants partagés.

### Phase 1 — Stabiliser les tokens et le shell — modifiée, validation en attente

1. Remplacer les valeurs actuelles `:root` et `:root[data-theme='dark']` de `frontend/src/styles.scss` par les deux palettes choisies et leurs tokens sémantiques.
2. Vérifier que le basculement dans `frontend/src/app/app.component.ts` continue de fonctionner et que le choix reste mémorisé.
3. Simplifier `frontend/src/app/shell-global.scss` pour enlever le parquet, le quadrillage et le terrain en filigrane global.
4. Revoir fond, navigation, header, panneau latéral, bannière d’installation, menus, feuilles de dialogue et focus visibles dans les deux thèmes.
5. Conserver les dimensions tactiles, les zones sûres mobiles, `prefers-reduced-motion` et l’ordre clavier.

**Sortie :** le shell et les composants globaux se lisent correctement dans les deux thèmes avant la migration page par page.

### Phase 2 — Extraire la grammaire des composants — en cours

1. Harmoniser boutons primaire/secondaire/danger, champs, états, tags, bannières, panneaux, lignes joueur, listes et tables.
2. Introduire une échelle commune de taille/poids typographiques, espacement et rayons compacts.
3. Réserver les dégradés et ombres aux usages justifiés; préférer la couleur unie et le séparateur pour les surfaces normales.
4. Vérifier les libellés et affordances d’icônes en FR/EN, les textes longs et les erreurs/vides/chargements.

**Sortie :** styles et composants partagés suffisamment cohérents pour éviter les correctifs visuels spécifiques à chaque route.

### Phase 3 — Migrer les pages par priorité métier — partiellement modifiée

1. **Match en direct** — chrono, période et statut, cinq sur le terrain, banc, remplacement, actions rapides, pause/fin, chronologie.
2. **Accueil** — équipes, reprise de session, sessions récentes et action principale.
3. **Préparation de match et effectif** — étapes, disponibilité, titulaires, recherche et gestion des joueurs.
4. **Résumé et historique** — tableaux de temps de jeu, repères de rotation, chronologie, recherche et filtres.
5. **Entraînement et réglages du coach** — formulaire, présences, préférences et états de sauvegarde.
6. **Matchs amicaux et parcours d’invitation** — propositions, disponibilité, sélection d’effectif, états externes et mobile.

Chaque page doit basculer entièrement sur les tokens partagés; éviter que des fragments de l’ancienne palette restent dans les états locaux.

### Phase 4 — Contrôles de finition — à faire

- Capturer les parcours prioritaires sur mobile et desktop dans les modes clair et sombre.
- Vérifier états vide, chargement, erreur, brouillon, live, pause, terminé, sélection, désactivé, confirmation et contenu long.
- Contrôler le contraste du texte normal et du texte large, des contrôles, états et focus; corriger avant diffusion.
- Vérifier zoom navigateur, navigation clavier, annonces lecteurs d’écran, orientation mobile et utilisation à une main pendant le live.
- Relancer `impeccable detect --json` sur le frontend migré et trier les écarts par règles récurrentes; ne pas traiter chaque valeur consultative comme un défaut sans contexte.
- Comparer le comportement de persistance du thème avant/après.

### Phase 5 — Livraison progressive — à faire

- Livrer d’abord les tokens et le shell dans une branche de refonte, puis chaque lot de routes en revue séparée.
- Conserver des captures de référence A avant/après et documenter les exceptions de composants.
- Faire une vérification fonctionnelle des parcours de préparation, live, fin de match et résumé à chaque lot; la refonte ne doit pas changer la logique métier.

## Ordre de travail recommandé

1. DESIGN.md et rampes de tokens.
2. Shell et thème persistant.
3. Composants de base.
4. Live et accueil.
5. Préparation / effectif.
6. Résumé / historique.
7. Entraînement / réglages.
8. Matchs amicaux / invitation.
9. Vérifications responsive, a11y, contraste et cohérence.

## Hors périmètre de cette décision

- Le document décrit la décision; la migration de code a commencé en parallèle. Le déploiement reste hors périmètre.
- Aucun changement d’architecture de navigation vers le centre de pilotage B.
- Aucune modification des données, du backend, des fonctions de compte ou des règles de session.
- Aucun choix de nouvelle police ou de nouvelle identité de logo.

## Références

- [Proposition A — maquettes des parcours](./benchmaster-redesign-mockups.html)
- [Proposition B — concept centre de pilotage](./benchmaster-redesign-mockups-b.html)
- [Comparatif initial des palettes](./benchmaster-palettes-accueil.html)
- [Audit et plan de refonte](./audit-et-plan-refonte-benchmaster.md)
