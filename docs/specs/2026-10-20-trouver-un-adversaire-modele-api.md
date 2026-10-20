# Architecture de données et contrats API — Trouver un adversaire

- **Date :** 20 octobre 2026
- **Statut :** proposition technique, dépendante des décisions produit de la spécification fonctionnelle
- **Références :** [spécification fonctionnelle](./2026-10-20-trouver-un-adversaire.md), [parcours et écrans](./2026-10-20-trouver-un-adversaire-parcours-ecrans.md)
- **Périmètre :** document de conception initial, complété par la note d’implémentation ci-dessous ; il ne remplace pas les contrats réels du code.

## Mise à jour d’implémentation — 20 octobre 2026

Les tranches de propositions, candidatures, liens invités, soumission, décision, confirmation et notifications sont implémentées dans le dépôt. Le schéma réel ajoute `FriendlyConfirmedMatch` au lieu de créer un `Game` : le modèle `Game` reste une feuille de match live mono-équipe sans date planifiée. Chaque coach retrouve donc l’événement commun dans la vue d’accueil des matchs amicaux. La confirmation conditionnelle de la proposition et l’unicité `FriendlyConfirmedMatch.proposalId` empêchent deux acceptations concurrentes. Les candidatures restantes sont `REJECTED`, les liens sont révoqués et des notifications persistées sont envoyées dans la même transaction. L’organisateur et le coach candidat peuvent annuler un match confirmé ; l’autre coach est notifié.

### Revue de bout en bout — 20 octobre 2026

- Les actions qui peuvent entrer en concurrence avec une décision ou une annulation verrouillent la proposition et relisent l’état dans la transaction. La réponse invité exige sa révision courante ; une réponse rejouée avec une révision ancienne renvoie `409`.
- La rotation des liens ne peut plus restaurer un statut de candidature lu avant une acceptation, un retrait ou une annulation. La date d’expiration des nouveaux liens est calculée à partir de l’échéance relue sous verrou.
- Une proposition arrivée à sa date limite ou à sa date de match est marquée `EXPIRED` lors de sa consultation, et ses candidatures actives passent à `EXPIRED` avec révocation des liens. Le réseau exclut les annonces à échéance passée.
- Le retrait d’une candidature révoque ses liens. Le coach peut ensuite manifester à nouveau son intérêt avec la même équipe ; cette action réinitialise les réponses et la composition précédentes avant de créer de nouveaux liens.
- L’annulation d’un match confirmé par le coach candidat notifie maintenant aussi le coach organisateur.
- Des vérifications Node couvrent les fenêtres de réponse, le format des jetons, les révisions, la reconfirmation après changement de disponibilité, ainsi que les statuts de retrait et de réactivation. Les transactions concurrentes restent à couvrir par des tests d’intégration PostgreSQL.

Migrations ajoutées : `20261020120000_add_friendly_match_proposals`, `20261020150000_add_friendly_applications_and_invites`, `20261020180000_add_friendly_application_submission` et `20261020200000_add_friendly_confirmations_notifications`. Elles sont présentes mais n’ont pas été appliquées à une base par cette livraison.

Les sections intitulées « proposé » ci-dessous décrivent la conception initiale. En cas d’écart, le schéma, les routes et les services actuels font foi.

## 1. Architecture existante observée

- Backend Express + Prisma + PostgreSQL. Le schéma Prisma du runtime est `backend/prisma/schema.prisma`; les migrations existantes sont dans `backend/prisma/migrations/` et les scripts utilisent Prisma 7.
- `User` possède des `Team`; `Team.userId` est nullable pour compatibilité avec les données invitées/historiques. `Player` appartient à une équipe. Une équipe et ses joueurs ne sont pas actuellement partagés entre plusieurs comptes.
- `Game` représente surtout la feuille de match (brouillon, direct, pause, terminé), les joueurs sélectionnés et les statistiques. Il n’a pas de date/heure, lieu, adversaire ni statut de proposition réseau.
- L’authentification est un jeton Bearer vérifié par `requireAuth`. Toutes les routes après `router.use(requireAuth)` sont privées. Les routes `/public/game-shares` sont explicitement placées avant cette barrière.
- Le partage de résumé utilise soit `Game.shareToken`, soit `SharedGameSnapshot.shareId`; les identifiants aléatoires sont produits avec `crypto.randomBytes`. Le nouveau lien de disponibilité est une capacité d’écriture avec durée et révocation : il ne faut pas le modéliser comme un simple snapshot public ni réutiliser le token de partage de match.
- Les services vérifient généralement la propriété en filtrant par `team.userId = userId`; les séquences multi-étapes métier utilisent déjà `$transaction`.
- Le dépôt comporte des modifications locales préexistantes. Cette proposition n’en dépend pas et ne les change pas.

