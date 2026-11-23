import { Injectable } from '@angular/core';
import { GameDetail, PlayerStatType } from '../core/models';
import { getTeamLabelSet } from '../core/team-labels';
import { GuestStateStore } from './guest-state.store';
import {
  capitalize, currentPeriodClockSeconds, diffSeconds, effectivePeriodStatus, ensureExactlyFiveStarters,
  ensureLiveState, ensureTrackableLiveGame, finalizeClockAndPlayers, nowIso, onCourtPlayerIds,
  pushRotationEvent, rebuildGameCollections, statLabels
} from './guest-match.utils';

export type UpdateGame = (gameId: number, updater: (game: GameDetail) => void) => Promise<GameDetail>;

@Injectable({ providedIn: 'root' })
export class GuestLiveMatchService {
  constructor(private readonly store: GuestStateStore) {}

  async addTrainingPlayer(gameId: number, playerId: number) {
    const state = this.store.readState();
    const game = state.game;
    if (!game || game.id !== gameId) throw new Error('Match introuvable.');
    if (game.sessionType !== 'TRAINING' || (game.status !== 'LIVE' && game.status !== 'PAUSED')) throw new Error('Un joueur peut être ajouté uniquement pendant un entraînement en cours ou en pause.');
    const team = state.team;
    if (!team || team.id !== game.team.id) throw new Error('Équipe introuvable.');
    const player = team.players.find((entry) => entry.id === playerId);
    if (!player) throw new Error('Ce joueur ne fait pas partie de l’équipe de la séance.');
    if (game.selectedPlayers.some((entry) => entry.playerId === playerId)) throw new Error('Ce joueur est déjà suivi dans cette séance.');
    const now = nowIso();
    const active = game.isClockRunning;
    game.selectedPlayers.push({
      gamePlayerId: Math.max(0, ...game.selectedPlayers.map((entry) => entry.gamePlayerId)) + 1,
      playerId: player.id, name: player.name, jerseyNumber: player.jerseyNumber, position: player.position,
      isStarter: false, totalSeconds: 0, periodSeconds: 0, points: 0, assists: 0, blocks: 0, rebounds: 0,
      interceptions: 0, fouls: 0, periodFouls: 0, isOnCourt: true,
      lastEnteredAt: active ? now : null, lastPeriodEnteredAt: active ? now : null
    });
    pushRotationEvent(game, 'ACTIVITY_CHANGE', game.currentPeriodNumber, currentPeriodClockSeconds(game, new Date(now)), {
      onCourtPlayerIds: game.selectedPlayers.filter((entry) => entry.isOnCourt).map((entry) => entry.playerId), playerInIds: [player.id], playerOutIds: []
    }, now);
    rebuildGameCollections(game);
    this.store.writeState(state);
    return structuredClone(game);
  }

  startGame(updateGame: UpdateGame, gameId: number) {
    return updateGame(gameId, (game) => {
      ensureLiveState(game); ensureExactlyFiveStarters(game);
      if (game.status !== 'DRAFT') throw new Error('Seuls les matchs en brouillon peuvent être démarrés.');
      const now = nowIso();
      game.status = 'LIVE'; game.currentPeriodNumber = 1; game.currentPeriodStatus = 'LIVE'; game.startedAt = now;
      game.isClockRunning = true; game.lastClockStartedAt = now; game.periodElapsedSeconds = 0; game.lastPeriodStartedAt = now;
      game.selectedPlayers = game.selectedPlayers.map((player) => ({
        ...player, isOnCourt: game.sessionType === 'TRAINING' || player.isStarter, periodSeconds: 0, periodFouls: 0,
        lastEnteredAt: game.sessionType === 'TRAINING' || player.isStarter ? now : null,
        lastPeriodEnteredAt: game.sessionType === 'TRAINING' || player.isStarter ? now : null
      }));
      pushRotationEvent(game, game.sessionType === 'TRAINING' ? 'ACTIVITY_CHANGE' : 'PERIOD_START', 1, 0,
        { onCourtPlayerIds: game.selectedPlayers.filter((player) => game.sessionType === 'TRAINING' || player.isStarter).map((player) => player.playerId) }, now);
      rebuildGameCollections(game);
    });
  }

