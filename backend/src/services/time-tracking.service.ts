import { GameStatus, PeriodStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { serializeGame } from '../utils/game-serializer';
import { HttpError } from '../utils/http-error';
import { getTeamLabelSet } from '../utils/team-labels';

const gameInclude = {
  team: true,
  players: {
    include: {
      player: true,
      playingTime: true
    }
  }
} satisfies Prisma.GameInclude;

const trackableStats = {
  assists: 'passe décisive',
  blocks: 'contre',
  rebounds: 'rebond'
} as const;

type TrackableStat = keyof typeof trackableStats;

function diffSeconds(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
}

async function getGameForUpdate(transaction: Prisma.TransactionClient, gameId: number, userId: number) {
  const game = await transaction.game.findFirst({
    where: {
      id: gameId,
      team: {
        is: {
          userId
        }
      }
    },
    include: gameInclude
  });

  if (!game) {
    throw new HttpError(404, 'Match introuvable.');
  }

  return game;
}

type GameForUpdate = Awaited<ReturnType<typeof getGameForUpdate>>;
type GamePlayerForUpdate = GameForUpdate['players'][number];

function clonePlayerForUpdate(player: GamePlayerForUpdate): GamePlayerForUpdate {
  return {
    ...player,
    player: { ...player.player },
    playingTime: player.playingTime ? { ...player.playingTime } : null
  };
}

function cloneGameForUpdate(game: GameForUpdate): GameForUpdate {
  return {
    ...game,
    team: { ...game.team },
    players: game.players.map(clonePlayerForUpdate)
  };
}

function applyFinalizeClockAndPlayers(game: GameForUpdate, now: Date) {
  const updatedGame = cloneGameForUpdate(game);

  if (!updatedGame.isClockRunning || !updatedGame.lastClockStartedAt) {
    return updatedGame;
  }

  const elapsedSinceResume = diffSeconds(updatedGame.lastClockStartedAt, now);
  const periodElapsedSinceResume =
    getEffectivePeriodStatus(updatedGame) === PeriodStatus.LIVE && updatedGame.lastPeriodStartedAt
      ? diffSeconds(updatedGame.lastPeriodStartedAt, now)
      : 0;

  updatedGame.clockElapsedSeconds += elapsedSinceResume;
  updatedGame.periodElapsedSeconds += periodElapsedSinceResume;
  updatedGame.isClockRunning = false;
  updatedGame.lastClockStartedAt = null;
  updatedGame.lastPeriodStartedAt = null;
  updatedGame.players = updatedGame.players.map((player) => {
    if (!player.playingTime?.isOnCourt || !player.playingTime.lastEnteredAt) {
      return player;
    }

    return {
      ...player,
      playingTime: {
        ...player.playingTime,
        totalSeconds: player.playingTime.totalSeconds + diffSeconds(player.playingTime.lastEnteredAt, now),
        periodSeconds:
          player.playingTime.periodSeconds +
          (player.playingTime.lastPeriodEnteredAt ? diffSeconds(player.playingTime.lastPeriodEnteredAt, now) : 0),
        lastEnteredAt: null,
        lastPeriodEnteredAt: null
      }
    };
  });

  return updatedGame;
}

function ensureExactlyFiveStarters(game: Awaited<ReturnType<typeof getGameForUpdate>>) {
  const starters = game.players.filter((player) => player.isStarter);
  const labels = getTeamLabelSet(game.team.gender);

  if (game.players.length < 5 || starters.length !== 5) {
    throw new HttpError(400, `Un match en direct nécessite au moins cinq ${labels.playerPlural} sélectionné·es et exactement cinq titulaires.`);
  }
}

function ensureLiveState(game: Awaited<ReturnType<typeof getGameForUpdate>>) {
  if (game.status === GameStatus.FINISHED) {
    throw new HttpError(400, 'Ce match est déjà terminé.');
  }
}

function getEffectivePeriodStatus(game: Awaited<ReturnType<typeof getGameForUpdate>>) {
  if (game.currentPeriodStatus === PeriodStatus.NOT_STARTED && game.status !== GameStatus.DRAFT && game.startedAt) {
    return PeriodStatus.LIVE;
  }

  return game.currentPeriodStatus;
}

async function finalizeClockAndPlayers(
  transaction: Prisma.TransactionClient,
  game: Awaited<ReturnType<typeof getGameForUpdate>>,
  now: Date
) {
  if (!game.isClockRunning || !game.lastClockStartedAt) {
    return;
  }

  const elapsedSinceResume = diffSeconds(game.lastClockStartedAt, now);
  const periodElapsedSinceResume =
    getEffectivePeriodStatus(game) === PeriodStatus.LIVE && game.lastPeriodStartedAt
      ? diffSeconds(game.lastPeriodStartedAt, now)
      : 0;

  await transaction.game.update({
    where: { id: game.id },
    data: {
      clockElapsedSeconds: game.clockElapsedSeconds + elapsedSinceResume,
      periodElapsedSeconds: game.periodElapsedSeconds + periodElapsedSinceResume,
      isClockRunning: false,
      lastClockStartedAt: null,
      lastPeriodStartedAt: null
    }
  });

  await Promise.all(
    game.players
      .filter((player) => player.playingTime?.isOnCourt && player.playingTime.lastEnteredAt)
      .map((player) =>
        transaction.playerGameTime.update({
          where: {
            gamePlayerId: player.id
          },
          data: {
            totalSeconds:
              (player.playingTime?.totalSeconds ?? 0) +
              diffSeconds(player.playingTime!.lastEnteredAt!, now),
            periodSeconds:
              (player.playingTime?.periodSeconds ?? 0) +
              (player.playingTime?.lastPeriodEnteredAt
                ? diffSeconds(player.playingTime.lastPeriodEnteredAt, now)
                : 0),
            lastEnteredAt: null,
            lastPeriodEnteredAt: null
          }
        })
      )
  );
}

export async function startGame(gameId: number, userId: number) {
  return prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId, userId);
    ensureLiveState(game);
    ensureExactlyFiveStarters(game);

    if (game.status !== GameStatus.DRAFT) {
      throw new HttpError(400, 'Seuls les matchs en brouillon peuvent être démarrés.');
    }

    const now = new Date();

    await transaction.game.update({
      where: { id: game.id },
      data: {
        status: GameStatus.LIVE,
        currentPeriodNumber: 1,
        currentPeriodStatus: PeriodStatus.LIVE,
        startedAt: now,
        isClockRunning: true,
        lastClockStartedAt: now,
        periodElapsedSeconds: 0,
        lastPeriodStartedAt: now
      }
    });

    await Promise.all(
      game.players.map((player) =>
        transaction.playerGameTime.update({
          where: {
            gamePlayerId: player.id
          },
          data: {
            isOnCourt: player.isStarter,
            periodSeconds: 0,
            lastEnteredAt: player.isStarter ? now : null,
            lastPeriodEnteredAt: player.isStarter ? now : null
          }
        })
      )
    );

    const updatedGame = cloneGameForUpdate(game);
    updatedGame.status = GameStatus.LIVE;
    updatedGame.currentPeriodNumber = 1;
    updatedGame.currentPeriodStatus = PeriodStatus.LIVE;
    updatedGame.startedAt = now;
    updatedGame.isClockRunning = true;
    updatedGame.lastClockStartedAt = now;
    updatedGame.periodElapsedSeconds = 0;
    updatedGame.lastPeriodStartedAt = now;
    updatedGame.players = updatedGame.players.map((player) => {
      if (!player.playingTime) {
        return player;
      }

      return {
        ...player,
        playingTime: {
          ...player.playingTime,
          isOnCourt: player.isStarter,
          periodSeconds: 0,
          lastEnteredAt: player.isStarter ? now : null,
          lastPeriodEnteredAt: player.isStarter ? now : null
        }
      };
    });

    return serializeGame(updatedGame);
  });
}