## 2. Décisions d’architecture proposées

1. Ajouter des modèles dédiés aux propositions réseau et aux candidatures, sans détourner `Game` de son rôle actuel de feuille de match.
2. Décision retenue : créer `FriendlyConfirmedMatch` à l’acceptation et garder `Game` séparé. Une évolution bilatérale de `Game` n’est pas nécessaire pour publier un événement confirmé dans la vue d’accueil.
3. En V1, une annonce accepte une seule équipe candidate. À l’acceptation, l’annonce devient confirmée et les candidatures restantes passent à `REJECTED` dans la même transaction.
4. Les disponibilités sont des réponses persistées par candidature et joueur, uniques sur la paire `(applicationId, playerId)`. Le roster courant ne suffit pas : stocker un snapshot minimal du nom et du numéro pour préserver l’historique si le joueur est renommé ou supprimé.
5. Créer un token distinct, cryptographiquement aléatoire et à usage limité, pour le parcours invité. Stocker son empreinte (hash) plutôt que la valeur brute. Ne retourner la valeur brute qu’à la création/régénération.
6. Les propositions sont réservées aux comptes authentifiés et aux équipes rattachées à un utilisateur (`Team.userId IS NOT NULL`). Le mode invité local n’accède pas au réseau.

## 3. Modèle conceptuel proposé

### 3.1 `FriendlyMatchProposal` — proposition publiée par l’organisateur

Champs conceptuels :

| Champ | Type suggéré | Rôle |
|---|---|---|
| `id` | Int, PK | Identifiant interne. |
| `organizerTeamId` | Int, FK Team | Équipe de l’organisateur. |
| `createdByUserId` | Int, FK User | Propriétaire/acteur au moment de création, utile à l’autorisation et à l’audit. |
| `status` | enum | `DRAFT`, `OPEN`, `IN_DISCUSSION`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `EXPIRED`. |
| `category` | enum ou String contrôlé | Catégorie basket recherchée. La taxonomie reste à choisir. |
| `startsAt` | DateTime timestamptz | Début stocké en UTC ; réponses affichées dans la timezone de l’utilisateur/lieu. |
| `durationMinutes` | Int? | Durée si connue. |
| `venueName` / `venueAddress` | String? | Informations exactes, potentiellement privées avant confirmation. |
| `areaLabel` / `latitude` / `longitude` | String?/Decimal? | Information publique approximative pour la découverte, seulement si géolocalisation retenue. |
| `format` | enum/String | Format attendu (ex. 5x5, amical complet) après définition du vocabulaire. |
| `requestedPlayerCount` | Int? | Effectif recherché côté adverse. |
| `level` | enum/String? | Niveau recherché. |
| `notes` | String? | Instructions libres, longueur limitée et échappées en sortie. |
| `responseDeadline` | DateTime? | Date limite, facultative si l’expiration automatique est retenue. |
| `confirmedApplicationId` | Int? unique/FK | Candidature acceptée ; peut être remplacé par un état dérivé si relation circulaire gênante. |
| `confirmedAt` | DateTime? | Horodatage de décision. |
| `cancelledAt`, `cancellationReason` | DateTime?/String? | Annulation et motif. |
| `createdAt`, `updatedAt` | DateTime | Audit standard. |

Relations : une équipe organisatrice possède plusieurs propositions ; une proposition possède plusieurs candidatures ; une proposition peut avoir zéro ou une candidature acceptée. Indexer `(status, startsAt)`, `(category, startsAt)` et les colonnes de filtre territoire lorsque retenues.

### 3.2 `FriendlyMatchApplication` — intérêt puis candidature d’une équipe

| Champ | Type suggéré | Rôle |
|---|---|---|
| `id` | Int, PK | Identifiant interne. |
| `proposalId` | Int, FK | Proposition concernée. |
| `teamId` | Int, FK Team | Équipe candidate. |
| `coachUserId` | Int, FK User | Coach qui porte cette candidature. |
| `status` | enum | `INTERESTED`, `COLLECTING`, `SUBMITTED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`, `NOT_SELECTED`. |
| `submittedAt` | DateTime? | Passage explicite de l’intérêt à la composition officielle. |
| `decisionAt` | DateTime? | Décision de l’organisateur. |
| `decisionByUserId` | Int?, FK User | Coach organisateur ayant décidé. |
| `decisionReason` | String? | Motif de refus, confidentialité/visibilité à choisir. |
| `withdrawnAt` | DateTime? | Retrait par candidat. |
| `createdAt`, `updatedAt` | DateTime | Audit standard. |

