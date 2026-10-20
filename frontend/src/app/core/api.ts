import { environment } from '../../environments/environment.generated';
import { TranslationKey } from './translations';

export const API_BASE_URL = environment.apiBaseUrl.replace(/\/$/, '');

type ErrorTranslator = (key: TranslationKey, params?: Record<string, string | number>) => string;

const exactErrorKeys: Record<string, TranslationKey> = {
  'Cette action est uniquement possible pendant un match en direct ou en pause.': 'error.actionLiveOrPaused',
  'Ce match est déjà terminé.': 'error.gameFinished',
  "Le nom de l'équipe est obligatoire.": 'error.teamNameRequired',
  'En mode invité, une seule équipe locale est autorisée.': 'error.teamLimit',
  'La liste des titulaires contient des doublons.': 'error.duplicateStarters',
  'Vous pouvez sélectionner au maximum cinq titulaires.': 'error.maxFiveStarters',
  'Seuls les matchs en brouillon peuvent être démarrés.': 'error.draftOnlyCanStart',
  'Seul un match en cours peut être mis en pause.': 'error.liveOnlyCanPause',
  'Seul un match en pause peut être repris.': 'error.pausedOnlyCanResume',
  'La reprise est uniquement possible pour une période déjà démarrée et non achevée.': 'error.resumeNeedsStartedPeriod',
  'Démarrez le match avant d’achever une période.': 'error.startBeforeCompletePeriod',
  'Seule une période démarrée peut être marquée comme achevée.': 'error.periodNotStarted',
  'La période suivante peut uniquement démarrer depuis un match en pause.': 'error.nextPeriodNeedsPause',
  'Achevez la période en cours avant de démarrer la suivante.': 'error.completeCurrentFirst',
  'Démarrez le match avant de le terminer.': 'error.startBeforeEnd',
  'Sélectionnez au moins un changement à appliquer.': 'error.chooseSubstitutions',
  'Seuls les ajouts de 1, 2 ou 3 points sont autorisés.': 'error.pointsOnlyOneToThree',
  'Impossible de retirer plus de points que ceux déjà enregistrés.': 'error.cannotRemoveMorePoints',
  'Statistique non prise en charge.': 'error.unsupportedStat',
  'Impossible de retirer une faute d’équipe déjà remise à zéro pour une période précédente.': 'error.teamFoulPreviousPeriod',
  'Le partage public est reserve au mode connecte.': 'error.shareRequiresAccount',
  'Le partage public est réservé au mode connecté.': 'error.shareRequiresAccount',
  'Le JSON de partage est invalide.': 'error.shareJsonInvalid',
  'Impossible de generer un identifiant de partage.': 'error.shareIdGeneration',
  'Identifiant de partage invalide.': 'error.shareIdInvalid',
  'Partage introuvable.': 'error.shareNotFound',
  'Une équipe valide est obligatoire.': 'error.teamRequired',
  'L’adresse e-mail est obligatoire.': 'error.authEmailRequired',
  'L’adresse e-mail est invalide.': 'error.authEmailInvalid',
  'Le mot de passe doit contenir au moins 8 caractères.': 'error.authPasswordShort',
  'Un compte existe déjà avec cette adresse e-mail.': 'error.authAccountExists',
  'Identifiants invalides.': 'error.authInvalid',
  'Utilisateur introuvable.': 'error.authUserNotFound',
  'Authentification requise.': 'error.authRequired',
  'Jeton invalide.': 'error.authTokenInvalid',
  'Session expirée.': 'error.authSessionExpired',
  'Erreur serveur inattendue.': 'error.serverUnexpected',
  'Une erreur est survenue. Veuillez réessayer.': 'error.generic',
  'Équipe introuvable.': 'error.teamNotFound',
  'Proposition introuvable.': 'friendlies.errorNotFound',
  'La proposition demandée est invalide.': 'friendlies.errorInvalidId',
  'Cette proposition ne peut plus être modifiée.': 'friendlies.errorNotEditable',
  'Cette proposition ne peut plus être annulée.': 'friendlies.errorNotCancellable',
  'La date du match doit être dans le futur.': 'friendlies.errorDateFuture',
  'La date limite doit être dans le futur.': 'friendlies.errorDeadlineFuture',
  'La date limite doit précéder le match.': 'friendlies.errorDeadlineBeforeMatch',
  'La durée doit être comprise entre 1 et 240 minutes.': 'friendlies.errorDuration',
  'Le nombre de joueurs doit être compris entre 1 et 30.': 'friendlies.errorPlayerCount',
  'La période de recherche est invalide.': 'friendlies.errorDateRange',
  'La catégorie est obligatoire.': 'friendlies.errorRequiredCategory',
  'Les informations de la proposition sont invalides.': 'friendlies.errorInvalidPayload',
  'La proposition ou l’équipe est invalide.': 'friendlies.errorInvalidApplicationInput',
  'Candidature introuvable.': 'friendlies.errorApplicationNotFound',
  'La candidature demandée est invalide.': 'friendlies.errorInvalidApplicationId',
  'Cette proposition n’accepte plus de réponses.': 'friendlies.errorProposalClosed',
  'La période de réponse est terminée.': 'friendlies.errorResponsesExpired',
  'Vous ne pouvez pas candidater à votre propre proposition.': 'friendlies.errorOwnProposal',
  'Cette équipe a déjà manifesté son intérêt.': 'friendlies.errorAlreadyInterested',
  'Cette candidature ne peut plus recueillir de disponibilités.': 'friendlies.errorApplicationClosed',
  'Ajoutez des joueurs à votre équipe avant de créer les liens.': 'friendlies.errorNoPlayers',
  'Lien introuvable.': 'friendlies.errorInviteNotFound',
  'Lien indisponible ou expiré.': 'friendlies.errorInviteUnavailable',
  'La réponse est invalide.': 'friendlies.errorInvalidResponse',
  'Choisissez disponible ou indisponible.': 'friendlies.errorChooseAvailability',
  'La version de la réponse est invalide.': 'friendlies.errorInvalidRevision',
  'La réponse a changé depuis son chargement. Rechargez la page.': 'friendlies.errorResponseConflict',
  'Sélectionnez une composition valide.': 'friendlies.errorInvalidLineup',
  'Sélectionnez au moins un joueur disponible.': 'friendlies.errorEmptyLineup',
  'Cette candidature ne peut pas être soumise dans son état actuel.': 'friendlies.errorCannotSubmit',
  'La disponibilité a changé. Actualisez le tableau avant de soumettre.': 'friendlies.errorAvailabilityChanged',
  'La candidature a changé. Actualisez-la avant de soumettre.': 'friendlies.errorApplicationChanged',
  'La collecte de disponibilités est terminée. Contactez votre coach en cas de changement.': 'friendlies.errorAvailabilityClosed',
  'Le motif d’annulation est invalide.': 'friendlies.errorInvalidCancellationReason',
  'Cette proposition a déjà été confirmée, annulée ou fermée.': 'friendlies.errorProposalAlreadyDecided',
  'Seule une équipe officiellement proposée peut être acceptée.': 'friendlies.errorTeamNotSubmitted',
  'Cette équipe ne satisfait plus le minimum demandé.': 'friendlies.errorMinimumNotMet',
  'La candidature a changé. Actualisez la liste des équipes.': 'friendlies.errorCandidateChanged',
  'Cette proposition n’accepte plus de décision.': 'friendlies.errorDecisionClosed',
  'Cette équipe ne peut pas être refusée dans son état actuel.': 'friendlies.errorCannotReject',
  'La proposition a changé. Actualisez-la avant de l’annuler.': 'friendlies.errorProposalChanged',
  'La notification demandée est invalide.': 'friendlies.errorInvalidNotificationId',
  'Notification introuvable.': 'friendlies.errorNotificationNotFound',
  'La zone est obligatoire.': 'friendlies.errorRequiredArea',
  'Le format est obligatoire.': 'friendlies.errorRequiredFormat',
  'La date du match est invalide.': 'friendlies.errorInvalidDate',
  'La date limite est invalide.': 'friendlies.errorInvalidDate',
  'La catégorie est invalide.': 'friendlies.errorInvalidField',
  'La zone est invalide.': 'friendlies.errorInvalidField',
  'Le format est invalide.': 'friendlies.errorInvalidField',
  'Le lieu est invalide.': 'friendlies.errorInvalidField',
  'Le niveau est invalide.': 'friendlies.errorInvalidField',
  'La note est invalide.': 'friendlies.errorInvalidField',
  'Match introuvable.': 'error.gameNotFound',
  'Le numéro doit contenir uniquement des chiffres.': 'error.jerseyDigits',
  'La liste des joueur·euses disponibles contient des doublons.': 'error.duplicateAvailablePlayers',
  'La liste des joueuses disponibles contient des doublons.': 'error.duplicateAvailablePlayers',
  'La liste des joueurs disponibles contient des doublons.': 'error.duplicateAvailablePlayers',
  'Les titulaires doivent être choisi·es parmi les joueur·euses disponibles.': 'error.startersMustBeAvailable',
  'Les titulaires doivent être choisies parmi les joueuses disponibles.': 'error.startersMustBeAvailable',
  'Les titulaires doivent être choisis parmi les joueurs disponibles.': 'error.startersMustBeAvailable',
  'Origine non autorisee.': 'error.originNotAllowed',
  'Origine non autorisée.': 'error.originNotAllowed'
};