export async function pauseGame(gameId: number, userId: number) {
  return prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId, userId);
    ensureLiveState(game);

    if (game.status !== GameStatus.LIVE || !game.isClockRunning) {
      throw new HttpError(400, 'Seul un match en cours peut être mis en pause.');
    }

    const now = new Date();
    await finalizeClockAndPlayers(transaction, game, now);

    await transaction.game.update({
      where: { id: game.id },
      data: {
        status: GameStatus.PAUSED
      }
    });

    const updatedGame = applyFinalizeClockAndPlayers(game, now);
    updatedGame.status = GameStatus.PAUSED;

    return serializeGame(updatedGame);
  });
}

export async function resumeGame(gameId: number, userId: number) {
  return prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId, userId);
    const labels = getTeamLabelSet(game.team.gender);
    ensureLiveState(game);

    if (game.status !== GameStatus.PAUSED || game.isClockRunning) {
      throw new HttpError(400, 'Seul un match en pause peut être repris.');
    }

    if (getEffectivePeriodStatus(game) !== PeriodStatus.LIVE) {
      throw new HttpError(400, 'La reprise est uniquement possible pour une période déjà démarrée et non achevée.');
    }

    const onCourtPlayers = game.players.filter((player) => player.playingTime?.isOnCourt);

    if (onCourtPlayers.length !== 5) {
      throw new HttpError(400, `La reprise nécessite exactement cinq ${labels.playerPlural} actif·ves.`);
    }

    const now = new Date();

    await transaction.game.update({
      where: { id: game.id },
      data: {
        status: GameStatus.LIVE,
        isClockRunning: true,
        lastClockStartedAt: now,
        lastPeriodStartedAt: now
      }
    });

    await Promise.all(
      onCourtPlayers.map((player) =>
        transaction.playerGameTime.update({
          where: {
            gamePlayerId: player.id
          },
          data: {
            lastEnteredAt: now,
            lastPeriodEnteredAt: now
          }
        })
      )
    );

    const updatedGame = cloneGameForUpdate(game);
    updatedGame.status = GameStatus.LIVE;
    updatedGame.isClockRunning = true;
    updatedGame.lastClockStartedAt = now;
    updatedGame.lastPeriodStartedAt = now;
    updatedGame.players = updatedGame.players.map((player) => {
      if (!player.playingTime?.isOnCourt || !onCourtPlayers.some((onCourtPlayer) => onCourtPlayer.id === player.id)) {
        return player;
      }

      return {
        ...player,
        playingTime: {
          ...player.playingTime,
          lastEnteredAt: now,
          lastPeriodEnteredAt: now
        }
      };
    });

    return serializeGame(updatedGame);
  });
}

