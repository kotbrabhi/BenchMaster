import { TeamGender } from '@prisma/client';

interface TeamLabelSet {
  playerSingular: string;
  playerPlural: string;
  playerIndefiniteSingular: string;
  playerDefiniteSingular: string;
  playerOfDefiniteSingular: string;
  playerDemonstrativeSingular: string;
  incomingSingular: string;
  incomingPlural: string;
  outgoingSingular: string;
  outgoingPlural: string;
}

const MIXED_LABELS: TeamLabelSet = {
  playerSingular: 'joueur·euse',
  playerPlural: 'joueur·euses',
  playerIndefiniteSingular: 'un·e joueur·euse',
  playerDefiniteSingular: 'le/la joueur·euse',
  playerOfDefiniteSingular: 'du/de la joueur·euse',
  playerDemonstrativeSingular: 'ce·tte joueur·euse',
  incomingSingular: 'entrant·e',
  incomingPlural: 'entrant·es',
  outgoingSingular: 'sortant·e',
  outgoingPlural: 'sortant·es'
};

const FEMININE_LABELS: TeamLabelSet = {
  playerSingular: 'joueuse',
  playerPlural: 'joueuses',
  playerIndefiniteSingular: 'une joueuse',
  playerDefiniteSingular: 'la joueuse',
  playerOfDefiniteSingular: 'de la joueuse',
  playerDemonstrativeSingular: 'cette joueuse',
  incomingSingular: 'entrante',
  incomingPlural: 'entrantes',
  outgoingSingular: 'sortante',
  outgoingPlural: 'sortantes'
};

const MASCULINE_LABELS: TeamLabelSet = {
  playerSingular: 'joueur',
  playerPlural: 'joueurs',
  playerIndefiniteSingular: 'un joueur',
  playerDefiniteSingular: 'le joueur',
  playerOfDefiniteSingular: 'du joueur',
  playerDemonstrativeSingular: 'ce joueur',
  incomingSingular: 'entrant',
  incomingPlural: 'entrants',
  outgoingSingular: 'sortant',
  outgoingPlural: 'sortants'
};

export function getTeamLabelSet(teamGender?: TeamGender | null) {
  if (teamGender === 'FEMININE') {
    return FEMININE_LABELS;
  }

  if (teamGender === 'MASCULINE') {
    return MASCULINE_LABELS;
  }

  return MIXED_LABELS;
}
