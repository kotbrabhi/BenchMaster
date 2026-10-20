# Parcours et écrans — Trouver un adversaire

- **Date :** 20 octobre 2026
- **Statut :** proposition UX basée sur la spécification fonctionnelle, elle-même encore au statut de proposition
- **Référence :** [Spécification fonctionnelle — Trouver un adversaire](./2026-10-20-trouver-un-adversaire.md)

## 1. Principes d’expérience

- Le module est accessible aux coachs connectés. Le lien joueur est la seule entrée publique prévue.
- Le parcours sépare en permanence trois faits : **disponibilités des joueurs**, **équipe soumise par le coach**, **équipe acceptée par l’organisateur**. Aucun de ces états ne doit être déduit d’un autre.
- Une action qui modifie un statut affiche une confirmation explicite et un retour de réussite ou d’échec.
- Les listes utilisent des cartes lisibles sur mobile, des filtres repliables et des indicateurs d’état textuels en plus de la couleur.
- Réutiliser les composants et conventions actuels : `page`, `toolbar`, `surface-card`, `section-heading`, `state-chip`, `status-panel`, `error-banner`, `info-banner`, `button`, `action-flow`. Conserver le thème clair/sombre, les libellés français/anglais et les états accessibles (`aria-live`, focus visible, labels explicites).
- Les pages coach utilisent le shell et la navigation BenchMaster. La page invité, ouverte depuis un lien, ne doit pas exposer les commandes du coach ni le reste de l’application.
- Les actions irréversibles ou impactant l’autre équipe (annuler, refuser, accepter, changer une date confirmée) demandent une confirmation contextualisée.

## 2. Navigation du module

Entrée principale : **Trouver un adversaire**.

Sous-navigation ou onglets dans le module :

- **Propositions** : réseau des matchs ouverts.
- **Mes matchs** : propositions créées par le coach et candidatures de ses équipes.
- **Créer une proposition** : action primaire visible depuis Propositions et Mes matchs.

Sur mobile, préférer des onglets horizontaux ou un sélecteur compact en haut de page plutôt qu’une seconde barre fixe. Le détail et les formulaires sont des routes/pages distinctes, avec un retour vers la liste d’origine.

**Hypothèse à confirmer :** tout coach connecté peut parcourir l’ensemble des propositions. Si le réseau est filtré par zone, ligue ou invitation, les filtres et l’état vide de la liste devront refléter cette règle.

## 3. Parcours A — Découvrir et répondre à une proposition

1. Le coach ouvre **Trouver un adversaire > Propositions**.
2. Il filtre ou trie les cartes et ouvre une proposition.
3. Il consulte les conditions, puis choisit son équipe et manifeste son intérêt.
4. La proposition apparaît dans **Mes matchs** avec l’état « Intérêt exprimé ».
5. Il ouvre le suivi de son équipe candidate, crée le lien invité et le partage aux joueurs.
6. Les réponses évoluent dans le suivi ; le coach décide de la composition à soumettre.
7. Il soumet officiellement l’équipe. La carte passe à « Équipe proposée » et attend la décision de l’organisateur.
8. L’organisateur accepte ou refuse. Le coach candidat voit la décision dans le suivi et dans Mes matchs.

## 4. Parcours B — Publier et organiser

1. L’organisateur ouvre **Créer une proposition**.
2. Il renseigne les détails et publie ou enregistre un brouillon.
3. Il suit les intérêts et candidatures depuis le détail de sa proposition.
4. Il ouvre une candidature soumise, vérifie la composition et les détails de l’équipe.
5. Il accepte ou refuse. Avant acceptation, il voit clairement que la sélection confirme le match et peut fermer la proposition aux autres candidatures.
6. À l’acceptation, les deux coachs accèdent à l’écran de confirmation et aux prochaines actions prévues pour le match.

## 5. Écrans

### Écran 1 — Liste « Propositions »

**Objectif :** aider un coach à repérer rapidement les matchs compatibles.

**Informations :**

- titre de la proposition et badge de statut (« Ouverte », « En discussion », « Confirmée » si l’archive est consultable) ;
- équipe/club organisateur et catégorie ;
- date et heure, zone/lieu selon visibilité retenue ;
- format, nombre de joueurs souhaité, niveau indicatif s’il est renseigné ;
- temps restant ou date limite seulement si une échéance est définie ;
- indicateur « Vous avez manifesté votre intérêt » pour une candidature existante.

**Actions :**

- ouvrir le détail ;
- rechercher et filtrer par date, distance/zone, catégorie, niveau et format ;
- trier par date la plus proche ou publication récente ;
- démarrer une nouvelle proposition ;
- changer vers Mes matchs.

**Chargement :** squelette de quelques cartes conservant la géométrie ; filtres utilisables après chargement des options. Au chargement incrémental, conserver les cartes déjà affichées.

