import { Request, Response } from 'express';
import * as playerService from '../services/player.service';

export async function listPlayers(request: Request, response: Response) {
  response.json(await playerService.listPlayers(Number(request.params.teamId)));
}

export async function createPlayer(request: Request, response: Response) {
  response.status(201).json(await playerService.createPlayer(Number(request.params.teamId), request.body));
}

export async function updatePlayer(request: Request, response: Response) {
  response.json(await playerService.updatePlayer(Number(request.params.playerId), request.body));
}

export async function deletePlayer(request: Request, response: Response) {
  await playerService.deletePlayer(Number(request.params.playerId));
  response.status(204).send();
}