Contrainte : `UNIQUE(proposalId, teamId)` afin d’empêcher les candidatures répétées par équipe. Si le produit autorise de retirer puis recréer, réactiver la candidature existante ou ajouter une génération/version plutôt que supprimer l’historique. Indexer `(proposalId, status)` et `(coachUserId, status)`.

### 3.3 `FriendlyConfirmedMatch` — rendez-vous bilatéral

Une ligne par proposition acceptée, avec `proposalId UNIQUE` et `applicationId UNIQUE`, les deux équipes, un snapshot de date/format/zone, `status` (`CONFIRMED` ou `CANCELLED`), `confirmedAt`, puis les champs d’annulation et le motif facultatif. Cette ressource est la carte de calendrier partagée aux deux coachs. Elle reste distincte de `Game`, qui est la feuille de match live mono-équipe. Les FKs vers proposition, candidature et équipes sont `RESTRICT` pour conserver l’historique.

### 3.4 `FriendlyNotification` — notification interne

Champs : utilisateur destinataire, type d’événement, références facultatives proposition/candidature, `createdAt`, `readAt`. Index `(userId, readAt, createdAt)`. Types livrés : intérêt reçu, équipe soumise, match confirmé, candidature refusée/clôturée, match annulé. La liste et le marquage comme lu sont limités au propriétaire du compte.

### 3.5 `FriendlyPlayerResponse` — réponse d’un joueur invité

| Champ | Type suggéré | Rôle |
|---|---|---|
| `id` | Int, PK | Identifiant interne. |
| `applicationId` | Int, FK | Candidature et équipe exactes. |
| `playerId` | Int?, FK Player, nullable | Référence actuelle ; nullable pour conserver réponse si joueur supprimé. |
| `playerNameSnapshot` | String | Nom affiché lors de l’ouverture de la collecte. |
| `jerseyNumberSnapshot` | String | Numéro affiché lors de l’ouverture de la collecte. |
| `availability` | enum | `AVAILABLE`, `UNAVAILABLE`; absence de ligne signifie `NO_RESPONSE`. |
| `respondedAt` | DateTime | Dernière réponse enregistrée. |
| `revision` | Int | Version optimiste pour empêcher l’écrasement silencieux de réponses concurrentes. |

Contrainte `UNIQUE(applicationId, playerId)` lorsque `playerId` est non nul. PostgreSQL autorise plusieurs `NULL` dans un index unique ; les entrées joueur doivent donc normalement être créées par le coach à partir de joueurs connus avant de générer les liens. Vérifier que le joueur appartient à l’équipe de la candidature lors de la création. Une contrainte composite `(applicationId, playerId)` seule ne garantit pas cette appartenance ; le service doit la valider, ou une structure de clés étrangères composites est requise.

Ne pas créer de ligne « indisponible » automatiquement : absence de réponse reste distincte. Conserver une réponse d’audit minimale ou historiser les changements uniquement si une exigence de contestation l’impose.

### 3.6 `FriendlyInvite` — capacité d’accès du joueur

| Champ | Type suggéré | Rôle |
|---|---|---|
| `id` | Int, PK | Identifiant interne. |
| `responseId` | Int, FK unique | Une invitation individuelle cible une réponse/joueur. |
| `tokenHash` | String unique | Hash du secret aléatoire, jamais le token brut. |
| `expiresAt` | DateTime | Expiration explicite. |
| `revokedAt` | DateTime? | Révocation individuelle. |
| `lastUsedAt` | DateTime? | Audit/diagnostic, sans journaliser le token. |
| `createdAt` | DateTime | Création/régénération. |

Une seule invitation active par réponse est souhaitable. Prisma ne modélise pas directement un index unique partiel (`revokedAt IS NULL`), donc soit conserver une ligne unique et faire une rotation du hash/date de révocation, soit gérer un index partiel SQL dans une migration personnalisée. Recommandation V1 : `UNIQUE(responseId)` et rotation en place ; garder l’historique de génération dans un journal si nécessaire.

Le secret devrait contenir au moins 256 bits aléatoires. Stocker SHA-256 (les tokens sont à haute entropie, pas des mots de passe) ; comparer en temps constant si comparaison applicative. Appliquer limites de débit aux endpoints publics et `Cache-Control: no-store`, éviter de placer les tokens dans les logs/analytics/referrers, et mettre une politique `Referrer-Policy: no-referrer` sur la page.

