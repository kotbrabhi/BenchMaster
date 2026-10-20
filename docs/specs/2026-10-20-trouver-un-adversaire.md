# Spécification fonctionnelle — Trouver un adversaire

- **Date :** 20 octobre 2026
- **Statut :** proposition fonctionnelle, décisions produit à confirmer
- **Produit :** BenchMaster, application mobile-first de gestion d’équipes de basketball

## 1. Objectif

Permettre aux coachs de trouver et organiser des matchs amicaux entre clubs. Un coach publie un créneau recherché ou une rencontre ouverte. Un autre coach peut manifester son intérêt, consulter les disponibilités de ses joueurs via un lien invité et soumettre son équipe. Le coach organisateur choisit ensuite d’accepter ou de refuser cette équipe.

Le module complète les outils existants de gestion d’effectif et de matchs. Il ne remplace pas la préparation ni le suivi d’un match dans BenchMaster.

## 2. Utilisateurs et rôles

### Coach organisateur

Coach connecté qui crée une proposition. Il définit les conditions du match, suit les équipes candidates, puis accepte ou refuse leurs candidatures. Il peut modifier ou annuler sa proposition selon les règles ci-dessous.

### Coach candidat

Coach connecté représentant une équipe qui répond à une proposition. Il exprime son intérêt, partage un lien de disponibilité avec ses joueurs, suit les réponses et décide de soumettre ou non son équipe. Il peut retirer sa candidature avant décision de l’organisateur.

### Joueur invité

Joueur qui ouvre un lien sans nécessairement avoir de compte BenchMaster. Il indique sa disponibilité pour le match concerné. Le lien ne lui donne accès qu’à cette consultation et à sa propre réponse.

### Visiteur du réseau

Coach connecté qui parcourt les propositions publiées et filtre celles qui sont pertinentes pour son équipe. La consultation publique du réseau ne donne pas accès aux réponses nominatives des joueurs ni aux informations privées des équipes.

## 3. Parcours principal

### 3.1 Publication d’une proposition

1. Le coach organisateur choisit une équipe de son compte et crée une proposition.
2. Il renseigne les informations nécessaires : catégorie, créneau (date et heure), lieu ou zone, format et nombre de joueurs souhaité. Il peut préciser le niveau recherché et ajouter une note.
3. Il publie la proposition. Elle devient visible aux coachs connectés du réseau selon les règles de visibilité retenues.

### 3.2 Consultation et intérêt

1. Un coach candidat consulte les propositions actives et peut ouvrir leur détail.
2. Il manifeste son intérêt avec une équipe de son compte.
3. Cette action crée une prise de contact, mais ne réserve pas le créneau et ne signifie pas que l’équipe est prête à jouer.

### 3.3 Collecte des disponibilités

1. Le coach candidat crée un lien invité associé à sa candidature et le transmet à ses joueurs.
2. Chaque joueur répond « disponible » ou « indisponible » pour ce créneau. Il peut modifier sa réponse tant que la collecte reste ouverte ; après soumission, toute modification signale la candidature à reconfirmer. La composition officiellement soumise reste un instantané distinct.
3. Le coach voit les réponses évoluer : disponibles, indisponibles et sans réponse.
4. Les joueurs disponibles sont un indicateur de faisabilité. Ils ne constituent ni une équipe soumise, ni une confirmation de participation.

### 3.4 Soumission et décision

1. Quand il estime son effectif suffisant, le coach candidat soumet officiellement son équipe. Il confirme les joueurs retenus et, si nécessaire, les informations de déplacement ou de contact demandées par l’organisateur.
2. La candidature passe à « proposée ». Le coach organisateur voit la candidature et son effectif proposé.
3. Le coach organisateur accepte ou refuse la candidature. En cas d’acceptation, cette équipe devient l’équipe acceptée pour la proposition et le match est confirmé selon les règles de capacité définies plus bas.
4. Les deux coachs voient le résultat et les informations pratiques nécessaires. Les réponses individuelles ne sont pas partagées avec l’organisateur par défaut ; seul l’effectif officiellement soumis lui est communiqué.

## 4. États et transitions

### 4.1 Proposition de match

| État | Signification |
|---|---|
| Brouillon | Créée mais pas publiée ; visible uniquement par l’organisateur. |
| Ouverte | Publiée et consultable ; les coachs peuvent manifester leur intérêt. |
| En discussion | Au moins une candidature est en préparation ou soumise ; la proposition reste ouverte sauf fermeture manuelle ou acceptation. |
| Confirmée | Une équipe candidate a été acceptée et le match est organisé. |
| Annulée | L’organisateur a annulé la proposition ; aucune nouvelle candidature n’est possible. |
| Terminée | La date est passée ou le match a été marqué comme terminé. |

