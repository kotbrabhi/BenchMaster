import { GameStatus, PeriodStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { serializeGame } from '../utils/game-serializer';
import { HttpError } from '../utils/http-error';

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

async function getGameForUpdate(transaction: Prisma.TransactionClient, gameId: number) {
  const game = await transaction.game.findUnique({
    where: { id: gameId },
    include: gameInclude
  });

  if (!game) {
    throw new HttpError(404, 'Match introuvable.');
  }

  return game;
}

function ensureExactlyFiveStarters(game: Awaited<ReturnType<typeof getGameForUpdate>>) {
  const starters = game.players.filter((player) => player.isStarter);

  if (game.players.length < 5 || starters.length !== 5) {
    throw new HttpError(400, 'Un match en direct nécessite au moins cinq joueur·euses sélectionné·es et exactement cinq titulaires.');
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

export async function startGame(gameId: number) {
  const result = await prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId);
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

    return getGameForUpdate(transaction, game.id);
  });

  return serializeGame(result);
}

export async function pauseGame(gameId: number) {
  const result = await prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId);
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

    return getGameForUpdate(transaction, game.id);
  });

  return serializeGame(result);
}

export async function resumeGame(gameId: number) {
  const result = await prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId);
    ensureLiveState(game);

    if (game.status !== GameStatus.PAUSED || game.isClockRunning) {
      throw new HttpError(400, 'Seul un match en pause peut être repris.');
    }

    if (getEffectivePeriodStatus(game) !== PeriodStatus.LIVE) {
      throw new HttpError(400, 'La reprise est uniquement possible pour une période déjà démarrée et non achevée.');
    }

    const onCourtPlayers = game.players.filter((player) => player.playingTime?.isOnCourt);

    if (onCourtPlayers.length !== 5) {
      throw new HttpError(400, 'La reprise nécessite exactement cinq joueur·euses actif·ves.');
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

    return getGameForUpdate(transaction, game.id);
  });

  return serializeGame(result);
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

export async function substitutePlayers(gameId: number, playerInIds: number[], playerOutIds: number[]) {
  if (!playerInIds.length || !playerOutIds.length) {
    throw new HttpError(400, 'Sélectionnez au moins un·e joueur·euse entrant·e et un·e joueur·euse sortant·e.');
  }

  if (playerInIds.length !== playerOutIds.length) {
    throw new HttpError(400, 'Le nombre de joueur·euses entrant·es doit correspondre au nombre de joueur·euses sortant·es.');
  }

  ensureUniqueIds(playerInIds, 'joueur·euse entrant·e');
  ensureUniqueIds(playerOutIds, 'joueur·euse sortant·e');

  const result = await prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId);

    ensureTrackableLiveGame(game);

    const playerIns = playerInIds.map((playerInId) => game.players.find((player) => player.playerId === playerInId));
    const playerOuts = playerOutIds.map((playerOutId) => game.players.find((player) => player.playerId === playerOutId));

    if (playerIns.some((player) => !player) || playerOuts.some((player) => !player)) {
      throw new HttpError(400, 'Tous les remplacements doivent concerner des joueur·euses de la feuille de match.');
    }

    if (playerIns.some((player) => player!.playingTime?.isOnCourt)) {
      throw new HttpError(400, 'Au moins un·e joueur·euse entrant·e est déjà sur le terrain.');
    }

    if (playerOuts.some((player) => !player!.playingTime?.isOnCourt)) {
      throw new HttpError(400, 'Au moins un·e joueur·euse sortant·e n’est pas actuellement sur le terrain.');
    }

    const activeCount = game.players.filter((player) => player.playingTime?.isOnCourt).length;

    if (activeCount !== 5) {
      throw new HttpError(400, 'Un match en direct doit conserver exactement cinq joueur·euses actif·ves.');
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

    return getGameForUpdate(transaction, game.id);
  });

  return serializeGame(result);
}

export async function recordPlayerPoints(gameId: number, playerId: number, points: number, correction = false) {
  if (!Number.isInteger(points) || points < 1 || points > 3) {
    throw new HttpError(400, 'Seuls les ajouts de 1, 2 ou 3 points sont autorisés.');
  }

  const result = await prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId);
    ensureTrackableLiveGame(game);

    const player = game.players.find((entry) => entry.playerId === playerId);

    if (!player) {
      throw new HttpError(404, 'Joueur·euse introuvable pour ce match.');
    }

    if (!player.playingTime?.isOnCourt) {
      throw new HttpError(400, 'Seul·e un·e joueur·euse actuellement sur le terrain peut recevoir des points.');
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

    return getGameForUpdate(transaction, game.id);
  });

  return serializeGame(result);
}

export async function recordPlayerStat(gameId: number, playerId: number, stat: string, correction = false) {
  if (!(stat in trackableStats)) {
    throw new HttpError(400, 'Statistique non prise en charge.');
  }

  const trackableStat = stat as TrackableStat;

  const result = await prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId);
    ensureTrackableLiveGame(game);

    const player = game.players.find((entry) => entry.playerId === playerId);

    if (!player) {
      throw new HttpError(404, 'Joueur·euse introuvable pour ce match.');
    }

    if (!player.playingTime?.isOnCourt) {
      throw new HttpError(
        400,
        `Seul·e un·e joueur·euse actuellement sur le terrain peut recevoir un ${trackableStats[trackableStat]}.`
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

    return getGameForUpdate(transaction, game.id);
  });

  return serializeGame(result);
}

export async function completePeriod(gameId: number) {
  const result = await prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId);
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

    return getGameForUpdate(transaction, game.id);
  });

  return serializeGame(result);
}

export async function startNextPeriod(gameId: number) {
  const result = await prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId);
    ensureLiveState(game);

    if (game.status !== GameStatus.PAUSED) {
      throw new HttpError(400, 'La période suivante peut uniquement démarrer depuis un match en pause.');
    }

    if (game.currentPeriodStatus !== PeriodStatus.COMPLETED) {
      throw new HttpError(400, 'Achevez la période en cours avant de démarrer la suivante.');
    }

    const onCourtPlayers = game.players.filter((player) => player.playingTime?.isOnCourt);

    if (onCourtPlayers.length !== 5) {
      throw new HttpError(400, 'Le démarrage d’une nouvelle période nécessite exactement cinq joueur·euses actif·ves.');
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

    return getGameForUpdate(transaction, game.id);
  });

  return serializeGame(result);
}

export async function endGame(gameId: number) {
  const result = await prisma.$transaction(async (transaction) => {
    const game = await getGameForUpdate(transaction, gameId);
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

    return getGameForUpdate(transaction, game.id);
  });

  return serializeGame(result);
}
