import { Injectable } from '@angular/core';
import {
  GameDetail,
  GameListItem,
  GamePlayerState,
  GameSummary,
  GameSummaryInsights,
  GameStatus,
  Player,
  PlayerStatType,
  RotationTimelineEvent,
  Team,
  TeamGender
} from '../core/models';
import { getTeamLabelSet } from '../core/team-labels';

interface GuestTeamRecord {
  id: number;
  name: string;
  gender: TeamGender;
  createdAt: string;
  updatedAt: string;
  players: Player[];
}

interface GuestState {
  team: GuestTeamRecord | null;
  game: GameDetail | null;
  nextPlayerId: number;
  nextGameId: number;
}

interface TeamSeedPlayerPayload {
  name: string;
  jerseyNumber: string;
  position?: string | null;
}

interface TeamPayload {
  name: string;
  gender?: TeamGender;
  players?: TeamSeedPlayerPayload[];
}

interface CreateGamePayload {
  teamId: number;
  label?: string;
  availablePlayerIds: number[];
  starterPlayerIds: number[];
}

interface RotationEventPayload {
  onCourtPlayerIds: number[];
  playerInIds?: number[];
  playerOutIds?: number[];
}

const STORAGE_KEY = 'benchmaster.guest-state';
const GUEST_TEAM_ID = 1;

const statLabels: Record<PlayerStatType, string> = {
  assists: 'passe décisive',
  blocks: 'contre',
  rebounds: 'rebond',
  interceptions: 'interception',
  fouls: 'faute'
};

function normalizeGamePlayer(player: GamePlayerState): GamePlayerState {
  return {
    ...player,
    interceptions: player.interceptions ?? 0,
    fouls: player.fouls ?? 0,
    periodFouls: player.periodFouls ?? 0
  };
}

function defaultState(): GuestState {
  return {
    team: null,
    game: null,
    nextPlayerId: 1,
    nextGameId: 1
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function compareJerseyNumbers(left: string, right: string) {
  return Number(left) - Number(right) || left.localeCompare(right);
}

function sortPlayersByJersey(players: Player[]) {
  return [...players].sort((left, right) => compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber));
}

function sortGamePlayersByJersey(players: GamePlayerState[]) {
  return [...players].sort((left, right) => compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber));
}

