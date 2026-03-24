import crypto from 'crypto';
import { HttpError } from '../utils/http-error';

interface TokenPayload {
  sub: number;
  email: string;
  name: string | null;
  exp: number;
}

const TOKEN_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7;
const DEFAULT_DEV_SECRET = 'benchmaster-dev-secret';

function getTokenSecret() {
  return process.env.AUTH_TOKEN_SECRET?.trim() || DEFAULT_DEV_SECRET;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string) {
  return crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('base64url');
}

export function issueAuthToken(user: { id: number; email: string; name: string | null }) {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    exp: Date.now() + TOKEN_LIFETIME_MS
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string) {
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    throw new HttpError(401, 'Jeton invalide.');
  }

  const expectedSignature = signPayload(encodedPayload);
  const expected = Buffer.from(expectedSignature, 'utf8');
  const received = Buffer.from(signature, 'utf8');

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new HttpError(401, 'Jeton invalide.');
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as TokenPayload;

  if (!payload.sub || !payload.email || payload.exp <= Date.now()) {
    throw new HttpError(401, 'Session expirée.');
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name
  };
}