function translatedMessage(message: string, translate?: ErrorTranslator) {
  if (!translate) {
    return undefined;
  }

  const exactKey = exactErrorKeys[message];
  if (exactKey) {
    return translate(exactKey);
  }

  let match = /^Le nom .* n°(\d+) est obligatoire\.$/.exec(message);
  if (match) {
    return translate('error.playerNameRequired', { index: match[1] });
  }

  match = /^Le numéro (?:du\/de la joueur·euse|de la joueuse|du joueur) (.+) doit contenir uniquement des chiffres\.$/.exec(message);
  if (match) {
    return translate('error.playerJerseyDigits', { player: match[1] });
  }

  match = /^Le numéro (\d+) est utilisé plusieurs fois dans la liste\.$/.exec(message);
  if (match) {
    return translate('error.jerseyDuplicate', { number: match[1] });
  }

  match = /^Au moins (\d+) joueurs disponibles sont nécessaires\.$/.exec(message);
  if (match) return translate('friendlies.errorMinimumPlayers', { count: match[1] });

  match = /^(?:Joueur·euse|Joueuse|Joueur) introuvable(?: pour ce match)?\.$/.exec(message);
  if (match) {
    const key = message.endsWith('pour ce match.') ? 'error.playerInGameNotFound' : 'error.playerNotFound';
    return translate(key);
  }

  if (/^Le nom (?:du\/de la joueur·euse|de la joueuse|du joueur) est obligatoire\.$/.test(message)) {
    return translate('error.playerNameRequiredSimple');
  }

  match = / contient des doublons\.$/.exec(message);
  if (match) {
    const key = message.includes('titulaires')
      ? 'error.duplicateStarters'
      : 'error.duplicateAvailablePlayers';
    return translate(key);
  }

  if (/nécessite au moins cinq .* sélectionné·es et exactement cinq titulaires\.$/.test(message)) {
    return translate('error.lineupMustHaveFive');
  }
  if (/^Sélectionnez au moins (?:un·e joueur·euse|une joueuse|un joueur) disponible\.$/.test(message)) {
    return translate('error.chooseAvailablePlayer');
  }
  if (/^La liste des .+ disponibles contient des doublons\.$/.test(message)) {
    return translate('error.duplicateAvailablePlayers');
  }
  if (/^Les titulaires doivent être choisi(?:·es|es|s) parmi les .+ disponibles\.$/.test(message)) {
    return translate('error.startersMustBeAvailable');
  }
  if (/^Les .+ sélectionné(?:·es|es|s) doivent appartenir à l'équipe choisie\.$/.test(message)) {
    return translate('error.playersMustBelongToTeam');
  }
  if (/^La reprise nécessite exactement cinq .+ actif(?:·ves|ves|s)\.$/.test(message)) {
    return translate('error.resumeNeedsFivePlayers');
  }
  if (/^Le démarrage d’une nouvelle période nécessite exactement cinq .+ actif(?:·ves|ves|s)\.$/.test(message)) {
    return translate('error.nextPeriodNeedsFivePlayers');
  }
  if (/^Chaque .+ ne peut être sélectionné·e qu’une seule fois par série de remplacements\.$/.test(message)) {
    return translate('error.playerSelectedTwice');
  }
  if (/^Tous les remplacements doivent concerner des .+ de la feuille de match\.$/.test(message)) {
    return translate('error.substitutionPlayersMustBeInGame');
  }
  if (/^Au moins un·e .+ est déjà sur le terrain\.$/.test(message)) {
    return translate('error.incomingAlreadyOnCourt');
  }
  if (/^Un·e .+ disqualifié·e pour cinq fautes ne peut plus entrer\.$/.test(message)) {
    return translate('error.incomingDisqualified');
  }
  if (/^Au moins un·e .+ n’est pas actuellement sur le terrain\.$/.test(message)) {
    return translate('error.outgoingNotOnCourt');
  }
  if (/^Le changement doit laisser exactement cinq .+ sur le terrain\.$/.test(message)) {
    return translate('error.substitutionMustKeepFive');
  }
  if (/^Seul·e .+ actuellement sur le terrain peut recevoir des points\.$/.test(message)) {
    return translate('error.playerMustBeOnCourtForPoints');
  }
  if (/^Seul·e .+ actuellement sur le terrain peut recevoir un .+\.$/.test(message)) {
    return translate('error.playerMustBeOnCourtForStat');
  }
  if (/^Impossible de retirer un .+ non enregistré\.$/.test(message)) {
    const rawStat = message.slice('Impossible de retirer un '.length, -' non enregistré.'.length);
    const stat = ({
      'passe décisive': 'assist',
      contre: 'block',
      rebond: 'rebound',
      interception: 'interception',
      faute: 'foul'
    } as Record<string, string>)[rawStat] ?? rawStat;
    const localizedStat = ({
      assist: translate('error.stat.assist'),
      block: translate('error.stat.block'),
      rebound: translate('error.stat.rebound'),
      interception: translate('error.stat.interception'),
      foul: translate('error.stat.foul')
    } as Record<string, string>)[stat] ?? stat;
    return translate('error.cannotRemoveUnrecordedStat', { stat: localizedStat });
  }

  if (/^(?:Ce·tte joueur·euse|Cette joueuse|Ce joueur) est déjà lié·e à un match local en cours et ne peut pas être supprimé·e\.$/.test(message)) {
    return translate('error.playerLockedInGame');
  }

  if (/^(?:Un·e joueur·euse|Une joueuse|Un joueur) utilise déjà ce numéro dans cette équipe\.$/.test(message)) {
    return translate('error.jerseyAlreadyUsed');
  }

  if (/^.* contient des doublons\.$/.test(message)) {
    return translate('error.duplicateAvailablePlayers');
  }

  return undefined;
}

export function getErrorMessage(error: unknown, translate?: ErrorTranslator) {
  let message = '';
  let status: number | undefined;

  if (typeof error === 'object' && error !== null && 'error' in error) {
    const response = error as { error?: unknown; status?: number };
    const candidate =
      typeof response.error === 'string'
        ? response.error
        : typeof response.error === 'object' && response.error !== null && 'message' in response.error
          ? String((response.error as { message: unknown }).message)
          : '';

    if (candidate) {
      message = candidate;
    }
    status = response.status;
  }

  if (status === 0) {
    return translate?.('error.network') ?? 'Une erreur est survenue. Veuillez réessayer.';
  }

  if (!message && error instanceof Error) {
    message = error.message;
  }

  const localized = translatedMessage(message, translate);
  if (localized) {
    return localized;
  }

  if (!message) {
    return translate?.('error.generic') ?? 'Une erreur est survenue. Veuillez réessayer.';
  }

  return message;
}