### 3.5 `FriendlyMatchEvent` — journal de transitions

Modèle recommandé pour conserver les décisions sans transformer les suppressions en pertes d’historique :

- `proposalId`, `applicationId?`, `actorUserId?`, `eventType`, `metadata` JSON filtré, `createdAt`.
- Événements : publication, intérêt, lien généré/révoqué, équipe soumise, acceptation/refus, retrait, modification critique, reconfirmation requise, annulation/expiration.
- Ne pas y enregistrer token brut, disponibilité nominative de façon redondante, ni données sensibles inutiles.

Une table d’événements n’est pas requise pour la logique transactionnelle mais facilite la chronologie métier et l’audit. Alternative plus simple : timestamps et statuts courants seulement, au prix d’une chronologie incomplète.

## 4. Relations et règles de suppression

```text
User 1──N Team (relation existante, Team.userId doit être non nul pour le réseau)
Team (organisatrice) 1──N FriendlyMatchProposal
FriendlyMatchProposal 1──N FriendlyMatchApplication
Team (candidate) 1──N FriendlyMatchApplication
FriendlyMatchApplication 1──N FriendlyPlayerResponse
Player 1──N FriendlyPlayerResponse (référence optionnelle + snapshots)
FriendlyPlayerResponse 1──0..1 FriendlyInvite
FriendlyMatchProposal 1──0..1 FriendlyConfirmedMatch ──1 FriendlyMatchApplication
```

- Suppression de `User` ou `Team` ne doit pas effacer une proposition/candidature déjà publiée et confirmée sans règle explicite. Préférer `RESTRICT` pour les ressources actives et une procédure d’anonymisation/annulation à la suppression, ou des champs snapshot et `SetNull` après annulation.
- Les réponses et invitations peuvent être supprimées en cascade après expiration et durée de conservation, mais la candidature/proposition doit garder les éléments minimaux d’audit.
- Suppression d’un joueur : préserver sa réponse avec snapshots et mettre `playerId = NULL`, ou empêcher la suppression pendant la collecte (`RESTRICT`). Recommandation : snapshots + nullification, puisque le roster reste éditable.
- Les données d’identité d’équipe visibles aux autres coachs ne doivent pas être prises depuis un objet `Team` complet sérialisé. Construire explicitement des projections publiques.

## 5. Contrats API proposés

Préfixe `/api`. Les routes coach sont protégées par `requireAuth`; les routes publiques joueur sont déclarées avant `router.use(requireAuth)`, comme le partage de résumé existant. Les exemples omettent les champs audit communs.

### 5.1 Découverte et propositions

#### `GET /api/friendly-matches`

Liste paginée des propositions `OPEN` ou `IN_DISCUSSION` visibles à l’utilisateur.

Query : `cursor?`, `limit?` (borné, ex. 50), `from?`, `to?`, `category?`, `gender?`, `level?`, `format?`, `area?`/`radiusKm?`, `sort=soonest|newest`.

Réponse `200` : `{ items: ProposalListItem[], nextCursor: string | null }`. N’inclure ni disponibilité des joueurs ni détails privés/coordonnées exactes par défaut.

#### `POST /api/friendly-matches`

Crée et publie (ou crée un brouillon si le contrat le prévoit) une proposition. Vérifier propriété de `organizerTeamId`, compte actif, dates futures et champs.

Requête : `{ organizerTeamId, category, startsAt, durationMinutes?, area?, venueName?, venueAddress?, format, requestedPlayerCount?, level?, notes?, responseDeadline? }`.

Réponse `201` : détail de la proposition et `status`. Idempotence recommandée via `Idempotency-Key` pour les créations rejouées après coupure.

#### `GET /api/friendly-matches/:proposalId`

Détail filtré selon le rôle. Réponse publique réseau et vue propriétaire doivent être des DTO distincts. Le candidat ne voit pas l’information exacte de contact/lieu privé avant les conditions retenues ; l’organisateur voit ses candidatures.

#### `PATCH /api/friendly-matches/:proposalId`

Modification partielle par l’organisateur. Requête inclut `version` ou `If-Match` (`updatedAt`/ETag) pour contrôle de concurrence. Changement critique retourne un objet d’impact et exige confirmation explicite avant application, ou une route `POST .../change-slot/confirm`.

#### `POST /api/friendly-matches/:proposalId/cancel`