  pauseGame(updateGame: UpdateGame, gameId: number) {
    return updateGame(gameId, (game) => {
      ensureLiveState(game);
      if (game.status !== 'LIVE' || !game.isClockRunning) throw new Error('Seul un match en cours peut être mis en pause.');
      finalizeClockAndPlayers(game, new Date()); game.status = 'PAUSED';
    });
  }

  resumeGame(updateGame: UpdateGame, gameId: number) {
    return updateGame(gameId, (game) => {
      const labels = getTeamLabelSet(game.team.gender); ensureLiveState(game);
      if (game.status !== 'PAUSED' || game.isClockRunning) throw new Error('Seul un match en pause peut être repris.');
      if (effectivePeriodStatus(game) !== 'LIVE') throw new Error('La reprise est uniquement possible pour une période déjà démarrée et non achevée.');
      const onCourtPlayers = game.selectedPlayers.filter((player) => player.isOnCourt);
      if (game.sessionType !== 'TRAINING' && onCourtPlayers.length !== 5) throw new Error(`La reprise nécessite exactement cinq ${labels.playerPlural} actif·ves.`);
      const now = nowIso(); game.status = 'LIVE'; game.isClockRunning = true; game.lastClockStartedAt = now; game.lastPeriodStartedAt = now;
      game.selectedPlayers = game.selectedPlayers.map((player) => player.isOnCourt ? { ...player, lastEnteredAt: now, lastPeriodEnteredAt: now } : player);
      rebuildGameCollections(game);
    });
  }

  completePeriod(updateGame: UpdateGame, gameId: number) {
    return updateGame(gameId, (game) => {
      if (game.sessionType === 'TRAINING') throw new Error('Les périodes ne sont pas utilisées pendant un entraînement.'); ensureLiveState(game);
      if (game.status === 'DRAFT') throw new Error('Démarrez le match avant d’achever une période.');
      if (effectivePeriodStatus(game) !== 'LIVE') throw new Error('Seule une période démarrée peut être marquée comme achevée.');
      if (game.isClockRunning) finalizeClockAndPlayers(game, new Date());
      game.status = 'PAUSED'; game.currentPeriodStatus = 'COMPLETED'; game.isClockRunning = false; game.lastClockStartedAt = null; game.lastPeriodStartedAt = null;
      pushRotationEvent(game, 'PERIOD_END', game.currentPeriodNumber, game.periodElapsedSeconds, { onCourtPlayerIds: onCourtPlayerIds(game.selectedPlayers) }, nowIso());
    });
  }

  startNextPeriod(updateGame: UpdateGame, gameId: number) {
    return updateGame(gameId, (game) => {
      if (game.sessionType === 'TRAINING') throw new Error('Les périodes ne sont pas utilisées pendant un entraînement.');
      const labels = getTeamLabelSet(game.team.gender); ensureLiveState(game);
      if (game.status !== 'PAUSED') throw new Error('La période suivante peut uniquement démarrer depuis un match en pause.');
      if (game.currentPeriodStatus !== 'COMPLETED') throw new Error('Achevez la période en cours avant de démarrer la suivante.');
      const onCourtPlayers = game.selectedPlayers.filter((player) => player.isOnCourt);
      if (onCourtPlayers.length !== 5) throw new Error(`Le démarrage d’une nouvelle période nécessite exactement cinq ${labels.playerPlural} actif·ves.`);
      const now = nowIso(); game.status = 'LIVE'; game.currentPeriodNumber += 1; game.currentPeriodStatus = 'LIVE';
      game.isClockRunning = true; game.lastClockStartedAt = now; game.periodElapsedSeconds = 0; game.lastPeriodStartedAt = now;
      game.selectedPlayers = game.selectedPlayers.map((player) => ({ ...player, periodSeconds: 0, periodFouls: 0, lastEnteredAt: player.isOnCourt ? now : null, lastPeriodEnteredAt: player.isOnCourt ? now : null }));
      pushRotationEvent(game, 'PERIOD_START', game.currentPeriodNumber, 0, { onCourtPlayerIds: onCourtPlayers.map((player) => player.playerId) }, now);
      rebuildGameCollections(game);
    });
  }

