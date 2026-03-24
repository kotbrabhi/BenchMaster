import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error';
import { getUserById } from './auth.service';
import { verifyAuthToken } from './token';

function extractBearerToken(request: Request) {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim();
}

export async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(request);

    if (!token) {
      throw new HttpError(401, 'Authentification requise.');
    }

    const tokenUser = verifyAuthToken(token);
    request.authUser = await getUserById(tokenUser.id);
    next();
  } catch (error) {
    next(error);
  }
}