Transitions principales : brouillon → ouverte → en discussion → confirmée → terminée ; ouverte/en discussion → annulée. Une proposition en discussion peut revenir à ouverte si toutes les candidatures sont retirées ou refusées. L’organisateur peut fermer une proposition sans annulation si le produit choisit d’autoriser une fermeture temporaire ou définitive.

### 4.2 Candidature d’équipe

| État | Signification |
|---|---|
| Intérêt exprimé | Le coach a signalé son intérêt ; aucune disponibilité n’est encore nécessairement recueillie. |
| Disponibilités en collecte | Le lien joueur est actif ; le coach suit les réponses. |
| Prête à soumettre | Le coach estime l’effectif suffisant ; statut facultatif ou dérivé, selon choix produit. |
| Proposée | Le coach a soumis officiellement un instantané de son effectif. |
| À reconfirmer | Une réponse a changé après soumission ; le coach doit vérifier et soumettre à nouveau. |
| Acceptée | L’organisateur a retenu cette équipe. |
| Refusée | L’organisateur a refusé cette équipe. |
| Retirée | Le coach candidat a retiré son intérêt ou sa candidature. |
| Expirée | Le délai de réponse est passé ou la proposition n’est plus candidate. |

Transitions principales : intérêt exprimé → disponibilités en collecte → proposée → à reconfirmer → proposée à nouveau, puis acceptée/refusée. Le coach peut retirer une candidature avant acceptation. Après refus ou expiration, une candidature ne peut être rouverte que par une nouvelle action et selon la disponibilité de la proposition.

### 4.3 Disponibilité d’un joueur

Valeurs : **sans réponse**, **disponible**, **indisponible**. Une réponse décrit uniquement la disponibilité déclarée par le joueur ; elle n’engage ni le coach à soumettre son équipe, ni l’organisateur à l’accepter.

## 5. Règles métier

1. Seuls les coachs connectés peuvent publier, manifester un intérêt, créer une candidature ou prendre une décision d’organisateur. Le mode invité existant de BenchMaster ne publie pas dans le réseau.
2. Un coach ne peut agir que pour une équipe qu’il possède ou qu’il est autorisé à gérer.
3. Une équipe ne peut avoir qu’une candidature active par proposition. Les doublons sont empêchés ; une candidature retirée peut éventuellement être recréée tant que la proposition est ouverte.
4. Une réponse joueur est rattachée à une candidature et à un seul créneau. Un même lien ne permet pas de voir d’autres propositions ni d’autres réponses individuelles.
5. La disponibilité déclarée par les joueurs est visible au coach candidat. L’organisateur reçoit uniquement les informations nécessaires à l’évaluation de l’équipe soumise.
6. L’organisateur ne peut accepter une équipe que si la proposition est encore ouverte/en discussion et si aucune autre candidature n’a déjà été acceptée, sauf si plusieurs équipes sont explicitement autorisées.
7. L’acceptation d’une candidature confirme la rencontre uniquement si toutes les informations obligatoires sont présentes et si le créneau n’a pas été annulé ou modifié de façon invalidante.
8. Les changements de date après publication invalident les réponses de disponibilité existantes ou exigent une nouvelle confirmation des joueurs. Le comportement précis est à décider avant implémentation.
9. La suppression définitive d’une proposition ou candidature n’est pas le comportement normal : annulation/retrait conserve un historique de statut afin d’expliquer les décisions et d’éviter les liens orphelins.

## 6. Modification, retrait et annulation

### Proposition

- L’organisateur peut modifier librement un brouillon.
- Après publication, les modifications mineures (note, niveau indicatif, précision du lieu) sont historisées et signalées aux coachs intéressés.
- Toute modification de date, heure, catégorie ou format doit avertir les coachs candidats. Les disponibilités des joueurs doivent alors être reconfirmées ou invalidées.
- Après confirmation, toute modification substantielle doit être acceptée par les deux coachs. À défaut d’accord, le match est annulé et une nouvelle proposition peut être créée.
- L’organisateur peut annuler une proposition ouverte ou en discussion. Les coachs candidats sont avertis, leurs liens invités deviennent inutilisables et leurs candidatures passent à retirées/annulées.
- Une proposition confirmée est annulée avec motif et notification aux deux coachs ; les modalités de notification aux joueurs sont à trancher.

### Candidature et réponses

- Le coach candidat peut retirer son intérêt ou sa candidature avant acceptation.
- La révocation du lien invité empêche toute nouvelle consultation ou modification de réponse via ce lien.
- Si un joueur change sa disponibilité après soumission, la candidature est signalée comme à reconfirmer par le coach. Une équipe déjà acceptée ne doit pas être silencieusement modifiée.
- Après acceptation, le retrait d’une équipe annule ou remet en discussion la rencontre selon les choix de capacité et de remplacement.