Annulation par l’organisateur : `{ reason? }`. Révoque les liens actifs et passe les candidatures ouvertes à un état fermé dans une transaction. Réponse `200` avec état actualisé.

#### `POST /api/friendly-matches/:proposalId/close` (optionnel)

À ajouter uniquement si fermer l’annonce sans l’annuler est un état métier validé.

### 5.2 Intérêt et suivi candidat

#### `POST /api/friendly-matches/:proposalId/applications`

Manifeste l’intérêt d’une équipe : `{ teamId }`. Vérifie que l’utilisateur possède l’équipe, que son genre/catégorie est admissible si requis, que la proposition est ouverte et que l’organisateur ne candidate pas à sa propre annonce.

Réponse `201` : `ApplicationSummary { id, status: INTERESTED, proposal, team }`. Contrainte unique proposition-équipe résout les requêtes concurrentes ; doublon retourne `409 APPLICATION_EXISTS` avec l’application existante (ou `200` idempotent si politique choisie).

#### `GET /api/my/friendly-match-applications`

Liste des candidatures du coach pour ses équipes, filtrables par état. N’autorise pas l’accès aux équipes d’autres utilisateurs.

#### `GET /api/friendly-match-applications/:applicationId`

Détail candidat, disponible au coach candidat et, avec projection différente, à l’organisateur de la proposition. Les joueurs invités n’utilisent pas cette route.

#### `POST /api/friendly-match-applications/:applicationId/withdraw`

Retrait du coach candidat. Refusé (`409`) après acceptation ; révoque les invitations actives et conserve les réponses pour l’audit/conservation configurée.

### 5.3 Invitations et disponibilités

#### `POST /api/friendly-match-applications/:applicationId/invites`

Pour le coach candidat : crée ou fait tourner les invitations individuelles pour les joueurs de l’équipe. Requête suggérée `{ playerIds: number[], expiresAt? }` ; vérifier chaque joueur appartient à l’équipe et ne pas accepter d’IDs répétés. La durée maximale vient de la configuration/règle produit, jamais d’un `expiresAt` arbitraire fourni par le client.

Réponse `201` : `{ invites: [{ playerId, playerName, jerseyNumber, url, expiresAt }] }`. Le secret brut est retourné une seule fois. Une route de liste ultérieure ne renvoie que `active`, `expiresAt`, `lastUsedAt`, sans URL à secret récupérable.

#### `POST /api/friendly-match-invites/:token/revoke`

Révocation authentifiée par le coach propriétaire, ou route basée sur application et réponse. Éviter un endpoint public de révocation par bearer-token dans l’URL, qui pourrait être déclenché par scanner de lien/préchargement. Recommandation : `DELETE /api/friendly-match-applications/:applicationId/invites/:responseId` protégé par auth.

#### `GET /api/public/friendly-match-invites/:token`

Valide hash, expiration, révocation, proposition active et reconfirmation éventuelle. Renvoie uniquement la présentation autorisée et la réponse de ce joueur : `{ proposal: { category, startsAt, durationMinutes, areaOrVenue }, player: { displayName, jerseyNumber }, response: { availability, respondedAt }, expiresAt }`. Pas de listing de joueurs, d’équipe complète, de contact privé ni d’autres réponses. Réponses invalides/expirées devraient retourner un état générique `404/410` sans permettre l’énumération de tokens ou de joueurs.

#### `PUT /api/public/friendly-match-invites/:token/response`

Requête : `{ availability: "AVAILABLE" | "UNAVAILABLE", revision? }`. Pas de `playerId` ou `applicationId` fourni par le client : ils sont dérivés du token. Upsert sur la réponse associée, en vérifiant expiration/révocation et fenêtre de collecte dans la même transaction. Réponse `200` : `{ availability, respondedAt, revision }`.

Pour éviter les doubles réponses : `UNIQUE(applicationId, playerId)`, upsert atomique, version `revision` ou `If-Match`; une requête répétée avec la même valeur est idempotente. En cas de versions contradictoires, retourner `409 RESPONSE_CHANGED` avec le dernier état, sans écrasement silencieux.

### 5.4 Soumission, décision et confirmation

#### `POST /api/friendly-match-applications/:applicationId/submit`

Coach candidat soumet la composition officielle. Requête : `{ playerIds: number[] }`. Vérifier que les IDs sont distincts, appartiennent à l’équipe et ont répondu `AVAILABLE`. Seuil appliqué : `requestedPlayerCount` joueurs (ou 1 si non renseigné). Persister l’instantané et `submittedAt`, passer à `SUBMITTED` en transaction.