function sortGamePlayersByTime(players: GamePlayerState[]) {
  return [...players].sort((left, right) => {
    if (right.totalSeconds !== left.totalSeconds) {
      return right.totalSeconds - left.totalSeconds;
    }

    return compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function diffSeconds(from: string, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 1000));
}

function effectivePeriodStatus(game: GameDetail) {
  if (game.currentPeriodStatus === 'NOT_STARTED' && game.status !== 'DRAFT' && game.startedAt) {
    return 'LIVE';
  }

  return game.currentPeriodStatus;
}

function currentPeriodClockSeconds(game: GameDetail, now: Date) {
  return (
    game.periodElapsedSeconds +
    (game.isClockRunning && effectivePeriodStatus(game) === 'LIVE' && game.lastPeriodStartedAt
      ? diffSeconds(game.lastPeriodStartedAt, now)
      : 0)
  );
}

function onCourtPlayerIds(players: GamePlayerState[]) {
  return players.filter((player) => player.isOnCourt).map((player) => player.playerId);
}

function nextRotationEventId(game: GameDetail) {
  return (game.rotationTimeline.at(-1)?.id ?? 0) + 1;
}

function pushRotationEvent(
  game: GameDetail,
  kind: RotationTimelineEvent['kind'],
  periodNumber: number,
  clockMarkSeconds: number,
  payload: RotationEventPayload,
  createdAt: string
) {
  const playerMap = new Map(game.selectedPlayers.map((player) => [player.playerId, player]));
  const toPlayers = (playerIds: number[]) =>
    sortGamePlayersByJersey(
      playerIds
        .map((playerId) => playerMap.get(playerId))
        .filter((player): player is GamePlayerState => Boolean(player))
    );

  game.rotationTimeline.push({
    id: nextRotationEventId(game),
    kind,
    periodNumber,
    clockMarkSeconds,
    createdAt,
    playersIn: toPlayers(payload.playerInIds ?? []),
    playersOut: toPlayers(payload.playerOutIds ?? []),
    onCourt: toPlayers(payload.onCourtPlayerIds)
  });
}

function buildSummaryInsights(players: GamePlayerState[]): { totalPlayerSeconds: number; insights: GameSummaryInsights } {
  const totalPlayerSeconds = players.reduce((sum, player) => sum + player.totalSeconds, 0);
  const expectedSeconds = players.length ? totalPlayerSeconds / players.length : 0;
  const usageEntries = players.map((player) => ({
    playerId: player.playerId,
    name: player.name,
    jerseyNumber: player.jerseyNumber,
    isStarter: player.isStarter,
    totalSeconds: player.totalSeconds,
    expectedSeconds,
    deltaSeconds: player.totalSeconds - expectedSeconds,
    utilizationRatio: expectedSeconds > 0 ? player.totalSeconds / expectedSeconds : 1
  }));

  const topMinutes = usageEntries
    .slice()
    .sort((left, right) => right.totalSeconds - left.totalSeconds || compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber))
    .slice(0, 3);

  const overusedPlayers = usageEntries
    .filter((player) => player.deltaSeconds >= 60 && player.utilizationRatio >= 1.15)
    .sort((left, right) => right.deltaSeconds - left.deltaSeconds || compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber))
    .slice(0, 3);

  const underusedPlayers = usageEntries
    .filter((player) => player.deltaSeconds <= -60 && player.utilizationRatio <= 0.85)
    .sort((left, right) => left.deltaSeconds - right.deltaSeconds || compareJerseyNumbers(left.jerseyNumber, right.jerseyNumber))
    .slice(0, 3);

  const starterSeconds = players.filter((player) => player.isStarter).reduce((sum, player) => sum + player.totalSeconds, 0);
  const benchSeconds = totalPlayerSeconds - starterSeconds;
  const starterCount = players.filter((player) => player.isStarter).length;
  const benchCount = players.length - starterCount;

  return {
    totalPlayerSeconds,
    insights: {
      topMinutes,
      overusedPlayers,
      underusedPlayers,
      starterBenchSplit: {
        starterCount,
        benchCount,
        starterSeconds,
        benchSeconds,
        starterAverageSeconds: starterCount ? Math.round(starterSeconds / starterCount) : 0,
        benchAverageSeconds: benchCount ? Math.round(benchSeconds / benchCount) : 0,
        starterShare: totalPlayerSeconds ? starterSeconds / totalPlayerSeconds : 0,
        benchShare: totalPlayerSeconds ? benchSeconds / totalPlayerSeconds : 0
      }
    }
  };
}

function buildSummaryFromGame(game: GameDetail): GameSummary {
  const players = sortGamePlayersByTime(game.selectedPlayers);
  const { totalPlayerSeconds, insights } = buildSummaryInsights(players);
  const totalGameSeconds =
    game.clockElapsedSeconds +
    (game.status === 'LIVE' && game.lastClockStartedAt ? diffSeconds(game.lastClockStartedAt, new Date()) : 0);

  return {
    id: game.id,
    label: game.label,
    status: game.status,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    team: clone(game.team),
    totalGameSeconds,
    totalPlayerSeconds,
    maxPlayerSeconds: players[0]?.totalSeconds ?? 0,
    insights,
    rotationTimeline: clone(game.rotationTimeline),
    players
  };
}

function rebuildGameCollections(game: GameDetail) {
  game.selectedPlayers = sortGamePlayersByJersey(game.selectedPlayers);
  game.activePlayers = game.selectedPlayers.filter((player) => player.isOnCourt);
  game.benchPlayers = game.selectedPlayers.filter((player) => !player.isOnCourt);
}

function ensureTrackableLiveGame(game: GameDetail) {
  if (game.status !== 'LIVE' && game.status !== 'PAUSED') {
    throw new Error('Cette action est uniquement possible pendant un match en direct ou en pause.');
  }
}

function ensureLiveState(game: GameDetail) {
  if (game.status === 'FINISHED') {
    throw new Error('Ce match est déjà terminé.');
  }
}

function ensureExactlyFiveStarters(game: GameDetail) {
  const starters = game.selectedPlayers.filter((player) => player.isStarter);
  const labels = getTeamLabelSet(game.team.gender);

  if (game.selectedPlayers.length < 5 || starters.length !== 5) {
    throw new Error(`Un match en direct nécessite au moins cinq ${labels.playerPlural} sélectionné·es et exactement cinq titulaires.`);
  }
}

