import { TeamGender } from './models';

export interface TeamLabelSet {
  playerSingular: string;
  playerPlural: string;
  playerIndefiniteSingular: string;
  playerDefiniteSingular: string;
  playerOfDefiniteSingular: string;
  playerDemonstrativeSingular: string;
  selectedSingular: string;
  selectedPlural: string;
  activePlural: string;
  readyPlural: string;
  registeredPlural: string;
  trackedPlural: string;
  definedPlural: string;
  exactPlural: string;
  incomingSingular: string;
  incomingPlural: string;
  outgoingSingular: string;
  outgoingPlural: string;
  pgLabel: string;
  sfLabel: string;
  pfLabel: string;
  positionPlaceholder: string;
}

const MIXED_LABELS: TeamLabelSet = {
  playerSingular: 'joueur·euse',
  playerPlural: 'joueur·euses',
  playerIndefiniteSingular: 'un·e joueur·euse',
  playerDefiniteSingular: 'le/la joueur·euse',
  playerOfDefiniteSingular: 'du/de la joueur·euse',
  playerDemonstrativeSingular: 'ce·tte joueur·euse',
  selectedSingular: 'sélectionné·e',
  selectedPlural: 'sélectionné·es',
  activePlural: 'actif·ves',
  readyPlural: 'prêt·es',
  registeredPlural: 'inscrit·es',
  trackedPlural: 'suivi·es',
  definedPlural: 'défini·es',
  exactPlural: 'exact·es',
  incomingSingular: 'entrant·e',
  incomingPlural: 'entrant·es',
  outgoingSingular: 'sortant·e',
  outgoingPlural: 'sortant·es',
  pgLabel: 'Meneur·euse',
  sfLabel: 'Ailier·ère',
  pfLabel: 'Ailier·ère fort·e',
  positionPlaceholder: 'Meneur·euse / Ailier·ère / Pivot'
};

const FEMININE_LABELS: TeamLabelSet = {
  playerSingular: 'joueuse',
  playerPlural: 'joueuses',
  playerIndefiniteSingular: 'une joueuse',
  playerDefiniteSingular: 'la joueuse',
  playerOfDefiniteSingular: 'de la joueuse',
  playerDemonstrativeSingular: 'cette joueuse',
  selectedSingular: 'sélectionnée',
  selectedPlural: 'sélectionnées',
  activePlural: 'actives',
  readyPlural: 'prêtes',
  registeredPlural: 'inscrites',
  trackedPlural: 'suivies',
  definedPlural: 'définies',
  exactPlural: 'exactes',
  incomingSingular: 'entrante',
  incomingPlural: 'entrantes',
  outgoingSingular: 'sortante',
  outgoingPlural: 'sortantes',
  pgLabel: 'Meneuse',
  sfLabel: 'Ailière',
  pfLabel: 'Ailière forte',
  positionPlaceholder: 'Meneuse / Ailière / Pivot'
};

const MASCULINE_LABELS: TeamLabelSet = {
  playerSingular: 'joueur',
  playerPlural: 'joueurs',
  playerIndefiniteSingular: 'un joueur',
  playerDefiniteSingular: 'le joueur',
  playerOfDefiniteSingular: 'du joueur',
  playerDemonstrativeSingular: 'ce joueur',
  selectedSingular: 'sélectionné',
  selectedPlural: 'sélectionnés',
  activePlural: 'actifs',
  readyPlural: 'prêts',
  registeredPlural: 'inscrits',
  trackedPlural: 'suivis',
  definedPlural: 'définis',
  exactPlural: 'exacts',
  incomingSingular: 'entrant',
  incomingPlural: 'entrants',
  outgoingSingular: 'sortant',
  outgoingPlural: 'sortants',
  pgLabel: 'Meneur',
  sfLabel: 'Ailier',
  pfLabel: 'Ailier fort',
  positionPlaceholder: 'Meneur / Ailier / Pivot'
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getTeamLabelSet(teamGender?: TeamGender | null) {
  if (teamGender === 'FEMININE') {
    return FEMININE_LABELS;
  }

  if (teamGender === 'MASCULINE') {
    return MASCULINE_LABELS;
  }

  return MIXED_LABELS;
}

export function buildTeamLabelParams(teamGender?: TeamGender | null) {
  const labels = getTeamLabelSet(teamGender);

  return {
    ...labels,
    playerSingularCapitalized: capitalize(labels.playerSingular),
    playerPluralCapitalized: capitalize(labels.playerPlural)
  };
}
