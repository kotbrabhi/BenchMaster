# Configuration coach — proposition produit

**Date :** 22 novembre 2026
**Statut :** proposition produit et maquette à valider avant implémentation
**Accès :** utilisateurs connectés uniquement
**Maquette :** [configuration-coach.html](../mockups/configuration-coach.html)

## Résumé

Ajouter un écran de configuration personnel au coach, accessible depuis le menu compte. Il rassemble les préférences qui influencent la préparation et le suivi des sessions : préférences de match, statistiques visibles, confirmations et notifications. Les réglages sont associés au compte connecté et peuvent avoir des valeurs différentes selon le coach.

La V1 doit rester légère : paramètres fréquents, impact clair, valeurs par défaut cohérentes avec le fonctionnement actuel. Les préférences déjà globales (langue et thème) restent dans la navigation existante et ne sont pas dupliquées ici.

## Problème et résultat attendu

Les coachs peuvent gérer leurs effectifs et sessions, mais les comportements de préparation/live sont définis par défaut. Des choix comme la durée des périodes, le nombre de périodes, l’affichage des statistiques et les confirmations de fin peuvent varier d’un coach à l’autre.

**Résultat attendu :** le coach configure une fois ses préférences de travail, les retrouve lors de ses prochaines sessions et peut les changer sans affecter les autres comptes.

## Utilisateur et besoin

- **Utilisateur principal :** coach de basket connecté, utilisant BenchMaster avec une ou plusieurs équipes.
- **Besoin :** « Je veux adapter les réglages de préparation et de suivi à ma façon de coacher, et les retrouver automatiquement la prochaine fois. »
- **Mode invité :** l’écran et l’accès aux préférences de compte ne sont pas disponibles. Les sessions invitées conservent les comportements actuels.

## Périmètre recommandé

### V1 — préférences du coach

1. **Configuration de match par défaut**
   - Nombre de périodes : 2, 4, 6 ou 8.
   - Durée d’une période : 5, 8, 10 ou 12 minutes; possibilité d’une valeur personnalisée si les contrôles actuels le permettent proprement.
   - Ces valeurs préremplissent la création d’un nouveau match et restent modifiables pour ce match.
2. **Affichage des statistiques live**
   - Statistiques à afficher dans les actions rapides : points, rebonds, passes décisives, contres, interceptions et fautes.
   - Temps de jeu affiché en **minutes** ou en **pourcentage du temps total de match**. Valeur par défaut proposée : minutes; le réglage ne change que la présentation, pas le temps enregistré.
   - Au moins une statistique doit rester active. Masquer une statistique ne supprime jamais les données déjà enregistrées.
3. **Confirmations et flux de fin**
   - Demander confirmation avant de terminer une session (activé par défaut).
   - Ouvrir automatiquement le résumé après la fin (activé par défaut).
4. **Notifications**
   - Activer/désactiver les notifications push si le navigateur/appareil les prend en charge; afficher l’état de permission et un chemin vers les réglages du navigateur en cas de blocage.
   - Notifications internes de matchs amicaux restent accessibles dans l’en-tête; le réglage push existant peut être déplacé ou lié ici plutôt que dupliqué.
5. **Gestion des préférences**
   - Enregistrement explicite avec état « Modifications non enregistrées » et retour visuel de sauvegarde.
   - Action « Réinitialiser les préférences » avec confirmation, restaure les valeurs par défaut V1.

### À considérer dans une version ultérieure

- Préférences par équipe, lorsqu’un même coach encadre plusieurs équipes aux formats différents.
- Paramètres d’entraînement distincts (durée, segments/ateliers et liste de statistiques pertinente).
- Valeurs par défaut de composition et rappel d’effectif.
- Profil coach/club, informations de contact et visibilité dans le réseau des matchs amicaux.
- Export, partage de résumé et politique de conservation.

Ces sujets sont reportés car ils touchent au modèle d’équipe, à la confidentialité ou à des comportements métier plus larges. Ils ne doivent pas encombrer la première version.

## Maquette d’écran