function finalizeClockAndPlayers(game: GameDetail, now: Date) {
  if (!game.isClockRunning || !game.lastClockStartedAt) {
    return;
  }

  const elapsedSinceResume = diffSeconds(game.lastClockStartedAt, now);
  const periodElapsedSinceResume =
    effectivePeriodStatus(game) === 'LIVE' && game.lastPeriodStartedAt ? diffSeconds(game.lastPeriodStartedAt, now) : 0;

  game.clockElapsedSeconds += elapsedSinceResume;
  game.periodElapsedSeconds += periodElapsedSinceResume;
  game.isClockRunning = false;
  game.lastClockStartedAt = null;
  game.lastPeriodStartedAt = null;

  game.selectedPlayers = game.selectedPlayers.map((player) => {
    if (!player.isOnCourt || !player.lastEnteredAt) {
      return player;
    }

    return {
      ...player,
      totalSeconds: player.totalSeconds + diffSeconds(player.lastEnteredAt, now),
      periodSeconds:
        player.periodSeconds + (player.lastPeriodEnteredAt ? diffSeconds(player.lastPeriodEnteredAt, now) : 0),
      lastEnteredAt: null,
      lastPeriodEnteredAt: null
    };
  });

  rebuildGameCollections(game);
}

function defaultGameLabel() {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `Match ${formatter.format(new Date())}`;
}

function normalizeSeedPlayers(players: TeamSeedPlayerPayload[] | undefined, teamGender: TeamGender = 'MIXED') {
  const usedJerseyNumbers = new Set<string>();
  const labels = getTeamLabelSet(teamGender);

  return (players ?? []).map((player, index) => {
    const name = player.name.trim();
    const jerseyNumber = String(player.jerseyNumber ?? '').trim();
    const position = player.position?.trim() || null;

    if (!name) {
      throw new Error(`Le nom ${labels.playerOfDefiniteSingular} n°${index + 1} est obligatoire.`);
    }

    if (!/^\d+$/.test(jerseyNumber)) {
      throw new Error(`Le numéro ${labels.playerOfDefiniteSingular} ${name} doit contenir uniquement des chiffres.`);
    }

    if (usedJerseyNumbers.has(jerseyNumber)) {
      throw new Error(`Le numéro ${jerseyNumber} est utilisé plusieurs fois dans la liste.`);
    }

    usedJerseyNumbers.add(jerseyNumber);

    return {
      name,
      jerseyNumber,
      position
    };
  });
}

@Injectable({ providedIn: 'root' })
export class GuestStorageService {
  async loadTeams() {
    const state = this.readState();
    return state.team ? [this.toTeam(state.team)] : [];
  }

  async createTeam(payload: TeamPayload) {
    const state = this.readState();
    const name = payload.name.trim();
    const gender = payload.gender ?? 'MIXED';
    const players = normalizeSeedPlayers(payload.players, gender);

    if (!name) {
      throw new Error("Le nom de l'équipe est obligatoire.");
    }

    if (state.team) {
      throw new Error('En mode invité, une seule équipe locale est autorisée.');
    }

    const createdAt = nowIso();
    state.team = {
      id: GUEST_TEAM_ID,
      name,
      gender,
      createdAt,
      updatedAt: nowIso(),
      players: players.map((player, index) => ({
        id: state.nextPlayerId + index,
        teamId: GUEST_TEAM_ID,
        ...player
      }))
    };
    state.nextPlayerId += players.length;
    this.syncGameWithRoster(state);
    this.writeState(state);

    return {
      id: state.team.id,
      name: state.team.name,
      gender: state.team.gender
    };
  }

  async updateTeam(teamId: number, payload: { name: string; gender?: TeamGender }) {
    const state = this.readState();
    const team = this.requireTeam(state, teamId);
    const name = payload.name.trim();

    if (!name) {
      throw new Error("Le nom de l'équipe est obligatoire.");
    }

    team.name = name;
    team.gender = payload.gender ?? 'MIXED';
    team.updatedAt = nowIso();
    this.syncGameWithRoster(state);
    this.writeState(state);
    return this.toTeam(team);
  }

  async deleteTeam(teamId: number) {
    const state = this.readState();
    this.requireTeam(state, teamId);
    this.writeState(defaultState());
  }

  async loadPlayers(teamId: number) {
    const state = this.readState();
    const team = this.requireTeam(state, teamId);
    return sortPlayersByJersey(team.players);
  }

  async createPlayer(teamId: number, payload: { name: string; jerseyNumber: string; position?: string | null }) {
    const state = this.readState();
    const team = this.requireTeam(state, teamId);
    const playerPayload = this.validatePlayerPayload(payload, team.players, team.gender);
    const player: Player = {
      id: state.nextPlayerId,
      teamId: team.id,
      ...playerPayload
    };

    state.nextPlayerId += 1;
    team.players.push(player);
    team.updatedAt = nowIso();
    this.syncGameWithRoster(state);
    this.writeState(state);
    return player;
  }

