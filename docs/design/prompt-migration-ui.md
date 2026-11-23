# Prompt d’exécution — migration UI BenchMaster

Ce prompt formalise la migration retenue et peut être réutilisé pour reprendre les lots restants.

```text
Tu interviens sur l’application web Angular BenchMaster existante. Mets en œuvre la décision de design et le plan inscrits dans docs/design/decisions-et-plan-migration.md. La structure choisie est la proposition A (espace coach sobre, pages centrées sur les tâches). La proposition B « centre de pilotage du club » n’est pas l’architecture cible.

THÈMES RETENUS
- Clair, palette Ardoise & cuivre : fond #F2F3F5, surface #FFFFFF, texte #202A35, secondaire lisible #626E7A, bordure #D9DFE5, action #31556D, accent fort #426E89, cuivre #9D572D pour le basket.
- Sombre, palette Forêt de club : fond #111B17, surface #1B2721, texte #EDF2EE, secondaire #A5B2AA, bordure #34443A, action #82C49A, accent fort #A4D9B5, ambre #E3A15B pour le basket.
- Garder les couleurs sémantiques de réussite, erreur, pause, live, désactivé et focus adaptées à chaque thème; ajouter des mots/icônes/traits en plus de la couleur. Vérifier les contrastes rendus.

OBJECTIF
Moderniser l’interface pour un rendu professionnel et maîtrisé. Garder les données, fonctions, routes, libellés produit et comportement existants. Simplifier les surfaces: fond calme, panneaux opaques, traits fins, rayons modérés, ombres et gradients seulement quand ils expriment une vraie élévation. Ne pas ajouter de navigation latérale permanente de la proposition B ni d’ornement parquet/terrain en arrière-plan global.

CONTRAINTES
- Préserver les modifications déjà présentes dans le worktree; ne jamais utiliser reset/checkout ou réécriture destructive.
- Préserver le français et l’anglais, les modes invité/connecté, la mémorisation du thème benchmaster.theme, la logique métier et la compatibilité mobile.
- Garder les cibles tactiles au moins à 44 px, boutons principaux à 48 px, focus clavier visible, annonces accessibles, safe areas et reduced motion.
- Ne pas introduire de dépendance ou de changement backend.

ORDRE
1. Mettre DESIGN.md et .impeccable/design.json en cohérence avec les thèmes retenus.
2. Migrer les tokens, shell, navigation et composants partagés.
3. Migrer l’écran live, l’accueil, préparation/effectif, résumé/historique, entraînement/réglages, matchs amicaux/invitation.
4. Vérifier les états clair/sombre, desktop/mobile, vide/chargement/erreur/brouillon/live/pause/terminé, zoom/clavier/contraste.
5. Actualiser le statut de docs/design/decisions-et-plan-migration.md selon ce qui a réellement été implémenté et vérifié; ne pas marquer les étapes finies sans preuve.

DÉCOUPAGE PARALLÈLE
Les lots de pages indépendantes peuvent être réalisés en agents séparés, mais un seul responsable doit toucher les tokens globaux, DESIGN.md, le shell et le document de migration. Assigner à chaque agent une liste exacte de fichiers; ne pas faire modifier deux agents le même fichier. Les modifications préexistantes doivent être indiquées au lot concerné et préservées.

LIVRAISON
Décrire les fichiers et écrans migrés, les vérifications réellement exécutées, les écarts restant à traiter et tout risque de contraste ou de responsive encore non vérifié. Ne pas déclarer une migration complète si une route ou un contrôle nécessaire reste en suspens.
```
