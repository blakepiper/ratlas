import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  z,
  catalogQuerySchema,
  filtersSchema,
  graphQuerySchema,
  timeQuerySchema,
  emptyQuerySchema,
  fullSummarySchema,
  catalogSchema,
  repoDetailSchema,
  seedersSchema,
  nodesSchema,
  nodeDetailSchema,
  nodeReposSchema,
  activitySchema,
  historySchema,
  sourcesSchema,
  randomRepoSchema,
  ridSchema,
  nidSchema,
  graphSchema,
  graphLimitSchema,
  type Config,
} from '@ratlas/core';
import {
  catalog,
  publicSummary,
  repoDetail,
  seeders,
  nodeList,
  nodeDetail,
  nodeRepos,
  graphProjection,
  activity,
  history,
  sources,
  randomRepository,
  referenceTime,
  revision,
  type Db,
} from '@ratlas/db';
export function registerRoutes(app: FastifyInstance, db: Db, config: Config, now: () => number) {
  function id(request: FastifyRequest, kind: 'rid' | 'nid') {
    return (kind === 'rid' ? ridSchema : nidSchema).parse(
      (request.params as Record<string, unknown>)[kind],
    );
  }
  function route<T>(
    path: string,
    schema: z.ZodType<T>,
    response: z.ZodType,
    read: (query: T, request: FastifyRequest, at: number) => unknown,
  ) {
    app.get(path, async (request, reply) => {
      const raw = request.query as Record<string, unknown>;
      const input = { ...raw };
      if (path !== '/api/v1/sources' && input.window === undefined)
        input.window = config.presentation.observationWindow;
      if (path === '/api/v1/graph') {
        const mode =
          input.mode === 'full'
            ? 'full'
            : input.mode === 'neighborhood'
              ? 'neighborhood'
              : 'overview';
        input.vertices ??= String(config.presentation[mode].vertices);
        input.edges ??= String(config.presentation[mode].edges);
        if (input.selected !== undefined) {
          if (typeof input.selected !== 'string')
            return reply.code(400).send({ error: 'Invalid selection', requestId: request.id });
          const selected = input.selected;
          if (
            !(
              selected.startsWith('repo:')
                ? ridSchema.safeParse(selected.slice(5))
                : selected.startsWith('node:')
                  ? nidSchema.safeParse(selected.slice(5))
                  : { success: false }
            ).success
          )
            return reply.code(400).send({ error: 'Invalid selection', requestId: request.id });
        }
      }
      const parsed = schema.safeParse(input);
      if (!parsed.success)
        return reply.code(400).send({ error: 'Invalid query', requestId: request.id });
      const at = now();
      let result: unknown;
      try {
        result = db.transaction(() => read(parsed.data, request, at))();
      } catch (error) {
        if (error instanceof z.ZodError)
          return reply.code(400).send({ error: 'Invalid identifier', requestId: request.id });
        throw error;
      }
      if (result === null)
        return reply.code(404).send({
          error: 'Entity is outside the public dataset or active filters',
          requestId: request.id,
        });
      const validated = response.parse(result);
      if (path === '/api/v1/graph' && typeof result === 'object' && 'error' in result)
        return reply.code(422).send({ ...(validated as object), requestId: request.id });
      const canonical = JSON.stringify(
        Object.fromEntries(
          Object.entries(parsed.data as object).sort(([a], [b]) => a.localeCompare(b)),
        ),
      );
      const etag =
        'W/"' +
        createHash('sha256')
          .update(
            JSON.stringify([
              (result as { datasetRevision: number }).datasetRevision,
              path,
              request.params,
              canonical,
              Math.floor(referenceTime(db, at) / 15000),
            ]),
          )
          .digest('hex') +
        '"';
      reply.header('Cache-Control', 'private, max-age=0, must-revalidate').header('ETag', etag);
      if (
        request.headers['if-none-match']
          ?.split(',')
          .some(
            (value) =>
              value.trim() === '*' ||
              value.trim().replace(/^W\//u, '') === etag.replace(/^W\//u, ''),
          )
      )
        return reply.code(304).send();
      return validated;
    });
  }
  route('/api/v1/summary', filtersSchema, fullSummarySchema, (query, _request, at) =>
    publicSummary(db, query, at),
  );
  route('/api/v1/repos', catalogQuerySchema, catalogSchema, (query, _request, at) =>
    catalog(db, query, at),
  );
  route('/api/v1/repos/random', filtersSchema, randomRepoSchema, (query, _request, at) =>
    randomRepository(db, query, at),
  );
  route('/api/v1/repos/:rid', filtersSchema, repoDetailSchema, (query, request, at) =>
    repoDetail(db, id(request, 'rid'), query, config, at),
  );
  route('/api/v1/repos/:rid/seeders', catalogQuerySchema, seedersSchema, (query, request, at) =>
    repoDetail(db, id(request, 'rid'), query, config, at)
      ? seeders(db, id(request, 'rid'), query, at)
      : null,
  );
  route('/api/v1/nodes', catalogQuerySchema, nodesSchema, (query, _request, at) =>
    nodeList(db, query, at),
  );
  route('/api/v1/nodes/:nid', filtersSchema, nodeDetailSchema, (query, request, at) =>
    nodeDetail(db, id(request, 'nid'), query, at),
  );
  route('/api/v1/nodes/:nid/repos', catalogQuerySchema, nodeReposSchema, (query, request, at) =>
    nodeDetail(db, id(request, 'nid'), { ...query, q: '' }, at)
      ? nodeRepos(db, id(request, 'nid'), query, at)
      : null,
  );
  route(
    '/api/v1/graph',
    graphQuerySchema,
    z.union([graphSchema, graphLimitSchema]),
    (query, _request, at) => graphProjection(db, query, config.presentation, at),
  );
  route('/api/v1/activity', timeQuerySchema, activitySchema, (query, _request, at) =>
    activity(db, query, at),
  );
  const historyQuery = timeQuerySchema.refine(
    (query) =>
      !query.source.length &&
      (!query.from || !query.to || Date.parse(query.to) - Date.parse(query.from) <= 90 * 86400000),
    'History supports merged hourly samples up to 90 days',
  );
  route('/api/v1/history/summary', historyQuery, historySchema, (query, _request, at) =>
    history(db, query, at),
  );
  route('/api/v1/sources', emptyQuerySchema, sourcesSchema, () => ({
    items: sources(db),
    datasetRevision: revision(db),
  }));
}