  endGame(updateGame: UpdateGame, gameId: number) {
    return updateGame(gameId, (game) => {
      ensureLiveState(game); if (game.status === 'DRAFT') throw new Error('Démarrez le match avant de le terminer.');
      finalizeClockAndPlayers(game, new Date()); game.status = 'FINISHED';
      game.currentPeriodStatus = game.currentPeriodStatus === 'NOT_STARTED' ? 'NOT_STARTED' : 'COMPLETED';
      game.endedAt = nowIso(); game.isClockRunning = false; game.lastClockStartedAt = null; game.lastPeriodStartedAt = null;
      pushRotationEvent(game, 'GAME_END', game.currentPeriodNumber, game.periodElapsedSeconds, { onCourtPlayerIds: onCourtPlayerIds(game.selectedPlayers) }, game.endedAt);
    });
  }

  substitutePlayers(updateGame: UpdateGame, gameId: number, playerInIds: number[], playerOutIds: number[]) {
    return updateGame(gameId, (game) => {
      const labels = getTeamLabelSet(game.team.gender);
      if (!playerInIds.length && !playerOutIds.length) throw new Error('Sélectionnez au moins un changement à appliquer.');
      if (new Set(playerInIds).size !== playerInIds.length || new Set(playerOutIds).size !== playerOutIds.length) throw new Error(`Chaque ${labels.playerSingular} ne peut être sélectionné·e qu’une seule fois par série de remplacements.`);
      ensureTrackableLiveGame(game);
      const playerIns = playerInIds.map((id) => game.selectedPlayers.find((player) => player.playerId === id));
      const playerOuts = playerOutIds.map((id) => game.selectedPlayers.find((player) => player.playerId === id));
      if (playerIns.some((player) => !player) || playerOuts.some((player) => !player)) throw new Error(`Tous les remplacements doivent concerner des ${labels.playerPlural} de la feuille de match.`);
      if (playerIns.some((player) => player!.isOnCourt)) throw new Error(`Au moins un·e ${labels.incomingSingular} est déjà sur le terrain.`);
      if (playerIns.some((player) => player!.fouls >= 5)) throw new Error(`Un·e ${labels.incomingSingular} disqualifié·e pour cinq fautes ne peut plus entrer.`);
      if (playerOuts.some((player) => !player!.isOnCourt)) throw new Error(`Au moins un·e ${labels.outgoingSingular} n’est pas actuellement sur le terrain.`);
      const nextActiveCount = game.activePlayers.length - playerOutIds.length + playerInIds.length;
      if (game.sessionType !== 'TRAINING' && nextActiveCount !== 5) throw new Error(`Le changement doit laisser exactement cinq ${labels.playerPlural} sur le terrain.`);
      const now = nowIso(); const date = new Date(now); const inSet = new Set(playerInIds); const outSet = new Set(playerOutIds);
      const nextOnCourt = game.selectedPlayers.map((player) => outSet.has(player.playerId) ? null : inSet.has(player.playerId) ? player.playerId : player.isOnCourt ? player.playerId : null).filter((id): id is number => id !== null);
      game.selectedPlayers = game.selectedPlayers.map((player) => {
        if (outSet.has(player.playerId)) return { ...player, isOnCourt: false, totalSeconds: player.totalSeconds + (game.isClockRunning && player.lastEnteredAt ? diffSeconds(player.lastEnteredAt, date) : 0), periodSeconds: player.periodSeconds + (game.isClockRunning && player.lastPeriodEnteredAt ? diffSeconds(player.lastPeriodEnteredAt, date) : 0), lastEnteredAt: null, lastPeriodEnteredAt: null };
        if (inSet.has(player.playerId)) return { ...player, isOnCourt: true, lastEnteredAt: game.isClockRunning ? now : null, lastPeriodEnteredAt: game.isClockRunning && effectivePeriodStatus(game) === 'LIVE' ? now : null };
        return player;
      });
      pushRotationEvent(game, game.sessionType === 'TRAINING' ? 'ACTIVITY_CHANGE' : 'SUBSTITUTION', game.currentPeriodNumber, currentPeriodClockSeconds(game, date), { onCourtPlayerIds: nextOnCourt, playerInIds, playerOutIds }, now);
      rebuildGameCollections(game);
    });
  }

