import { Request, Response } from 'express';
import * as authService from '../auth/auth.service';
import { HttpError } from '../utils/http-error';

function ensureAuthenticatedUser(request: Request) {
  if (!request.authUser) {
    throw new HttpError(401, 'Authentification requise.');
  }

  return request.authUser;
}

export async function register(request: Request, response: Response) {
  response.status(201).json(await authService.register(request.body));
}

export async function login(request: Request, response: Response) {
  response.json(await authService.login(request.body));
}

export async function me(request: Request, response: Response) {
  response.json({ user: ensureAuthenticatedUser(request) });
}
