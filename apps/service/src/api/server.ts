import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { configSchema, repoQuerySchema, type Config } from '@ratlas/core';
import { dataset, openReader, repositories, summary, type Db } from '@ratlas/db';
import { projectRoot } from '../commands/config.js';

export async function createApi(
  config: Config,
  options: { production?: boolean; logger?: boolean } = {},
) {
  configSchema.parse(config);
  const staticRoot = resolve(projectRoot, 'apps/web/dist');
  if (options.production && !existsSync(resolve(staticRoot, 'index.html')))
    throw new Error('Build the ratlas frontend before production startup');
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 16384, trustProxy: false });
  let db: Db;
  try {
    db = openReader(config.storage.databasePath);
  } catch (cause) {
    throw new Error('Application database is not ready; run preparation or migration', { cause });
  }
  if (dataset(db).kind !== config.mode) {
    db.close();
    throw new Error('Database mode differs from configuration');
  }
  app.addHook('onClose', async () => {
    db.close();
  });
  app.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host?.split(':')[0];
    if (!host || !config.server.allowedHostnames.includes(host))
      return reply.code(400).send({ error: 'Invalid host', requestId: request.id });
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, { max: 120, timeWindow: 60000 });
  app.setErrorHandler((error, request, reply) => {
    const status = (error as { statusCode?: number }).statusCode;
    request.log.error({ requestId: request.id }, 'ratlas request failed');
    reply
      .code(status && status >= 400 && status < 500 ? status : 500)
      .send({ error: 'Request failed', requestId: request.id });
  });
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/readyz', async () => {
    db.prepare('SELECT schema_version FROM dataset_meta WHERE id=1').get();
    return { status: 'ready' };
  });
  app.get('/api/v1/summary', async (request, reply) => {
    if (Object.keys(request.query as object).length)
      return reply.code(400).send({ error: 'Unsupported query', requestId: request.id });
    const result = summary(db, config.presentation.observationWindow);
    const etag =
      'W/"' +
      createHash('sha256')
        .update(
          JSON.stringify([
            result.mode,
            result.datasetRevision,
            result.observationWindow,
            Math.floor(Date.parse(result.referenceTime) / 15000),
          ]),
        )
        .digest('hex') +
      '"';
    reply.header('Cache-Control', 'private, max-age=0, must-revalidate').header('ETag', etag);
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    return result;
  });
  app.get('/api/v1/repos', async (request, reply) => {
    const parsed = repoQuerySchema.safeParse(request.query);
    if (!parsed.success)
      return reply.code(400).send({ error: 'Invalid pagination', requestId: request.id });
    const { page, limit } = parsed.data;
    reply.header('Cache-Control', 'private, max-age=0, must-revalidate');
    return repositories(db, config.presentation.observationWindow, page, limit);
  });
  if (options.production) {
    await app.register(staticFiles, { root: staticRoot });
    app.setNotFoundHandler((request, reply) => {
      if (request.method !== 'GET' || request.url.startsWith('/api/'))
        return reply.code(404).send({ error: 'Not found', requestId: request.id });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