function ensureUniqueIds(ids: number[], label: string) {
  if (new Set(ids).size !== ids.length) {
    throw new HttpError(400, `Chaque ${label} ne peut être sélectionné·e qu’une seule fois par série de remplacements.`);
  }
}

function ensureTrackableLiveGame(game: Awaited<ReturnType<typeof getGameForUpdate>>) {
  if (game.status !== GameStatus.LIVE && game.status !== GameStatus.PAUSED) {
    throw new HttpError(400, 'Cette action est uniquement possible pendant un match en direct ou en pause.');
  }
}

export async function substitutePlayers(gameId: number, userId: number, playerInIds: number[], playerOutIds: number[]) {
  return prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId, userId);
    const labels = getTeamLabelSet(game.team.gender);

    if (!playerInIds.length || !playerOutIds.length) {
      throw new HttpError(
        400,
        `Sélectionnez au moins ${labels.playerIndefiniteSingular} ${labels.incomingSingular} et ${labels.playerIndefiniteSingular} ${labels.outgoingSingular}.`
      );
    }

    if (playerInIds.length !== playerOutIds.length) {
      throw new HttpError(400, `Le nombre de ${labels.incomingPlural} doit correspondre au nombre de ${labels.outgoingPlural}.`);
    }

    ensureUniqueIds(playerInIds, `${labels.playerSingular} ${labels.incomingSingular}`);
    ensureUniqueIds(playerOutIds, `${labels.playerSingular} ${labels.outgoingSingular}`);

    ensureTrackableLiveGame(game);

    const playerIns = playerInIds.map((playerInId) => game.players.find((player) => player.playerId === playerInId));
    const playerOuts = playerOutIds.map((playerOutId) => game.players.find((player) => player.playerId === playerOutId));

    if (playerIns.some((player) => !player) || playerOuts.some((player) => !player)) {
      throw new HttpError(400, `Tous les remplacements doivent concerner des ${labels.playerPlural} de la feuille de match.`);
    }

    if (playerIns.some((player) => player!.playingTime?.isOnCourt)) {
      throw new HttpError(400, `Au moins un·e ${labels.incomingSingular} est déjà sur le terrain.`);
    }

    if (playerOuts.some((player) => !player!.playingTime?.isOnCourt)) {
      throw new HttpError(400, `Au moins un·e ${labels.outgoingSingular} n’est pas actuellement sur le terrain.`);
    }

    const activeCount = game.players.filter((player) => player.playingTime?.isOnCourt).length;

    if (activeCount !== 5) {
      throw new HttpError(400, `Un match en direct doit conserver exactement cinq ${labels.playerPlural} actif·ves.`);
    }

    const now = new Date();

    await Promise.all(
      playerOuts.map((playerOut) =>
        transaction.playerGameTime.update({
          where: {
            gamePlayerId: playerOut!.id
          },
          data: {
            isOnCourt: false,
            totalSeconds:
              (playerOut!.playingTime?.totalSeconds ?? 0) +
              (game.isClockRunning && playerOut!.playingTime?.lastEnteredAt
                ? diffSeconds(playerOut!.playingTime.lastEnteredAt, now)
                : 0),
            periodSeconds:
              (playerOut!.playingTime?.periodSeconds ?? 0) +
              (game.isClockRunning && playerOut!.playingTime?.lastPeriodEnteredAt
                ? diffSeconds(playerOut!.playingTime.lastPeriodEnteredAt, now)
                : 0),
            lastEnteredAt: null,
            lastPeriodEnteredAt: null
          }
        })
      )
    );

    await Promise.all(
      playerIns.map((playerIn) =>
        transaction.playerGameTime.update({
          where: {
            gamePlayerId: playerIn!.id
          },
          data: {
            isOnCourt: true,
            lastEnteredAt: game.isClockRunning ? now : null,
            lastPeriodEnteredAt:
              game.isClockRunning && getEffectivePeriodStatus(game) === PeriodStatus.LIVE ? now : null
          }
        })
      )
    );

    // TODO(axis-2): Create stat segments tied to substitutions so future points, rebounds, and advanced efficiency splits can be calculated.

    const playerInIdSet = new Set(playerInIds);
    const playerOutIdSet = new Set(playerOutIds);
    const updatedGame = cloneGameForUpdate(game);
    updatedGame.players = updatedGame.players.map((player) => {
      if (!player.playingTime) {
        return player;
      }

      if (playerOutIdSet.has(player.playerId)) {
        return {
          ...player,
          playingTime: {
            ...player.playingTime,
            isOnCourt: false,
            totalSeconds:
              player.playingTime.totalSeconds +
              (game.isClockRunning && player.playingTime.lastEnteredAt
                ? diffSeconds(player.playingTime.lastEnteredAt, now)
                : 0),
            periodSeconds:
              player.playingTime.periodSeconds +
              (game.isClockRunning && player.playingTime.lastPeriodEnteredAt
                ? diffSeconds(player.playingTime.lastPeriodEnteredAt, now)
                : 0),
            lastEnteredAt: null,
            lastPeriodEnteredAt: null
          }
        };
      }

      if (playerInIdSet.has(player.playerId)) {
        return {
          ...player,
          playingTime: {
            ...player.playingTime,
            isOnCourt: true,
            lastEnteredAt: game.isClockRunning ? now : null,
            lastPeriodEnteredAt:
              game.isClockRunning && getEffectivePeriodStatus(game) === PeriodStatus.LIVE ? now : null
          }
        };
      }

      return player;
    });

    return serializeGame(updatedGame);
  });
}

