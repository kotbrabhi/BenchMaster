import { Request, Response } from 'express';
import { getAuthenticatedUser } from '../auth/auth-request';
import * as playerService from '../services/player.service';

export async function listPlayers(request: Request, response: Response) {
  response.json(await playerService.listPlayers(Number(request.params.teamId), getAuthenticatedUser(request).id));
}

export async function createPlayer(request: Request, response: Response) {
  response
    .status(201)
    .json(await playerService.createPlayer(Number(request.params.teamId), getAuthenticatedUser(request).id, request.body));
}

export async function updatePlayer(request: Request, response: Response) {
  response.json(await playerService.updatePlayer(Number(request.params.playerId), getAuthenticatedUser(request).id, request.body));
}

export async function deletePlayer(request: Request, response: Response) {
  await playerService.deletePlayer(Number(request.params.playerId), getAuthenticatedUser(request).id);
  response.status(204).send();
}