  async updatePlayer(
    teamId: number,
    playerId: number,
    payload: { name: string; jerseyNumber: string; position?: string | null }
  ) {
    const state = this.readState();
    const team = this.requireTeam(state, teamId);
    const player = team.players.find((entry) => entry.id === playerId);

    if (!player) {
      throw new Error(`${capitalize(getTeamLabelSet(team.gender).playerSingular)} introuvable.`);
    }

    const playerPayload = this.validatePlayerPayload(payload, team.players, team.gender, playerId);
    player.name = playerPayload.name;
    player.jerseyNumber = playerPayload.jerseyNumber;
    player.position = playerPayload.position;
    team.updatedAt = nowIso();
    this.syncGameWithRoster(state);
    this.writeState(state);
    return player;
  }

  async deletePlayer(teamId: number, playerId: number) {
    const state = this.readState();
    const team = this.requireTeam(state, teamId);

    if (state.game && state.game.status !== 'FINISHED' && state.game.selectedPlayers.some((player) => player.playerId === playerId)) {
      throw new Error(`${capitalize(getTeamLabelSet(team.gender).playerDemonstrativeSingular)} est déjà lié·e à un match local en cours et ne peut pas être supprimé·e.`);
    }

    const nextPlayers = team.players.filter((player) => player.id !== playerId);

    if (nextPlayers.length === team.players.length) {
      throw new Error(`${capitalize(getTeamLabelSet(team.gender).playerSingular)} introuvable.`);
    }

    team.players = nextPlayers;
    team.updatedAt = nowIso();
    this.syncGameWithRoster(state);
    this.writeState(state);
  }

  async loadGames() {
    const state = this.readState();
    return state.game ? [this.toGameListItem(state.game)] : [];
  }

  async createGame(payload: CreateGamePayload) {
    const state = this.readState();
    const team = this.requireTeam(state, payload.teamId);
    const labels = getTeamLabelSet(team.gender);

    const availablePlayerIds = payload.availablePlayerIds.map(Number);
    const starterPlayerIds = payload.starterPlayerIds.map(Number);

    if (!availablePlayerIds.length) {
      throw new Error(`Sélectionnez au moins ${labels.playerIndefiniteSingular} disponible.`);
    }

    if (new Set(availablePlayerIds).size !== availablePlayerIds.length) {
      throw new Error(`La liste des ${labels.playerPlural} disponibles contient des doublons.`);
    }

    if (new Set(starterPlayerIds).size !== starterPlayerIds.length) {
      throw new Error('La liste des titulaires contient des doublons.');
    }

    if (starterPlayerIds.length > 5) {
      throw new Error('Vous pouvez sélectionner au maximum cinq titulaires.');
    }

    const missingStarter = starterPlayerIds.find((playerId) => !availablePlayerIds.includes(playerId));

    if (missingStarter) {
      throw new Error(`Les titulaires doivent être choisi·es parmi les ${labels.playerPlural} disponibles.`);
    }

    const rosterMap = new Map(team.players.map((player) => [player.id, player]));
    const invalidPlayerId = availablePlayerIds.find((playerId) => !rosterMap.has(playerId));

    if (invalidPlayerId) {
      throw new Error(`Les ${labels.playerPlural} sélectionné·es doivent appartenir à l'équipe choisie.`);
    }

    const createdAt = nowIso();
    const selectedPlayers = availablePlayerIds.map((playerId, index) => {
      const player = rosterMap.get(playerId)!;

      return {
        gamePlayerId: index + 1,
        playerId: player.id,
        name: player.name,
        jerseyNumber: player.jerseyNumber,
        position: player.position,
        isStarter: starterPlayerIds.includes(player.id),
        totalSeconds: 0,
        periodSeconds: 0,
        points: 0,
        assists: 0,
        blocks: 0,
        rebounds: 0,
        interceptions: 0,
        fouls: 0,
        periodFouls: 0,
        isOnCourt: false,
        lastEnteredAt: null,
        lastPeriodEnteredAt: null
      } satisfies GamePlayerState;
    });

    state.game = {
      id: state.nextGameId,
      label: payload.label?.trim() || defaultGameLabel(),
      status: 'DRAFT',
      currentPeriodNumber: 1,
      currentPeriodStatus: 'NOT_STARTED',
      startedAt: null,
      endedAt: null,
      isClockRunning: false,
      clockElapsedSeconds: 0,
      lastClockStartedAt: null,
      periodElapsedSeconds: 0,
      lastPeriodStartedAt: null,
      createdAt,
      team: {
        id: team.id,
        name: team.name,
        gender: team.gender
      },
      rotationTimeline: [],
      selectedPlayers,
      activePlayers: [],
      benchPlayers: []
    };
    state.nextGameId += 1;
    rebuildGameCollections(state.game);
    this.writeState(state);

    return clone(state.game);
  }

