import express from 'express';
import cors from 'cors';
import { config } from './config';
import './db';
import reposRouter from './routes/repos';
import aiRouter from './routes/ai';
import annotationsRouter from './routes/annotations';
import miscRouter from './routes/misc';

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiConfigured: !!config.anthropicApiKey,
      model: config.anthropicModel,
    });
  });

  app.use('/api/repos', reposRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/annotations', annotationsRouter);
  app.use('/api', miscRouter);

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('[error]', err);
      if (res.headersSent) return;
      res.status(500).json({ error: 'internal error', detail: String(err?.message || err) });
    }
  );

  return app;
}