export async function recordPlayerPoints(gameId: number, userId: number, playerId: number, points: number, correction = false) {
  if (!Number.isInteger(points) || points < 1 || points > 3) {
    throw new HttpError(400, 'Seuls les ajouts de 1, 2 ou 3 points sont autorisés.');
  }

  return prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId, userId);
    const labels = getTeamLabelSet(game.team.gender);
    ensureTrackableLiveGame(game);

    const player = game.players.find((entry) => entry.playerId === playerId);

    if (!player) {
      throw new HttpError(404, `${labels.playerSingular.charAt(0).toUpperCase()}${labels.playerSingular.slice(1)} introuvable pour ce match.`);
    }

    if (!player.playingTime?.isOnCourt) {
      throw new HttpError(400, `Seul·e ${labels.playerIndefiniteSingular} actuellement sur le terrain peut recevoir des points.`);
    }

    if (correction && (player.playingTime.points ?? 0) < points) {
      throw new HttpError(400, 'Impossible de retirer plus de points que ceux déjà enregistrés.');
    }

    await transaction.playerGameTime.update({
      where: {
        gamePlayerId: player.id
      },
      data: {
        points: {
          [correction ? 'decrement' : 'increment']: points
        }
      }
    });

    const updatedGame = cloneGameForUpdate(game);
    updatedGame.players = updatedGame.players.map((entry) => {
      if (entry.playerId !== playerId || !entry.playingTime) {
        return entry;
      }

      return {
        ...entry,
        playingTime: {
          ...entry.playingTime,
          points: entry.playingTime.points + (correction ? -points : points)
        }
      };
    });

    return serializeGame(updatedGame);
  });
}