**Erreurs :** erreur réseau avec action « Réessayer » ; échec d’un filtre sans effacer les résultats précédents ; session expirée avec retour à l’authentification puis retour à la liste.

**État vide :** expliquer qu’aucune proposition ne correspond aux filtres ; proposer « Effacer les filtres ». Si aucune proposition n’existe dans le réseau, préciser qu’il n’y en a pas encore et proposer de publier la première.

### Écran 2 — Détail d’une proposition

**Objectif :** permettre de décider si l’équipe souhaite candidater.

**Informations :**

- statut et chronologie condensée ;
- date, heure, durée/format, lieu ou zone, catégorie, niveau souhaité ;
- équipe organisatrice et note de l’organisateur ;
- conditions attendues (effectif, échéance, matériel ou informations pratiques si définis) ;
- état propre au coach : aucun intérêt, intérêt exprimé, disponibilités en collecte, équipe proposée, refusée, acceptée ou retirée.

**Actions pour un autre coach :**

- « Manifester mon intérêt » ; avant validation, choisir une équipe gérée ;
- après intérêt, « Suivre les disponibilités » / « Ouvrir ma candidature » ;
- partager le lien invité depuis le suivi ;
- retirer son intérêt avant décision, avec confirmation.

**Actions pour l’organisateur :**

- modifier ou annuler si la proposition n’est pas confirmée ;
- accéder au suivi des candidatures ;
- accepter/refuser uniquement depuis le détail d’une candidature officiellement soumise.

**Chargement :** en-tête et corps en squelette ; aucune action de candidature disponible avant d’avoir vérifié le statut et les droits.

**Erreurs :** proposition introuvable ou non visible ; proposition fermée entre affichage et clic ; conflit lors de la création du doublon d’intérêt ; échec de chargement avec retry. Chaque message propose une sortie appropriée vers la liste ou Mes matchs.

**État vide :** si les détails facultatifs ne sont pas fournis, ne pas afficher de sections vides. Si le coach ne possède aucune équipe, expliquer qu’il doit créer une équipe et proposer un lien vers la gestion des équipes.

### Écran 3 — Création et modification d’une proposition

**Structure recommandée :** formulaire progressif compact en sections, sans assistant à plusieurs étapes tant que le nombre de champs reste limité. Garder un bouton de publication visible en fin de formulaire ; sur mobile, les actions peuvent rester dans un pied de page non recouvrant.

**Champs :**

- équipe organisatrice (sélecteur) ;
- catégorie/genre de l’équipe ;
- date, heure de début et durée ou créneau ;
- lieu ou zone de recherche ;
- format de jeu et effectif adverse attendu ;
- niveau recherché facultatif ;
- note pratique facultative ;
- échéance de réponse si la règle produit l’adopte.

**Actions :**

- enregistrer comme brouillon ;
- publier ;
- annuler les modifications ;
- en édition d’une proposition publiée : enregistrer les changements, annuler la proposition ;
- après modification d’un champ critique (date, heure, catégorie, format), afficher un résumé d’impact et demander confirmation avant d’avertir les candidatures et de réinitialiser/faire reconfirmer les disponibilités.

**Validation :** signaler les erreurs au champ et dans un résumé accessible en haut du formulaire ; conserver les valeurs saisies. Vérifier date future, champs requis, cohérence heure/durée et équipe autorisée. Ne pas imposer une valeur par défaut trompeuse pour le niveau ou le lieu.

**Chargement :** bouton désactivé avec indicateur de progression pendant l’enregistrement ; garder le formulaire visible. En cas de délai réseau, éviter les doubles soumissions.

**Erreurs :** erreur de validation ; créneau devenu indisponible ou passé ; perte de connexion ; droits insuffisants ; suppression de l’équipe associée. Proposer correction/réessai sans perdre les données.

**État vide :** aucun brouillon existant n’exige pas d’état spécifique. Si aucune équipe n’est disponible, remplacer le formulaire par une explication et l’action de créer une équipe.

### Écran 4 — Mes matchs et suivi des équipes candidates (organisateur)

**Objectif :** donner une vue claire des propositions créées et de leur activité.

**Liste :** cartes de propositions avec statut, date, équipe organisatrice, compteur de candidatures par état (« Intérêt », « En collecte », « À examiner », « Acceptée ») et action d’ouverture.

**Détail de gestion :**

- résumé de la proposition et statut ;
- sections ou filtres pour intérêts, candidatures proposées, refusées/retirées ;
- par équipe candidate : nom du club/équipe, coach contact, catégorie/niveau, effectif officiellement soumis et informations déclarées ;
- indicateur explicite que les réponses individuelles des non-soumis ne sont pas visibles ;
- chronologie des événements et changements de créneau.

**Actions :**