  recordPlayerPoints(updateGame: UpdateGame, gameId: number, playerId: number, points: number, correction = false) {
    return updateGame(gameId, (game) => {
      const labels = getTeamLabelSet(game.team.gender);
      if (!Number.isInteger(points) || points < 1 || points > 3) throw new Error('Seuls les ajouts de 1, 2 ou 3 points sont autorisés.');
      ensureTrackableLiveGame(game);
      const player = game.selectedPlayers.find((entry) => entry.playerId === playerId);
      if (!player) throw new Error(`${capitalize(labels.playerSingular)} introuvable pour ce match.`);
      if (!player.isOnCourt) throw new Error(`Seul·e un·e ${labels.playerSingular} actuellement sur le terrain peut recevoir des points.`);
      if (correction && player.points < points) throw new Error('Impossible de retirer plus de points que ceux déjà enregistrés.');
      player.points += correction ? -points : points; rebuildGameCollections(game);
    });
  }

  recordPlayerStat(updateGame: UpdateGame, gameId: number, playerId: number, stat: PlayerStatType, correction = false) {
    return updateGame(gameId, (game) => {
      const labels = getTeamLabelSet(game.team.gender); ensureTrackableLiveGame(game);
      const player = game.selectedPlayers.find((entry) => entry.playerId === playerId);
      if (!player) throw new Error(`${capitalize(labels.playerSingular)} introuvable pour ce match.`);
      if (stat !== 'fouls' && !player.isOnCourt) throw new Error(`Seul·e un·e ${labels.playerSingular} actuellement sur le terrain peut recevoir un ${statLabels[stat]}.`);
      if (correction && player[stat] < 1) throw new Error(`Impossible de retirer un ${statLabels[stat]} non enregistré.`);
      if (stat === 'fouls' && correction && player.periodFouls < 1) throw new Error('Impossible de retirer une faute d’équipe déjà remise à zéro pour une période précédente.');
      player[stat] += correction ? -1 : 1;
      if (stat === 'fouls') player.periodFouls += correction ? -1 : 1;
      if (stat === 'fouls' && !correction && player.fouls >= 5 && player.isOnCourt) {
        const now = new Date(); const timestamp = now.toISOString();
        player.totalSeconds += game.isClockRunning && player.lastEnteredAt ? diffSeconds(player.lastEnteredAt, now) : 0;
        player.periodSeconds += game.isClockRunning && player.lastPeriodEnteredAt ? diffSeconds(player.lastPeriodEnteredAt, now) : 0;
        player.isOnCourt = false; player.lastEnteredAt = null; player.lastPeriodEnteredAt = null;
        pushRotationEvent(game, 'SUBSTITUTION', game.currentPeriodNumber, currentPeriodClockSeconds(game, now), { onCourtPlayerIds: onCourtPlayerIds(game.selectedPlayers).filter((id) => id !== playerId), playerInIds: [], playerOutIds: [playerId] }, timestamp);
      }
      rebuildGameCollections(game);
    });
  }
}