export async function recordPlayerStat(gameId: number, userId: number, playerId: number, stat: string, correction = false) {
  if (!(stat in trackableStats)) {
    throw new HttpError(400, 'Statistique non prise en charge.');
  }

  const trackableStat = stat as TrackableStat;

  return prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId, userId);
    const labels = getTeamLabelSet(game.team.gender);
    ensureTrackableLiveGame(game);

    const player = game.players.find((entry) => entry.playerId === playerId);

    if (!player) {
      throw new HttpError(404, `${labels.playerSingular.charAt(0).toUpperCase()}${labels.playerSingular.slice(1)} introuvable pour ce match.`);
    }

    if (!player.playingTime?.isOnCourt) {
      throw new HttpError(
        400,
        `Seul·e ${labels.playerIndefiniteSingular} actuellement sur le terrain peut recevoir un ${trackableStats[trackableStat]}.`
      );
    }

    if (correction && (player.playingTime?.[trackableStat] ?? 0) < 1) {
      throw new HttpError(400, `Impossible de retirer un ${trackableStats[trackableStat]} non enregistré.`);
    }

    await transaction.playerGameTime.update({
      where: {
        gamePlayerId: player.id
      },
      data: {
        [trackableStat]: {
          [correction ? 'decrement' : 'increment']: 1
        }
      }
    });

    const updatedGame = cloneGameForUpdate(game);
    updatedGame.players = updatedGame.players.map((entry) => {
      if (entry.playerId !== playerId || !entry.playingTime) {
        return entry;
      }

      return {
        ...entry,
        playingTime: {
          ...entry.playingTime,
          [trackableStat]: entry.playingTime[trackableStat] + (correction ? -1 : 1)
        }
      };
    });

    return serializeGame(updatedGame);
  });
}

export async function completePeriod(gameId: number, userId: number) {
  return prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId, userId);
    ensureLiveState(game);

    if (game.status === GameStatus.DRAFT) {
      throw new HttpError(400, 'Démarrez le match avant d’achever une période.');
    }

    if (getEffectivePeriodStatus(game) !== PeriodStatus.LIVE) {
      throw new HttpError(400, 'Seule une période démarrée peut être marquée comme achevée.');
    }

    const now = new Date();

    if (game.isClockRunning) {
      await finalizeClockAndPlayers(transaction, game, now);
    }

    await transaction.game.update({
      where: { id: game.id },
      data: {
        status: GameStatus.PAUSED,
        currentPeriodStatus: PeriodStatus.COMPLETED,
        isClockRunning: false,
        lastClockStartedAt: null,
        lastPeriodStartedAt: null
      }
    });

    const updatedGame = game.isClockRunning ? applyFinalizeClockAndPlayers(game, now) : cloneGameForUpdate(game);
    updatedGame.status = GameStatus.PAUSED;
    updatedGame.currentPeriodStatus = PeriodStatus.COMPLETED;
    updatedGame.isClockRunning = false;
    updatedGame.lastClockStartedAt = null;
    updatedGame.lastPeriodStartedAt = null;

    return serializeGame(updatedGame);
  });
}

