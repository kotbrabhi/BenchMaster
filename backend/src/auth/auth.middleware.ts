import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error';
import { getUserById } from './auth.service';
import { verifyAuthToken } from './token';

const SESSION_COOKIE = 'benchmaster_session';

export async function requireAuth(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[SESSION_COOKIE];

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