La maquette HTML liée ci-dessus illustre l’écran de bureau et sa disposition mobile. Structure proposée :

```text
┌──────────────────────────────────────────────────────┐
│ Réglages du coach                         Enregistré │
│ Personnalisez vos prochaines sessions.               │
├──────────────────────────────────────────────────────┤
│ MATCHS                                                │
│ Format par défaut        Périodes [ 4 ] Durée [10 min]│
│ Ces valeurs préremplissent chaque nouveau match.     │
├──────────────────────────────────────────────────────┤
│ SUIVI EN DIRECT                                       │
│ Temps de jeu             (●) Minutes  ( ) Pourcentage│
│ Statistiques visibles    [✓ Points] [✓ Rebonds]      │
│                          [✓ Passes] [✓ Contres]       │
│                          [✓ Interceptions] [✓ Fautes] │
│                                                      │
│ [✓] Confirmer avant de terminer une session          │
│ [✓] Ouvrir le résumé après la fin                    │
├──────────────────────────────────────────────────────┤
│ NOTIFICATIONS                                         │
│ Notifications push       Activées              [Gérer]│
│ Les notifications internes restent dans l’en-tête.   │
├──────────────────────────────────────────────────────┤
│ Réinitialiser                         [Enregistrer]  │
└──────────────────────────────────────────────────────┘
```

Sur mobile, les groupes s’empilent, les choix de période et durée passent en pleine largeur, et la barre d’action d’enregistrement reste facilement accessible. Le contenu est adapté aux thèmes clair/sombre et aux langues française/anglaise.

## Parcours principal

1. Le coach se connecte ou restaure sa session.
2. Il ouvre le menu compte et choisit **Réglages du coach**.
3. L’application charge ses préférences, ou les valeurs par défaut si c’est sa première visite.
4. Il modifie un ou plusieurs réglages. L’écran signale que des changements restent à enregistrer.
5. Il enregistre; le serveur valide et associe les préférences à son compte.
6. Lors de la prochaine création de match, les réglages par défaut préremplissent le formulaire. Le coach peut encore les changer pour cette session.

## Accès et sécurité

- Route proposée : `/coach/settings`.
- Route protégée par une garde qui exige `AuthService.isAuthenticated() === true` après restauration de session.
- **Ne pas réutiliser `modeAuthGuard` telle quelle** : elle laisse passer le mode invité lorsque `AppModeService.isAuthenticatedMode()` est faux. Créer une garde stricte dédiée ou ajouter un mode strict sans changer le comportement des routes invitées existantes.
- Si le visiteur n’est pas connecté, renvoyer vers l’accueil avec ouverture du panneau de connexion et retour vers `/coach/settings` après authentification (ou afficher un écran d’accès refusé avec CTA connexion si le mécanisme de retour n’existe pas encore).
- Toute API de lecture/écriture requiert l’utilisateur de la session; l’identifiant utilisateur provient du contexte d’authentification, jamais du corps de requête.
- Un coach ne peut lire ni modifier les préférences d’un autre utilisateur.
- Après déconnexion, l’écran n’est plus accessible et aucune préférence de compte n’est exposée par stockage local partagé.

## Données et comportement proposés

Préférences minimales :

```ts
interface CoachSettings {
  defaultPeriodCount: 2 | 4 | 6 | 8;
  defaultPeriodDurationSeconds: number;
  playingTimeDisplay: 'MINUTES' | 'PERCENTAGE';
  visibleLiveStats: Array<'points' | 'rebounds' | 'assists' | 'blocks' | 'interceptions' | 'fouls'>;
  confirmSessionEnd: boolean;
  openSummaryAfterEnd: boolean;
}
```

Les préférences sont stockées côté serveur dans une entité reliée en un-à-un à `User` (ou un champ JSON versionné si les conventions du backend le justifient). Des valeurs par défaut côté service doivent préserver l’expérience actuelle. Une migration additive ne doit pas modifier les matchs existants.

Les réglages du coach sont des valeurs de préremplissage, pas des contraintes : changer les réglages ne modifie jamais une session déjà créée/en cours. La visibilité d’une statistique est uniquement un choix d’interface, pas une suppression/filtration des données persistées ni des exports.