  async getGame(gameId: number) {
    const game = this.requireGame(this.readState(), gameId);
    return clone(game);
  }

  async getSummary(gameId: number) {
    const game = this.requireGame(this.readState(), gameId);
    return buildSummaryFromGame(game);
  }

  async startGame(gameId: number) {
    return this.updateGame(gameId, (game) => {
      ensureLiveState(game);
      ensureExactlyFiveStarters(game);

      if (game.status !== 'DRAFT') {
        throw new Error('Seuls les matchs en brouillon peuvent être démarrés.');
      }

      const now = nowIso();
      game.status = 'LIVE';
      game.currentPeriodNumber = 1;
      game.currentPeriodStatus = 'LIVE';
      game.startedAt = now;
      game.isClockRunning = true;
      game.lastClockStartedAt = now;
      game.periodElapsedSeconds = 0;
      game.lastPeriodStartedAt = now;
      game.selectedPlayers = game.selectedPlayers.map((player) => ({
        ...player,
        isOnCourt: player.isStarter,
        periodSeconds: 0,
        periodFouls: 0,
        lastEnteredAt: player.isStarter ? now : null,
        lastPeriodEnteredAt: player.isStarter ? now : null
      }));
      pushRotationEvent(game, 'PERIOD_START', 1, 0, {
        onCourtPlayerIds: game.selectedPlayers.filter((player) => player.isStarter).map((player) => player.playerId)
      }, now);
      rebuildGameCollections(game);
    });
  }

  async pauseGame(gameId: number) {
    return this.updateGame(gameId, (game) => {
      ensureLiveState(game);

      if (game.status !== 'LIVE' || !game.isClockRunning) {
        throw new Error('Seul un match en cours peut être mis en pause.');
      }

      finalizeClockAndPlayers(game, new Date());
      game.status = 'PAUSED';
    });
  }

  async resumeGame(gameId: number) {
    return this.updateGame(gameId, (game) => {
      const labels = getTeamLabelSet(game.team.gender);
      ensureLiveState(game);

      if (game.status !== 'PAUSED' || game.isClockRunning) {
        throw new Error('Seul un match en pause peut être repris.');
      }

      if (effectivePeriodStatus(game) !== 'LIVE') {
        throw new Error('La reprise est uniquement possible pour une période déjà démarrée et non achevée.');
      }

      const onCourtPlayers = game.selectedPlayers.filter((player) => player.isOnCourt);

      if (onCourtPlayers.length !== 5) {
        throw new Error(`La reprise nécessite exactement cinq ${labels.playerPlural} actif·ves.`);
      }

      const now = nowIso();
      game.status = 'LIVE';
      game.isClockRunning = true;
      game.lastClockStartedAt = now;
      game.lastPeriodStartedAt = now;
      game.selectedPlayers = game.selectedPlayers.map((player) =>
        player.isOnCourt
          ? {
              ...player,
              lastEnteredAt: now,
              lastPeriodEnteredAt: now
            }
          : player
      );
      rebuildGameCollections(game);
    });
  }

  async completePeriod(gameId: number) {
    return this.updateGame(gameId, (game) => {
      ensureLiveState(game);

      if (game.status === 'DRAFT') {
        throw new Error('Démarrez le match avant d’achever une période.');
      }

      if (effectivePeriodStatus(game) !== 'LIVE') {
        throw new Error('Seule une période démarrée peut être marquée comme achevée.');
      }

      if (game.isClockRunning) {
        finalizeClockAndPlayers(game, new Date());
      }

      game.status = 'PAUSED';
      game.currentPeriodStatus = 'COMPLETED';
      game.isClockRunning = false;
      game.lastClockStartedAt = null;
      game.lastPeriodStartedAt = null;
      pushRotationEvent(
        game,
        'PERIOD_END',
        game.currentPeriodNumber,
        game.periodElapsedSeconds,
        { onCourtPlayerIds: onCourtPlayerIds(game.selectedPlayers) },
        nowIso()
      );
    });
  }

