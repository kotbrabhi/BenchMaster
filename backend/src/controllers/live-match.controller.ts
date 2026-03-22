import { Request, Response } from 'express';
import * as liveMatchService from '../services/time-tracking.service';

function isCorrectionRequested(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export async function startGame(request: Request, response: Response) {
  response.json(await liveMatchService.startGame(Number(request.params.gameId)));
}

export async function pauseGame(request: Request, response: Response) {
  response.json(await liveMatchService.pauseGame(Number(request.params.gameId)));
}

export async function resumeGame(request: Request, response: Response) {
  response.json(await liveMatchService.resumeGame(Number(request.params.gameId)));
}

export async function completePeriod(request: Request, response: Response) {
  response.json(await liveMatchService.completePeriod(Number(request.params.gameId)));
}

export async function startNextPeriod(request: Request, response: Response) {
  response.json(await liveMatchService.startNextPeriod(Number(request.params.gameId)));
}

export async function substitutePlayers(request: Request, response: Response) {
  const playerInIds = Array.isArray(request.body.playerInIds)
    ? request.body.playerInIds.map(Number)
    : request.body.playerInId != null
      ? [Number(request.body.playerInId)]
      : [];
  const playerOutIds = Array.isArray(request.body.playerOutIds)
    ? request.body.playerOutIds.map(Number)
    : request.body.playerOutId != null
      ? [Number(request.body.playerOutId)]
      : [];

  response.json(
    await liveMatchService.substitutePlayers(
      Number(request.params.gameId),
      playerInIds,
      playerOutIds
    )
  );
}

export async function recordPlayerPoints(request: Request, response: Response) {
  response.json(
    await liveMatchService.recordPlayerPoints(
      Number(request.params.gameId),
      Number(request.params.playerId),
      Number(request.body.points),
      isCorrectionRequested(request.body.correction)
    )
  );
}

export async function recordPlayerStat(request: Request, response: Response) {
  response.json(
    await liveMatchService.recordPlayerStat(
      Number(request.params.gameId),
      Number(request.params.playerId),
      String(request.body.stat),
      isCorrectionRequested(request.body.correction)
    )
  );
}

export async function endGame(request: Request, response: Response) {
  response.json(await liveMatchService.endGame(Number(request.params.gameId)));
}
