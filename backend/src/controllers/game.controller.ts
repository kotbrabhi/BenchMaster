import { Request, Response } from 'express';
import { getAuthenticatedUser } from '../auth/auth-request';
import * as gameService from '../services/game.service';

function buildAbsoluteUrl(request: Request, path: string) {
  const protocol = request.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.protocol;
  return `${protocol}://${request.get('host')}${path}`;
}

export async function listGames(request: Request, response: Response) {
  const teamId = request.query.teamId ? Number(request.query.teamId) : undefined;
  response.json(await gameService.listGames(getAuthenticatedUser(request).id, teamId));
}

export async function createGame(request: Request, response: Response) {
  response.status(201).json(await gameService.createGame(getAuthenticatedUser(request).id, request.body));
}

export async function getGame(request: Request, response: Response) {
  response.json(await gameService.getGame(Number(request.params.gameId), getAuthenticatedUser(request).id));
}

export async function getGamePlayers(request: Request, response: Response) {
  response.json(await gameService.getGamePlayers(Number(request.params.gameId), getAuthenticatedUser(request).id));
}

export async function getGameSummary(request: Request, response: Response) {
  response.json(await gameService.getGameSummary(Number(request.params.gameId), getAuthenticatedUser(request).id));
}

export async function createShare(request: Request, response: Response) {
  const share = await gameService.createGameShare(Number(request.params.gameId), getAuthenticatedUser(request).id);
  response.json({
    ...share,
    url: buildAbsoluteUrl(request, share.path)
  });
}

export async function getPublicSharedSummary(request: Request, response: Response) {
  const shareId = Array.isArray(request.params.shareId) ? request.params.shareId[0] : request.params.shareId;
  response.json(await gameService.getPublicSharedSummary(shareId));
}
