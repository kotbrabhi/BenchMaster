import { Request, Response } from 'express';
import * as teamService from '../services/team.service';

export async function listTeams(_request: Request, response: Response) {
  response.json(await teamService.listTeams());
}

export async function createTeam(request: Request, response: Response) {
  response.status(201).json(await teamService.createTeam(request.body));
}

export async function updateTeam(request: Request, response: Response) {
  response.json(await teamService.updateTeam(Number(request.params.teamId), request.body));
}

export async function deleteTeam(request: Request, response: Response) {
  await teamService.deleteTeam(Number(request.params.teamId));
  response.status(204).send();
}

