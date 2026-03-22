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
  app.use(express.json());

  app.get('/healthz', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api', routes);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }

    console.error(error);
    response.status(500).json({ message: 'Erreur serveur inattendue.' });
  });

  return app;
}
