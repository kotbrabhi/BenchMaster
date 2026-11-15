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
  const session = await authService.register(request.body);
  response.cookie('benchmaster_session', session.token, sessionCookieOptions());
  response.status(201).json({ user: session.user });
}

export async function login(request: Request, response: Response) {
  const session = await authService.login(request.body);
  response.cookie('benchmaster_session', session.token, sessionCookieOptions());
  response.json({ user: session.user });
}

export async function me(request: Request, response: Response) {
  response.json({ user: ensureAuthenticatedUser(request) });
}

export function logout(_request: Request, response: Response) {
  response.clearCookie('benchmaster_session', sessionCookieOptions());
  response.status(204).end();
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api'
  };
}
