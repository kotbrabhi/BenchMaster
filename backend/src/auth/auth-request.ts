import { Request } from 'express';
import { HttpError } from '../utils/http-error';

export function getAuthenticatedUser(request: Request) {
  if (!request.authUser) {
    throw new HttpError(401, 'Authentification requise.');
  }

  return request.authUser;
}