Réponse `200` : candidature soumise avec `proposedPlayers` snapshot. Les disponibilités restent séparées et continuent à évoluer. Si une réponse change après soumission, passer atomiquement à `NEEDS_RECONFIRMATION`; conserver le snapshot soumis jusqu’à la resoumission. Les réponses individuelles ne sont jamais exposées à l’organisateur.

#### `POST /api/friendly-match-applications/:applicationId/accept`

Coach organisateur uniquement. Requiert une candidature `SUBMITTED` et une proposition encore `OPEN/IN_DISCUSSION`. Dans une transaction, une mise à jour conditionnelle de la proposition réclame le créneau ; elle passe à `CONFIRMED`, la candidature passe à `ACCEPTED`, un `FriendlyConfirmedMatch` snapshot est créé, les autres candidatures ouvertes sont marquées `REJECTED`, leurs liens sont révoqués et les notifications sont écrites. La contrainte unique sur `proposalId` et le statut conditionnel font gagner une seule acceptation concurrente ; les autres retours sont `409`.

Réponse `200` : confirmation bilatérale. La confirmation devient visible au coach organisateur et au coach candidat via `/api/my/friendly-matches`.

#### `POST /api/friendly-match-applications/:applicationId/reject`

Organisateur uniquement. Vérifie la relation et l’état de candidature, passe à `REJECTED`, révoque ses liens et notifie le coach candidat. Réponse `200`.

#### `GET /api/friendly-matches/:proposalId/confirmation`

L’implémentation sert les matchs bilatéraux via `GET /api/my/friendly-matches`, limité aux propositions créées par l’utilisateur ou aux candidatures qu’il porte. Elle renvoie les noms des deux équipes, date, lieu/zone, format, statut, composition acceptée et motif d’annulation, sans disponibilités individuelles. La vue d’accueil affiche les prochains matchs confirmés aux deux coachs.

Les notifications sont exposées par `GET /api/my/friendly-notifications` et marquées lues avec `POST /api/my/friendly-notifications/:notificationId/read`. Les propositions exposent leurs équipes candidates via `GET /api/friendly-matches/:proposalId/applications`, avec la composition officiellement soumise uniquement.

`POST /api/friendly-matches/:proposalId/cancel` annule une proposition ouverte/en discussion par l’organisateur, ou un match confirmé par l’un des deux coachs. Le motif est facultatif et limité à 500 caractères ; confirmation, annulation et notifications sont transactionnelles. Une annulation confirmée marque `FriendlyConfirmedMatch.CANCELLED` et informe l’autre coach.

### 5.5 Codes d’erreur communs