  async startNextPeriod(gameId: number) {
    return this.updateGame(gameId, (game) => {
      const labels = getTeamLabelSet(game.team.gender);
      ensureLiveState(game);

      if (game.status !== 'PAUSED') {
        throw new Error('La période suivante peut uniquement démarrer depuis un match en pause.');
      }

      if (game.currentPeriodStatus !== 'COMPLETED') {
        throw new Error('Achevez la période en cours avant de démarrer la suivante.');
      }

      const onCourtPlayers = game.selectedPlayers.filter((player) => player.isOnCourt);

      if (onCourtPlayers.length !== 5) {
        throw new Error(`Le démarrage d’une nouvelle période nécessite exactement cinq ${labels.playerPlural} actif·ves.`);
      }

      const now = nowIso();
      game.status = 'LIVE';
      game.currentPeriodNumber += 1;
      game.currentPeriodStatus = 'LIVE';
      game.isClockRunning = true;
      game.lastClockStartedAt = now;
      game.periodElapsedSeconds = 0;
      game.lastPeriodStartedAt = now;
      game.selectedPlayers = game.selectedPlayers.map((player) => ({
        ...player,
        periodSeconds: 0,
        periodFouls: 0,
        lastEnteredAt: player.isOnCourt ? now : null,
        lastPeriodEnteredAt: player.isOnCourt ? now : null
      }));
      pushRotationEvent(
        game,
        'PERIOD_START',
        game.currentPeriodNumber,
        0,
        { onCourtPlayerIds: onCourtPlayers.map((player) => player.playerId) },
        now
      );
      rebuildGameCollections(game);
    });
  }

  async endGame(gameId: number) {
    return this.updateGame(gameId, (game) => {
      ensureLiveState(game);

      if (game.status === 'DRAFT') {
        throw new Error('Démarrez le match avant de le terminer.');
      }

      finalizeClockAndPlayers(game, new Date());
      game.status = 'FINISHED';
      game.currentPeriodStatus = game.currentPeriodStatus === 'NOT_STARTED' ? 'NOT_STARTED' : 'COMPLETED';
      game.endedAt = nowIso();
      game.isClockRunning = false;
      game.lastClockStartedAt = null;
      game.lastPeriodStartedAt = null;
      pushRotationEvent(
        game,
        'GAME_END',
        game.currentPeriodNumber,
        game.periodElapsedSeconds,
        { onCourtPlayerIds: onCourtPlayerIds(game.selectedPlayers) },
        game.endedAt
      );
    });
  }

  async substitutePlayers(gameId: number, playerInIds: number[], playerOutIds: number[]) {
    return this.updateGame(gameId, (game) => {
      const labels = getTeamLabelSet(game.team.gender);
      if (!playerInIds.length && !playerOutIds.length) {
        throw new Error('Sélectionnez au moins un changement à appliquer.');
      }

      if (new Set(playerInIds).size !== playerInIds.length || new Set(playerOutIds).size !== playerOutIds.length) {
        throw new Error(`Chaque ${labels.playerSingular} ne peut être sélectionné·e qu’une seule fois par série de remplacements.`);
      }

      ensureTrackableLiveGame(game);

      const playerIns = playerInIds.map((playerId) => game.selectedPlayers.find((player) => player.playerId === playerId));
      const playerOuts = playerOutIds.map((playerId) => game.selectedPlayers.find((player) => player.playerId === playerId));

      if (playerIns.some((player) => !player) || playerOuts.some((player) => !player)) {
        throw new Error(`Tous les remplacements doivent concerner des ${labels.playerPlural} de la feuille de match.`);
      }

      if (playerIns.some((player) => player!.isOnCourt)) {
        throw new Error(`Au moins un·e ${labels.incomingSingular} est déjà sur le terrain.`);
      }

      if (playerIns.some((player) => player!.fouls >= 5)) {
        throw new Error(`Un·e ${labels.incomingSingular} disqualifié·e pour cinq fautes ne peut plus entrer.`);
      }

      if (playerOuts.some((player) => !player!.isOnCourt)) {
        throw new Error(`Au moins un·e ${labels.outgoingSingular} n’est pas actuellement sur le terrain.`);
      }

      const nextActiveCount = game.activePlayers.length - playerOutIds.length + playerInIds.length;

      if (nextActiveCount !== 5) {
        throw new Error(`Le changement doit laisser exactement cinq ${labels.playerPlural} sur le terrain.`);
      }

      const now = nowIso();
      const playerInIdSet = new Set(playerInIds);
      const playerOutIdSet = new Set(playerOutIds);
      const nextOnCourtPlayerIds = game.selectedPlayers
        .map((player) => {
          if (playerOutIdSet.has(player.playerId)) {
            return null;
          }

          if (playerInIdSet.has(player.playerId)) {
            return player.playerId;
          }

          return player.isOnCourt ? player.playerId : null;
        })
        .filter((playerId): playerId is number => playerId !== null);

      game.selectedPlayers = game.selectedPlayers.map((player) => {
        if (playerOutIdSet.has(player.playerId)) {
          return {
            ...player,
            isOnCourt: false,
            totalSeconds:
              player.totalSeconds + (game.isClockRunning && player.lastEnteredAt ? diffSeconds(player.lastEnteredAt, new Date(now)) : 0),
            periodSeconds:
              player.periodSeconds +
              (game.isClockRunning && player.lastPeriodEnteredAt ? diffSeconds(player.lastPeriodEnteredAt, new Date(now)) : 0),
            lastEnteredAt: null,
            lastPeriodEnteredAt: null
          };
        }

        if (playerInIdSet.has(player.playerId)) {
          return {
            ...player,
            isOnCourt: true,
            lastEnteredAt: game.isClockRunning ? now : null,
            lastPeriodEnteredAt: game.isClockRunning && effectivePeriodStatus(game) === 'LIVE' ? now : null
          };
        }

        return player;
      });
      pushRotationEvent(
        game,
        'SUBSTITUTION',
        game.currentPeriodNumber,
        currentPeriodClockSeconds(game, new Date(now)),
        {
          onCourtPlayerIds: nextOnCourtPlayerIds,
          playerInIds,
          playerOutIds
        },
        now
      );

      rebuildGameCollections(game);
    });
  }