- ouvrir le détail d’une candidature soumise ;
- accepter ou refuser une candidature soumise ;
- modifier ou annuler la proposition ;
- après acceptation : consulter la confirmation et, si autorisé, gérer l’annulation conjointe.

**Chargement :** squelette liste puis détail ; compteur non affiché avant disponibilité des données, pour éviter de présenter zéro comme valeur réelle.

**Erreurs :** échec de chargement des candidatures avec retry ; action devenue invalide car l’autre coach a retiré sa candidature ; proposition annulée ou acceptée entre-temps ; conflit si une autre équipe vient d’être acceptée.

**État vide :** aucune proposition créée : texte explicatif et action « Créer une proposition ». Proposition sans candidature : statut « En attente de coachs » et lien de partage de la proposition si la fonction de partage est retenue. Aucune candidature à examiner : indiquer qu’il n’y a rien à traiter.

### Écran 5 — Détail d’une candidature et décision organisateur

**Objectif :** décider en connaissance de cause sans confondre intérêt et engagement officiel.

**Informations :** équipe et coach candidat ; catégorie/niveau ; composition soumise, nombre de joueurs ; informations pratiques partagées ; date/heure de soumission ; confirmation que l’équipe proposée est une sélection volontaire du coach candidat.

**Actions :** accepter, refuser, retourner à la liste. Le refus peut demander un motif facultatif ou obligatoire selon décision produit. L’acceptation ouvre une boîte de confirmation indiquant que le match sera confirmé et que les autres candidatures pourront être fermées.

**Chargement :** détail en lecture seule jusqu’à chargement ; boutons de décision temporairement indisponibles.

**Erreurs :** candidature retirée/expirée ; proposition non ouverte ; une autre candidature vient d’être acceptée ; échec réseau. Rafraîchir l’état avant de proposer une nouvelle action.

**État vide :** accès direct vers une candidature inexistante ou non autorisée : écran d’indisponibilité avec retour à Mes matchs, sans divulguer si elle existe.

### Écran 6 — Lien invité : disponibilité du joueur

**Objectif :** recueillir une réponse simple depuis téléphone, sans compte BenchMaster.

**Informations visibles :** identité BenchMaster, adversaire ou organisateur tel qu’affiché au réseau, catégorie, date/heure, zone ou lieu suffisamment précis pour décider, état et date limite de réponse si elle existe. Pas de liste des autres joueurs ni de leurs réponses.

**Identification proposée :** lien individuel par joueur préassocié au nom et numéro de maillot, avec possibilité de confirmer que c’est bien lui. C’est la recommandation UX pour éviter qu’un lien commun permette de répondre pour un coéquipier ; ce choix doit être validé avec la décision produit sur les liens individuels.

**Actions :** choisir « Disponible » ou « Indisponible », enregistrer ; modifier sa réponse tant que la collecte est ouverte ; quitter la page. Afficher une confirmation après sauvegarde.

**Chargement :** page légère avec logo et squelette du résumé ; masquer le formulaire avant validation du jeton.

**Erreurs et états invalides :**

- lien expiré/révoqué/invalide : expliquer que la collecte est fermée ; ne pas révéler de données d’équipe ; fournir le contact du coach si prévu dans le lien ;
- proposition annulée ou date modifiée : avertir et ne pas conserver une réponse présentée comme valide ;
- joueur introuvable ou identité incohérente : demander de contacter son coach plutôt que proposer une réponse au nom d’un autre ;
- erreur réseau : garder le choix localement dans la page jusqu’au retry, sans le présenter comme enregistré ;
- enregistrement concurrent : recharger le dernier état et demander une nouvelle confirmation si nécessaire.

**État vide :** aucun état vide de liste. Si l’aperçu de proposition n’a pas toutes les informations, afficher uniquement les données confirmées et signaler ce qui reste à préciser avant décision.

### Écran 7 — Suivi des disponibilités (coach candidat)

**Objectif :** permettre au coach de juger si l’équipe peut jouer et de préparer une candidature officielle.

**Informations :** proposition liée ; équipe sélectionnée ; date/heure ; compteurs **Disponibles**, **Indisponibles**, **Sans réponse** ; liste des joueurs avec numéro/nom, statut, heure de dernière réponse ; lien invité actif/révoqué ; statut de la candidature. Les compteurs doivent totaliser l’effectif éligible et les « sans réponse » ne sont jamais ajoutés aux disponibles.

**Actions :** copier/partager le lien ; régénérer ou révoquer ; relancer les joueurs via partage système (pas de messagerie intégrée présumée) ; ajuster la sélection à soumettre ; soumettre officiellement l’équipe ; retirer la candidature si encore permis.

**Soumission :** présenter une revue de composition séparant disponibilité déclarée et joueurs sélectionnés. Confirmation : « Vous proposez cette équipe à l’organisateur » ; préciser qu’elle n’est pas encore acceptée.