Réutiliser le format actuel `{ message }` ou évoluer vers un format stable `{ code, message, details? }` lors de cette fonctionnalité. Codes conceptuels : `401 AUTH_REQUIRED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 INVALID_STATE`, `409 ALREADY_APPLIED`, `409 SLOT_CHANGED`, `409 RESPONSE_CHANGED`, `410 INVITE_EXPIRED`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`. Pour les ressources réseau confidentielles, `404` peut être préféré à `403` afin de ne pas révéler leur existence.

## 6. Permissions par ressource

| Ressource/action | Organisateur | Coach candidat propriétaire | Autre coach connecté | Joueur avec lien valide |
|---|---|---|---|---|
| Lire liste réseau | Oui | Oui | Oui, projection réseau | Non |
| Lire détail proposition | Détail complet | Détail public + sa candidature | Projection publique | Détail minimal du lien |
| Modifier/annuler proposition | Oui | Non | Non | Non |
| Créer candidature | Peut-être interdit sur sa propre annonce | Oui pour son équipe | Oui pour son équipe | Non |
| Lire réponses joueurs | Non (sauf composition soumise) | Oui pour sa candidature | Non | Sa réponse seulement |
| Soumettre équipe | Non | Oui | Non | Non |
| Accepter/refuser | Oui, pour proposition propre | Non | Non | Non |
| Modifier sa réponse | Non | Non (peut révoquer lien) | Non | Oui via token valide |

Chaque vérification doit être faite côté service à partir de l’utilisateur authentifié et des relations en base ; ne pas considérer les IDs de l’URL/corps comme preuve de propriété. Les serializers doivent appliquer le rôle avant la sélection des champs.

## 7. Expiration, rotation et révocation des liens

- Token généré avec `crypto.randomBytes(32)` (32 octets/256 bits), encodage URL-safe.
- Seul le hash du token est stocké ; rechercher par hash exact.
- Expiration initiale recommandée : date limite de réponse de la candidature/proposition, plafonnée par une durée de sécurité configurable (valeur exacte à valider). Si aucune échéance n’existe, le lien doit malgré tout expirer après une durée maximale.
- Le lien cesse d’être valide lorsque : sa date est dépassée, le coach le révoque/renouvelle, la candidature est retirée/fermée, la proposition est annulée ou le créneau est modifié et attend une reconfirmation.
- Rotation invalide immédiatement le token précédent ; ne jamais remettre l’ancien token en clair.
- Réponses de joueurs et détails publics ne doivent pas être mis en cache. Limiter les tentatives et protéger contre les scans automatisés ; ne pas utiliser la réponse du endpoint comme oracle de découverte de noms.
- Un lien individuel est préférable à un lien d’équipe commun : il permet d’attacher la réponse à une identité roster et de limiter l’accès au seul joueur. Cette décision UX reste à valider.

## 8. Transactions et concurrence

- Créer candidature et réponses roster initiales dans une transaction.
- Générer/renouveler les invitations après validation de toute la sélection de joueurs ; ne retourner les URLs qu’après commit réussi.
- Soumission de composition : transaction avec contrôle de version de la candidature et snapshot des joueurs.
- Acceptation : transaction sérialisée sur proposition. Utiliser verrou SQL (`SELECT ... FOR UPDATE`) ou mise à jour conditionnelle `WHERE status IN (...) AND confirmedApplicationId IS NULL`; vérifier `count === 1`. Les contraintes uniques renforcent la règle mais ne remplacent pas la transaction.
- Les modifications de date/format marquent les réponses comme à reconfirmer ou les remettent à zéro selon le choix produit, révoquent les liens obsolètes, augmentent une version de créneau et notifient les candidatures dans une transaction.
- Ajouter `version`/ETag sur les ressources modifiables pour éviter les écrasements de modifications simultanées.
- Une création réseau peut adopter `Idempotency-Key`; les updates de réponse sont naturellement idempotentes pour la même valeur.

## 9. Migrations proposées

1. Migrations réelles : enums `FriendlyProposalStatus`, `FriendlyApplicationStatus`, `FriendlyAvailability`, `FriendlyMatchLifecycle`, et `FriendlyNotificationType`.
2. Modèles réellement ajoutés : `FriendlyMatchProposal`, `FriendlyMatchApplication`, `FriendlyPlayerResponse`, `FriendlyApplicationPlayer`, `FriendlyInvite`, `FriendlyConfirmedMatch` et `FriendlyNotification`.
3. Aucune FK vers `Game` : le match confirmé conserve les équipes, le créneau, le format et l’application retenue dans sa propre ressource.
4. Créer une migration Prisma 7 dédiée via la commande projet, puis relire le SQL généré. Compléter par SQL PostgreSQL si requis pour index partiel, `CHECK` ou index fonctionnels non représentables par Prisma.
5. Contraintes réellement ajoutées : uniques `(proposalId, teamId)`, `(applicationId, playerId)`, `tokenHash`, `FriendlyConfirmedMatch.proposalId` et `FriendlyConfirmedMatch.applicationId`.
6. FKs : propositions vers équipes/utilisateurs avec politique `RESTRICT`/`SetNull` décidée ; candidatures vers proposition/équipe/coach ; réponses vers candidature/joueur avec stratégie de suppression ; invitation vers réponse en cascade ; événements vers proposition en `RESTRICT` ou `SetNull` selon conservation.
7. Migration additive : pas de backfill requis pour `Game` existant si propositions/matchs amicaux restent séparés. Les équipes `userId = NULL` restent utilisables localement mais inéligibles au réseau. Si le produit veut les convertir, prévoir explicitement un parcours d’attachement à un compte plutôt qu’un rattachement automatique.
8. Déploiement : sauvegarder la base, appliquer la migration additive, déployer backend compatible, puis frontend. Ne pas exposer la route tant que les migrations ne sont pas déployées. Retour arrière : désactiver routes puis conserver/supprimer les nouvelles tables selon présence de données ; ne pas supprimer automatiquement les historiques actifs.

## 10. Décisions à valider avant développement

1. Une proposition reçoit-elle une seule équipe ou plusieurs ? Décide unicité/fermeture/états des candidatures.
2. Quelles catégories et quels formats sont requis et normalisés ? Basket uniquement reste acquis, taxonomie exacte non définie.
3. Une annonce est-elle un match à domicile de l’organisateur ou un créneau neutre ? Quand le lieu exact est-il partagé ?
4. Les dates utilisent-elles une timezone de lieu explicite ? Quelle durée et échéance par défaut ?
5. Résolu : un lien commun par équipe ; le joueur saisit son nom. Les homonymes partagent une même réponse, limite à valider si des équipes ont des joueurs portant le même nom.
6. Résolu : la réponse reste modifiable après soumission tant que le lien et la proposition sont actifs. Après acceptation, le lien est révoqué.
7. Résolu : le coach peut soumettre sans attendre les réponses manquantes. Seuls les joueurs disponibles peuvent être inclus ; le minimum explicite `requestedPlayerCount`, s’il est renseigné, reste appliqué.
8. La composition officielle est-elle un snapshot immuable ? Les changements de roster ultérieurs affectent-ils les propositions en cours ?
9. À quel moment créer le `Game` existant ? Celui-ci représente aujourd’hui une seule équipe ; faut-il étendre `Game` pour gérer deux clubs ou ne créer qu’une feuille de match pour l’équipe propriétaire ?
10. L’organisateur peut-il voir le nom/la composition d’une équipe qui manifeste seulement son intérêt ?
11. Quelle durée de conservation et quelles règles de suppression/anonymisation s’appliquent aux réponses joueur ?
12. Quels canaux de notification sont disponibles et quels événements envoient une notification ? L’API peut d’abord renvoyer l’état sans promettre e-mail/push.
13. Les coordonnées, la géolocalisation ou le rayon sont-ils dans le MVP ? Cela impacte données personnelles, index et filtrage réseau.
14. Les coaches sont-ils toujours propriétaires directs (`Team.userId`) ou faut-il gérer plusieurs coaches/utilisateurs par club/équipe ? Le modèle actuel ne représente pas le partage d’une équipe entre comptes.
15. Faut-il une table de journal d’événements dédiée dès la V1, ou les timestamps d’états suffisent-ils ?

## 11. Évolution du parcours joueur (2026-10-20)

Le parcours de disponibilité utilise désormais un seul lien par candidature et par équipe. La page publique demande le nom du joueur et son vote. Les noms sont normalisés (Unicode NFKC, casse et espaces) et uniques par candidature ; un nouvel envoi avec le même nom met à jour le vote existant. Les votes restent modifiables jusqu’à l’expiration/révocation du lien ou la fermeture de la proposition. Les homonymes ne peuvent pas être distingués avec le seul nom saisi et partagent donc une réponse ; ajouter un numéro de maillot ou un autre élément de distinction nécessiterait une décision produit.

`FriendlyInvite` peut référencer soit une réponse legacy, soit directement une candidature (`applicationId` unique). Les nouveaux liens ne révèlent aucun roster et sont stockés sous forme SHA-256 ; le coach peut les renouveler ou les révoquer. Leur expiration est fixée à `responseDeadline`, ou à l’heure du match si aucune échéance n’est définie. La migration `20261020220000_team_wide_friendly_invites` ajoute une table d’historique des disponibilités et remplit les noms normalisés. `20261020230000_revoke_legacy_friendly_invites` révoque les anciens liens individuels sans effacer leurs réponses. Le seed de démonstration crée un lien d’équipe si celui-ci manque ou a expiré ; un secret actif n’est jamais réimprimé car seule son empreinte est stockée.

La soumission reçoit les identifiants de réponses (`responseIds`) et accepte uniquement les réponses disponibles. Le nombre minimal de joueurs reste la valeur explicitement demandée dans la proposition, si elle existe ; la collecte n’a pas besoin d’être complète. Une modification de disponibilité d’un joueur retenu qui le rend indisponible passe la candidature en `NEEDS_RECONFIRMATION` ; les autres votes ne changent pas son statut. Les anciens votes restent consultables par le coach candidat. Une modification importante de la proposition révoque le lien, place les réponses courantes à « sans réponse » et copie leurs valeurs précédentes dans l’historique.

## 12. Ordre d’implémentation suggéré (après validation)

1. Valider les décisions 1–9 et le modèle de permissions.
2. Ajouter modèles, migration et services de proposition/liste/détail avec tests de propriété.
3. Ajouter candidature/intérêt et transaction d’unicité.
4. Ajouter réponses et lien individuel, endpoints publics minimaux, expirations, révocation et limites de débit.
5. Ajouter soumission snapshot, décision transactionnelle et confirmations.
6. Relier au calendrier/`Game` si la décision produit et le modèle bilatéral sont tranchés.
7. Définir rétention, notifications et audit avant mise en production.