  async recordPlayerPoints(gameId: number, playerId: number, points: number, correction = false) {
    return this.updateGame(gameId, (game) => {
      const labels = getTeamLabelSet(game.team.gender);
      if (!Number.isInteger(points) || points < 1 || points > 3) {
        throw new Error('Seuls les ajouts de 1, 2 ou 3 points sont autorisés.');
      }

      ensureTrackableLiveGame(game);
      const player = game.selectedPlayers.find((entry) => entry.playerId === playerId);

      if (!player) {
        throw new Error(`${capitalize(labels.playerSingular)} introuvable pour ce match.`);
      }

      if (!player.isOnCourt) {
        throw new Error(`Seul·e un·e ${labels.playerSingular} actuellement sur le terrain peut recevoir des points.`);
      }

      if (correction && player.points < points) {
        throw new Error('Impossible de retirer plus de points que ceux déjà enregistrés.');
      }

      player.points += correction ? -points : points;
      rebuildGameCollections(game);
    });
  }

  async recordPlayerStat(gameId: number, playerId: number, stat: PlayerStatType, correction = false) {
    return this.updateGame(gameId, (game) => {
      const labels = getTeamLabelSet(game.team.gender);
      ensureTrackableLiveGame(game);
      const player = game.selectedPlayers.find((entry) => entry.playerId === playerId);

      if (!player) {
        throw new Error(`${capitalize(labels.playerSingular)} introuvable pour ce match.`);
      }

      if (stat !== 'fouls' && !player.isOnCourt) {
        throw new Error(`Seul·e un·e ${labels.playerSingular} actuellement sur le terrain peut recevoir un ${statLabels[stat]}.`);
      }

      if (correction && player[stat] < 1) {
        throw new Error(`Impossible de retirer un ${statLabels[stat]} non enregistré.`);
      }

      if (stat === 'fouls' && correction && player.periodFouls < 1) {
        throw new Error('Impossible de retirer une faute d’équipe déjà remise à zéro pour une période précédente.');
      }

      player[stat] += correction ? -1 : 1;

      if (stat === 'fouls') {
        player.periodFouls += correction ? -1 : 1;
      }

      const disqualifyOnFifthFoul = stat === 'fouls' && !correction && player.fouls >= 5 && player.isOnCourt;

      if (disqualifyOnFifthFoul) {
        const now = new Date();
        const nowTimestamp = now.toISOString();

        player.totalSeconds += game.isClockRunning && player.lastEnteredAt ? diffSeconds(player.lastEnteredAt, now) : 0;
        player.periodSeconds += game.isClockRunning && player.lastPeriodEnteredAt ? diffSeconds(player.lastPeriodEnteredAt, now) : 0;
        player.isOnCourt = false;
        player.lastEnteredAt = null;
        player.lastPeriodEnteredAt = null;

        pushRotationEvent(
          game,
          'SUBSTITUTION',
          game.currentPeriodNumber,
          currentPeriodClockSeconds(game, now),
          {
            onCourtPlayerIds: onCourtPlayerIds(game.selectedPlayers).filter((entryPlayerId) => entryPlayerId !== playerId),
            playerInIds: [],
            playerOutIds: [playerId]
          },
          nowTimestamp
        );
      }

      rebuildGameCollections(game);
    });
  }