export async function startNextPeriod(gameId: number, userId: number) {
  return prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId, userId);
    const labels = getTeamLabelSet(game.team.gender);
    ensureLiveState(game);

    if (game.status !== GameStatus.PAUSED) {
      throw new HttpError(400, 'La période suivante peut uniquement démarrer depuis un match en pause.');
    }

    if (game.currentPeriodStatus !== PeriodStatus.COMPLETED) {
      throw new HttpError(400, 'Achevez la période en cours avant de démarrer la suivante.');
    }

    const onCourtPlayers = game.players.filter((player) => player.playingTime?.isOnCourt);

    if (onCourtPlayers.length !== 5) {
      throw new HttpError(400, `Le démarrage d’une nouvelle période nécessite exactement cinq ${labels.playerPlural} actif·ves.`);
    }

    const now = new Date();

    await transaction.game.update({
      where: { id: game.id },
      data: {
        status: GameStatus.LIVE,
        currentPeriodNumber: game.currentPeriodNumber + 1,
        currentPeriodStatus: PeriodStatus.LIVE,
        isClockRunning: true,
        lastClockStartedAt: now,
        periodElapsedSeconds: 0,
        lastPeriodStartedAt: now
      }
    });

    await Promise.all(
      game.players.map((player) =>
        transaction.playerGameTime.update({
          where: {
            gamePlayerId: player.id
          },
          data: {
            periodSeconds: 0,
            lastEnteredAt: player.playingTime?.isOnCourt ? now : null,
            lastPeriodEnteredAt: player.playingTime?.isOnCourt ? now : null
          }
        })
      )
    );

    const updatedGame = cloneGameForUpdate(game);
    updatedGame.status = GameStatus.LIVE;
    updatedGame.currentPeriodNumber = game.currentPeriodNumber + 1;
    updatedGame.currentPeriodStatus = PeriodStatus.LIVE;
    updatedGame.isClockRunning = true;
    updatedGame.lastClockStartedAt = now;
    updatedGame.periodElapsedSeconds = 0;
    updatedGame.lastPeriodStartedAt = now;
    updatedGame.players = updatedGame.players.map((player) => {
      if (!player.playingTime) {
        return player;
      }

      return {
        ...player,
        playingTime: {
          ...player.playingTime,
          periodSeconds: 0,
          lastEnteredAt: player.playingTime.isOnCourt ? now : null,
          lastPeriodEnteredAt: player.playingTime.isOnCourt ? now : null
        }
      };
    });

    return serializeGame(updatedGame);
  });
}

export async function endGame(gameId: number, userId: number) {
  return prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId, userId);
    ensureLiveState(game);

    if (game.status === GameStatus.DRAFT) {
      throw new HttpError(400, 'Démarrez le match avant de le terminer.');
    }

    const now = new Date();
    await finalizeClockAndPlayers(transaction, game, now);

    await transaction.game.update({
      where: { id: game.id },
      data: {
        status: GameStatus.FINISHED,
        currentPeriodStatus:
          game.currentPeriodStatus === PeriodStatus.NOT_STARTED ? PeriodStatus.NOT_STARTED : PeriodStatus.COMPLETED,
        endedAt: now,
        isClockRunning: false,
        lastClockStartedAt: null,
        lastPeriodStartedAt: null
      }
    });

    const updatedGame = applyFinalizeClockAndPlayers(game, now);
    updatedGame.status = GameStatus.FINISHED;
    updatedGame.currentPeriodStatus =
      game.currentPeriodStatus === PeriodStatus.NOT_STARTED ? PeriodStatus.NOT_STARTED : PeriodStatus.COMPLETED;
    updatedGame.endedAt = now;
    updatedGame.isClockRunning = false;
    updatedGame.lastClockStartedAt = null;
    updatedGame.lastPeriodStartedAt = null;

    return serializeGame(updatedGame);
  });
}