## 7. Cas limites et erreurs à traiter

- La proposition est annulée ou modifiée pendant qu’un joueur répond au formulaire.
- Le lien invité est expiré, révoqué, mal formé ou transmis à une autre personne.
- Un joueur n’est pas reconnu dans l’effectif de l’équipe, ou le lien a été ouvert par erreur par un tiers.
- Plusieurs appareils/personnes tentent de répondre pour le même joueur.
- Le coach soumet une équipe avec trop peu de joueurs disponibles, avec des joueurs sans réponse, ou avec une composition devenue obsolète.
- Le coach candidat et l’organisateur agissent simultanément (retrait et acceptation, annulation et soumission).
- Deux organisateurs acceptent des équipes différentes presque simultanément.
- Plusieurs équipes sont proposées pour la même rencontre, ou une équipe accepte plusieurs rencontres qui se chevauchent.
- Le créneau devient passé, le lieu change ou la proposition dépasse son délai de réponse.
- Le coach organisateur supprime son équipe ou son compte pendant qu’une proposition est active.
- Les joueurs ne répondent pas avant la date limite ; le système ne doit pas les considérer disponibles par défaut.
- La connexion échoue pendant la soumission ; l’interface doit permettre de vérifier si l’action a été prise en compte sans créer de doublon.

## 8. Informations et confidentialité

- Le réseau expose le minimum nécessaire pour trouver un adversaire : club/équipe, catégorie, niveau indicatif, zone, date/heure, format et statut.
- Les réponses de disponibilité individuelles restent privées au coach candidat, sauf consentement ou règle produit explicite.
- Le coach organisateur voit la composition officiellement soumise et le point de contact du coach candidat, mais pas les joueurs non retenus ni leur historique de réponses.
- Le lien invité doit être aléatoire, non devinable, révocable et limité à une candidature. Il ne doit pas donner accès au compte, à l’effectif complet ou aux autres données BenchMaster.
- Les données de disponibilité sont conservées selon une durée à définir, puis supprimées ou anonymisées après le match.

## 9. Périmètre

### Inclus dans le premier périmètre fonctionnel

- Propositions publiées par les coachs et consultables par le réseau.
- Intérêt et candidature d’une équipe.
- Lien invité permettant aux joueurs de déclarer leur disponibilité.
- Suivi des réponses côté coach candidat.
- Décision d’acceptation/refus côté organisateur.
- Historique de statuts, annulation et gestion des changements de créneau.

### Hors périmètre à ce stade

- Paiement, réservation de salle, arbitrage et transport.
- Messagerie instantanée générale entre clubs.
- Classement ou notation automatique des équipes.
- Synchronisation avec des calendriers externes.
- Création ou gestion de tournois et de championnats.
- Notifications SMS/push, tant que les canaux disponibles ne sont pas décidés.

## 10. Critères d’acceptation

1. Un coach connecté peut publier une proposition complète, la retrouver dans le réseau, puis l’annuler.
2. Un autre coach peut exprimer son intérêt pour cette proposition avec une équipe qu’il gère.
3. Le coach candidat peut créer et révoquer un lien limité à sa candidature.
4. Un joueur peut enregistrer ou modifier sa réponse via le lien sans compte BenchMaster et sans voir les réponses des autres joueurs.
5. Le coach candidat voit correctement le nombre de joueurs disponibles, indisponibles et sans réponse, avec actualisation à mesure des réponses.
6. Le coach candidat peut soumettre explicitement une équipe ; les disponibilités ne la soumettent jamais automatiquement.
7. L’organisateur peut accepter ou refuser une candidature ; l’équipe n’est dite acceptée qu’après son action explicite.
8. Les changements ou annulations de créneau invalident ou font reconfirmer les réponses selon la règle choisie, et les personnes concernées sont informées.
9. Les actions concurrentes ne peuvent pas créer deux équipes acceptées si une seule est autorisée.
10. Le parcours et les états sont compréhensibles sur mobile, avec les textes français et anglais de BenchMaster.

## 11. Décisions produit à trancher

Ces choix ont un impact direct sur l’interface, les données ou les transitions et doivent être fixés avant l’implémentation correspondante.

