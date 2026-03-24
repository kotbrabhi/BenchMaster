import { Request, Response } from 'express';
import { getAuthenticatedUser } from '../auth/auth-request';
import * as teamService from '../services/team.service';

export async function listTeams(request: Request, response: Response) {
  response.json(await teamService.listTeams(getAuthenticatedUser(request).id));
}

export async function createTeam(request: Request, response: Response) {
  response.status(201).json(await teamService.createTeam(getAuthenticatedUser(request).id, request.body));
}

export async function updateTeam(request: Request, response: Response) {
  response.json(await teamService.updateTeam(getAuthenticatedUser(request).id, Number(request.params.teamId), request.body));
}

export async function deleteTeam(request: Request, response: Response) {
  await teamService.deleteTeam(getAuthenticatedUser(request).id, Number(request.params.teamId));
  response.status(204).send();
}
