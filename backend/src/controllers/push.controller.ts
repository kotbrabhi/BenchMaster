import { Request, Response } from 'express';
import { getAuthenticatedUser } from '../auth/auth-request';
import { getPushPublicKey, removePushSubscription, savePushSubscription } from '../services/push-notification.service';

export async function publicKey(_request: Request, response: Response) {
  response.json(getPushPublicKey());
}

export async function subscribe(request: Request, response: Response) {
  response.json(await savePushSubscription(getAuthenticatedUser(request).id, request.body));
}

export async function unsubscribe(request: Request, response: Response) {
  response.json(await removePushSubscription(getAuthenticatedUser(request).id, request.body?.endpoint));
}