  private updateGame(gameId: number, updater: (game: GameDetail) => void) {
    const state = this.readState();
    const game = clone(this.requireGame(state, gameId));
    updater(game);
    rebuildGameCollections(game);
    state.game = game;
    this.writeState(state);
    return clone(game);
  }

  private toTeam(team: GuestTeamRecord): Team {
    return {
      id: team.id,
      name: team.name,
      gender: team.gender,
      playerCount: team.players.length,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt
    };
  }

  private toGameListItem(game: GameDetail): GameListItem {
    return {
      id: game.id,
      label: game.label,
      status: game.status as GameStatus,
      createdAt: game.createdAt,
      teamId: game.team.id,
      teamName: game.team.name,
      teamGender: game.team.gender,
      selectedCount: game.selectedPlayers.length,
      activeCount: game.activePlayers.length
    };
  }

  private validatePlayerPayload(
    payload: { name: string; jerseyNumber: string; position?: string | null },
    existingPlayers: Player[],
    teamGender: TeamGender = 'MIXED',
    excludedPlayerId?: number
  ) {
    const name = payload.name.trim();
    const jerseyNumber = payload.jerseyNumber.trim();
    const position = payload.position?.trim() || null;
    const labels = getTeamLabelSet(teamGender);

    if (!name) {
      throw new Error(`Le nom ${labels.playerOfDefiniteSingular} est obligatoire.`);
    }

    if (!/^\d+$/.test(jerseyNumber)) {
      throw new Error('Le numéro doit contenir uniquement des chiffres.');
    }

    if (
      existingPlayers.some(
        (player) => player.id !== excludedPlayerId && player.jerseyNumber === jerseyNumber
      )
    ) {
      throw new Error(`${capitalize(labels.playerIndefiniteSingular)} utilise déjà ce numéro dans cette équipe.`);
    }

    return {
      name,
      jerseyNumber,
      position
    };
  }

  private syncGameWithRoster(state: GuestState) {
    const team = state.team;

    if (!team || !state.game) {
      return;
    }

    state.game.team.name = team.name;
    state.game.team.gender = team.gender;
    state.game.selectedPlayers = state.game.selectedPlayers.map((player) => {
      const rosterPlayer = team.players.find((entry) => entry.id === player.playerId);

      if (!rosterPlayer) {
        return player;
      }

      return {
        ...player,
        name: rosterPlayer.name,
        jerseyNumber: rosterPlayer.jerseyNumber,
        position: rosterPlayer.position
      };
    });

    rebuildGameCollections(state.game);
  }

  private requireTeam(state: GuestState, teamId: number) {
    if (!state.team || state.team.id !== teamId) {
      throw new Error('Équipe introuvable.');
    }

    return state.team;
  }

  private requireGame(state: GuestState, gameId: number) {
    if (!state.game || state.game.id !== gameId) {
      throw new Error('Match introuvable.');
    }

    return state.game;
  }

  private readState(): GuestState {
    const rawState = localStorage.getItem(STORAGE_KEY);

    if (!rawState) {
      return defaultState();
    }

    try {
      const parsedState = JSON.parse(rawState) as GuestState;
      const normalizedTeam = parsedState.team
        ? {
            ...parsedState.team,
            gender: parsedState.team.gender ?? 'MIXED'
          }
        : null;
      const normalizedGame = parsedState.game
        ? {
            ...parsedState.game,
            team: {
              ...parsedState.game.team,
              gender: parsedState.game.team.gender ?? 'MIXED'
            },
            rotationTimeline: parsedState.game.rotationTimeline ?? [],
            selectedPlayers: (parsedState.game.selectedPlayers ?? []).map(normalizeGamePlayer),
            activePlayers: (parsedState.game.activePlayers ?? []).map(normalizeGamePlayer),
            benchPlayers: (parsedState.game.benchPlayers ?? []).map(normalizeGamePlayer)
          }
        : null;

      return {
        ...defaultState(),
        ...parsedState,
        team: normalizedTeam,
        game: normalizedGame
      };
    } catch {
      return defaultState();
    }
  }

  private writeState(state: GuestState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