**Chargement :** conserver les compteurs comme placeholders, jamais comme zéro ; actualiser les données après retour sur la page et via rafraîchissement périodique ou signal serveur, selon architecture future. Montrer discrètement l’heure de dernière mise à jour si les données ne sont pas temps réel.

**Erreurs :** échec de chargement avec retry ; lien expiré ; joueur supprimé de l’effectif ; réponse modifiée après soumission ; proposition modifiée/annulée ; erreur de soumission sans double création. Lors d’un changement de date, distinguer « Réponses à reconfirmer » et empêcher l’envoi tant que la règle de reconfirmation n’est pas satisfaite.

**État vide :** aucun joueur dans l’effectif : lien indisponible, explication et action vers la gestion d’effectif. Aucun retour : afficher 0 disponibles, 0 indisponibles, N sans réponse seulement après chargement complet. Réponses toutes indisponibles : indiquer que le coach peut retirer son intérêt ou attendre si le délai le permet, sans suggérer une soumission impossible.

### Écran 8 — Confirmation du match

**Objectif :** faire comprendre que l’organisateur a accepté l’équipe et récapituler la suite.

**Informations :** badge **Match confirmé** ; équipes et coachs ; date/heure et lieu ; format ; composition acceptée ; horodatage de confirmation ; prochaine action disponible.

**Actions :** retourner aux détails ; ouvrir ou créer la fiche de match BenchMaster selon la décision de calendrier ; partager les informations pratiques ; demander une modification ou annulation selon un parcours d’accord à deux coachs.

**Chargement :** après décision, afficher un état de transition puis le récapitulatif confirmé. Ne pas afficher « confirmé » avant que l’acceptation ait été enregistrée côté serveur.

**Erreurs :** conflit de confirmation (la proposition n’est plus disponible) : expliquer que l’état a changé et retourner au détail actualisé ; réponse incertaine après coupure réseau : vérifier le statut avant de permettre une nouvelle soumission ; échec de création de la fiche de match : distinguer clairement « match accepté » de « fiche BenchMaster non créée », si ces opérations sont séparées.

**État vide :** si la confirmation a été annulée après ouverture du lien, afficher « Ce match n’est plus confirmé » et le motif disponible, avec retour à Mes matchs.

## 6. États partagés et messages

- **Chargement initial :** squelette adapté à la page, jamais une liste vide provisoire.
- **Action en cours :** désactiver seulement les contrôles concernés, montrer le verbe d’action en progression et empêcher les doublons.
- **Réussite :** message bref près de l’action et statut mis à jour immédiatement après confirmation serveur.
- **Erreur de validation :** message au niveau du champ et résumé ; les valeurs saisies restent présentes.
- **Erreur serveur/réseau :** message compréhensible, action de reprise, aucune réussite optimiste non confirmée.
- **État obsolète/conflit :** recharger la ressource, expliquer ce qui a changé et présenter les nouvelles actions disponibles.
- **Statuts :** toujours libellés en texte et accessibles, la couleur reste un renfort uniquement.

## 7. Hypothèses et décisions bloquantes pour le design final

La spécification de référence n’étant pas encore validée, les éléments suivants sont des propositions UX :

1. La séparation Propositions / Mes matchs est retenue comme navigation.
2. Le lien invité est individuel par joueur, plutôt qu’un lien collectif avec saisie d’identité.
3. La visibilité du lieu est progressive : zone dans le réseau, détail plus précis après intérêt/acceptation selon la préférence de l’organisateur.
4. Une proposition standard accepte une seule équipe et se ferme après acceptation.
5. Les réponses individuelles restent visibles seulement au coach candidat ; l’organisateur reçoit la composition soumise.
6. Les filtres par distance, échéance de réponse, motif de refus, réinvitation, notifications et création automatique de fiche de match dépendent des choix produit et ne doivent pas être figés avant validation.
7. Les textes d’état « Prête à soumettre » et « À reconfirmer » sont des états d’interface calculés/provisoires ; ils ne doivent pas être ajoutés au modèle métier sans décision explicite.

## 8. Critères de revue UX

- Un coach peut distinguer en un coup d’œil intérêt exprimé, équipe proposée et équipe acceptée.
- Le parcours de réponse joueur tient sur un écran mobile et ne nécessite pas de compte.
- Le coach sait combien de joueurs sont disponibles, indisponibles et sans réponse, sans ambiguïté.
- L’organisateur ne voit aucune disponibilité individuelle non soumise.
- Une annulation, modification critique ou décision concurrente ne laisse pas l’interface annoncer un état dépassé.
- Les listes, formulaires, confirmations et erreurs fonctionnent avec le thème clair/sombre et les deux langues de l’application.
