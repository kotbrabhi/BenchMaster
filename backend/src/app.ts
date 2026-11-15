import cors from 'cors';
import express from 'express';
import routes from './routes';
import { HttpError } from './utils/http-error';

function getAllowedOrigins() {
  const configuredOrigins = process.env.FRONTEND_ORIGIN
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins?.length ? configuredOrigins : ['http://localhost:4200', 'http://127.0.0.1:4200'];
}

export function createApp() {
  const app = express();
  // Render terminates TLS and forwards one proxy hop. Trust only that hop so
  // req.ip uses the client address without accepting arbitrary forwarded headers.
  app.set('trust proxy', 1);
  const allowedOrigins = new Set(getAllowedOrigins());

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new HttpError(403, 'Origine non autorisee.'));
      }
    })
  );
  app.use('/api/public/game-shares', express.json({ limit: '32kb' }));
  app.use('/api/auth/register', express.json({ limit: '4kb' }));
  app.use('/api/auth/login', express.json({ limit: '4kb' }));
  app.use('/api/public/friendly-match-invites', express.json({ limit: '4kb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use((request, _response, next) => {
    const rawCookie = request.headers.cookie ?? '';
    const cookies: Record<string, string> = {};
    for (const part of rawCookie.split(';')) {
      const separator = part.indexOf('=');
      if (separator > 0) {
        const name = part.slice(0, separator).trim();
        try { cookies[name] = decodeURIComponent(part.slice(separator + 1).trim()); } catch { /* Ignore malformed cookies. */ }
      }
    }
    request.cookies = cookies;
    next();
  });

  app.use((request, _response, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.get('origin');
      const referer = request.get('referer');
      let refererOrigin: string | undefined;
      try { refererOrigin = referer ? new URL(referer).origin : undefined; } catch { /* Invalid referrer is rejected below. */ }
      const requestOrigin = origin ?? refererOrigin;
      if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
        next(new HttpError(403, 'Origine non autorisee.'));
        return;
      }
    }
    next();
  });

  app.get('/healthz', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api', routes);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }

    if (error && typeof error === 'object' && 'status' in error && (error.status === 400 || error.status === 413)) {
      response.status(error.status).json({ message: error.status === 413 ? 'La requête est trop volumineuse.' : 'La requête est invalide.' });
      return;
    }

    console.error(error);
    response.status(500).json({ message: 'Erreur serveur inattendue.' });
  });

  return app;
}