La langue et le thème ne figurent pas dans ce modèle : l’application les gère aujourd’hui dans sa navigation et son stockage de préférence existant. La préférence push déjà disponible doit avoir une seule source de vérité; la V1 peut proposer un lien d’accès à sa gestion.

## Exigences fonctionnelles

1. Un utilisateur connecté peut ouvrir l’écran depuis le menu du compte et par URL directe.
2. Un visiteur ou un utilisateur en mode invité ne peut pas afficher ni modifier l’écran.
3. Le premier accès montre les valeurs par défaut sans requête d’initialisation manuelle.
4. Le formulaire distingue clairement état propre, modifications en attente, enregistrement en cours, réussite et erreur.
5. Les changements ne sont appliqués au compte qu’après sauvegarde réussie; une erreur conserve les valeurs saisies et permet de réessayer.
6. Les valeurs de match sont appliquées uniquement aux nouvelles préparations; le coach garde la possibilité de les modifier au cas par cas.
7. Au moins une statistique live est sélectionnée. Les statistiques masquées restent conservées dans les données, le résumé et les exports.
8. Le temps de jeu est présenté selon l’unité choisie. En pourcentage, il correspond au temps individuel divisé par la durée totale de jeu de la session; si cette durée est nulle ou indisponible, afficher un tiret plutôt que `NaN` ou une valeur trompeuse.
9. La réinitialisation restaure les valeurs par défaut et nécessite une confirmation avant sauvegarde destructive.
10. L’écran respecte les langues FR/EN, les thèmes clair/sombre, les règles de clavier/lecteur d’écran et une ergonomie mobile.

## Critères d’acceptation

- Une session invitée n’accède pas à `/coach/settings`, même en saisissant l’URL directement.
- Une session connectée affiche ses propres valeurs persistées après rechargement et sur un autre appareil.
- Le réglage d’un compte ne change pas celui d’un autre coach.
- Les valeurs de durée et de nombre de périodes sont proposées dans une nouvelle préparation de match.
- La modification d’un réglage ne change ni une préparation en cours, ni un match existant.
- Le coach ne peut pas désactiver toutes les statistiques live.
- Le coach peut choisir minutes ou pourcentage; la préférence est conservée après rechargement et appliquée à l’affichage du temps de jeu.
- Un dénominateur nul ou manquant ne produit pas de pourcentage invalide.
- Une sauvegarde échouée n’affiche pas un succès et ne perd pas les modifications locales non envoyées.
- L’interface rend correctement les états de chargement, première visite, erreur réseau et permission push bloquée/indisponible.

## Hors périmètre

- Permissions multi-coachs ou partage des réglages entre staff.
- Gestion complète du compte, changement de mot de passe ou suppression du compte.
- Paramétrage du réseau public des matchs amicaux et exposition des informations du club.
- Réglages avancés de calcul statistique ou de période pour les entraînements.
- Modification rétroactive des sessions existantes.

## Points à valider avant implémentation

1. **Portée des réglages de match :** préférences personnelles (recommandé pour V1) ou préférences par équipe ?
2. **Formats proposés :** les choix de périodes/durées listés conviennent-ils aux compétitions visées ?
3. **Statistiques live :** le choix de masquer des contrôles rapides est-il utile en V1, ou faut-il livrer d’abord uniquement les réglages de match et de fin de session ?
4. **Notifications push :** intégrer le contrôle actuel dans cet écran ou garder le menu notifications en en-tête et ne fournir qu’un lien ? Recommandation : source de vérité unique, réglage accessible depuis l’écran.
5. **Accès après connexion :** confirmer la redirection de retour vers l’écran demandé après authentification.

## Évaluation produit

La configuration est pertinente si elle réduit les manipulations répétitives et rend l’expérience cohérente avec les habitudes du coach. Le périmètre V1 priorise les valeurs par défaut de match et les préférences de flux, avec une sauvegarde centralisée au compte. La portée par équipe et les réglages d’entraînement pourront être ajoutés après retour d’usage.
