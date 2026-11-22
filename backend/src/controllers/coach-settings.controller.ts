import { Request, Response } from 'express';
import { getAuthenticatedUser } from '../auth/auth-request';
import * as coachSettingsService from '../services/coach-settings.service';

export async function get(request: Request, response: Response) {
  response.json(await coachSettingsService.getCoachSettings(getAuthenticatedUser(request).id));
}

export async function save(request: Request, response: Response) {
  response.json(await coachSettingsService.saveCoachSettings(getAuthenticatedUser(request).id, request.body));
}