1. **Accès au réseau :** tout coach connecté, invitation uniquement, ou réseau filtré par région/ligue ? Les propositions sont-elles visibles par tous les coachs ou seulement certains profils ?
2. **Territoire et niveau :** quelles données sont requises pour publier (ville, rayon, niveau, catégorie, genre d’équipe) ? Le niveau est-il libre ou normalisé ?
3. **Capacité d’une proposition :** un organisateur cherche-t-il une seule équipe adverse ou plusieurs (plateau/tournoi) ? Après une acceptation, la proposition se ferme-t-elle immédiatement ?
4. **Définition de l’intérêt :** le coach manifeste-t-il un intérêt avant de consulter les disponibilités, ou le lien joueur doit-il être créé dès cette étape ?
5. **Règle de soumission :** le seuil choisi pour cette implémentation est le nombre demandé dans l’annonce (`requestedPlayerCount`), ou un joueur si aucun seuil n’est renseigné. Le coach sélectionne un sous-ensemble des joueurs disponibles ; les joueurs sans réponse ou indisponibles ne peuvent pas être inclus. Ce choix reste à valider comme règle produit.
6. **Identification des joueurs invités :** lien individuel par joueur (prérempli/à usage unique) ou lien d’équipe où le joueur s’identifie ? Comment éviter les réponses au nom d’un autre joueur ?
7. **Authentification/consentement joueur :** le lien suffit-il, ou faut-il un code/confirmation supplémentaire ? Quelles informations personnelles sont montrées aux joueurs ?
8. **Expiration :** durée du lien et date limite de réponse ; comportement à l’échéance ? La proposition expire-t-elle automatiquement ?
9. **Changement de créneau :** invalider toutes les réponses ou demander une reconfirmation individuelle ? Quel délai donne-t-on aux équipes candidates ?
10. **Modification après acceptation :** quelles modifications nécessitent l’accord explicite des deux coachs ? Comment un désaccord annule-t-il la rencontre ?
11. **Retrait après acceptation :** le match est-il annulé, republié pour trouver un remplaçant, ou maintenu en attente d’un accord ?
12. **Visibilité des données :** l’organisateur voit-il les noms et le nombre de joueurs avant la candidature officielle, ou seulement la composition soumise ?
13. **Notifications :** notifications internes uniquement, e-mail, ou les deux ? Quels événements doivent notifier coachs et joueurs ?
14. **Calendrier et résultat :** à quel moment créer le match dans le calendrier BenchMaster ? Le match confirmé est-il ensuite préparé et suivi avec le flux de match existant ?
15. **Mode invité BenchMaster :** le module réseau est-il réservé aux comptes connectés ? (Recommandation : oui, car les propositions doivent être rattachées à un coach et à une équipe persistante.)
16. **Conservation/suppression :** combien de temps garder les réponses nominatives et l’historique après la date du match ?

## 12. Hypothèses retenues pour cette proposition

- Le premier périmètre est réservé aux coachs connectés ; le mode invité local reste inchangé.
- Un intérêt n’est pas une candidature officielle, et la disponibilité individuelle n’est pas une confirmation d’équipe.
- Une seule équipe candidate est acceptée par proposition dans le parcours standard ; les propositions multi-équipes sont une extension à décider.
- Les réponses individuelles restent privées au coach candidat ; l’organisateur reçoit uniquement l’instantané officiellement soumis. Une modification de disponibilité après soumission remet la candidature à reconfirmer ; la sélection soumise reste visible comme dernier instantané jusqu’à sa nouvelle soumission.
- Les propositions et candidatures sont annulées/retirées par changement d’état plutôt que supprimées définitivement.
- Une seule équipe est acceptée par proposition. Les candidatures restantes sont refusées/clôturées automatiquement dans la transaction de confirmation.
- Les notifications sont internes à BenchMaster : intérêt reçu, équipe soumise, match confirmé, candidature refusée/clôturée et match annulé.
- Les matchs amicaux confirmés sont des événements bilatéraux dédiés, affichés dans la vue d’accueil des matchs amicaux des deux coachs. Ils ne deviennent pas des `Game` opérationnels, dont le modèle actuel ne représente qu’une seule équipe et un match à suivre en direct.
- L’organisateur ou le coach de l’équipe acceptée peut annuler un match confirmé ; l’autre coach reçoit une notification avec le motif facultatif.
- Le réseau est un espace de propositions, pas une messagerie sociale générale.

## 13. État d’implémentation

Les quatre tranches fonctionnelles sont implémentées : publication/consultation ; manifestation d’intérêt et liens joueurs ; suivi et soumission d’un instantané ; consultation des équipes candidates, acceptation/refus, confirmation bilatérale, notifications internes et annulation. Une seule équipe est acceptée de façon atomique ; les autres candidatures actives sont clôturées et notifiées. Le match confirmé apparaît dans la vue d’accueil des matchs amicaux des deux coachs. Le seuil de soumission (effectif demandé, ou un joueur par défaut), l’annulation par l’un ou l’autre coach et le choix d’une notification interne sont des règles retenues pour cette livraison et restent à valider par le produit. Le statut global de la spécification reste « proposition ».
