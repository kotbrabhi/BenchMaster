import { Request, Response } from 'express';
import * as gameService from '../services/game.service';

export async function listGames(request: Request, response: Response) {
  const teamId = request.query.teamId ? Number(request.query.teamId) : undefined;
  response.json(await gameService.listGames(teamId));
}

export async function createGame(request: Request, response: Response) {
  response.status(201).json(await gameService.createGame(request.body));
}

export async function getGame(request: Request, response: Response) {
  response.json(await gameService.getGame(Number(request.params.gameId)));
}

export async function getGamePlayers(request: Request, response: Response) {
  response.json(await gameService.getGamePlayers(Number(request.params.gameId)));
}

export async function getGameSummary(request: Request, response: Response) {
  response.json(await gameService.getGameSummary(Number(request.params.gameId)));
}

