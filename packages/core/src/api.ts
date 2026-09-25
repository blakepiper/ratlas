import { z } from './validation.js';
import { nidSchema, ridSchema } from './ids.js';
import { repoRowSchema, windowSchema, summarySchema, sourceSchema } from './domain.js';
const count = z.number().int().nonnegative();
const iso = z.iso.datetime();
const numberQuery = (min: number, max: number, fallback: number) =>
  z
    .string()
    .regex(/^\d{1,9}$/u)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .default(fallback);
const pagination = { page: numberQuery(0, 100000, 0), limit: numberQuery(1, 200, 50) };
const filters = {
  q: z.string().max(200).default(''),
  metadata: z.enum(['all', 'resolved', 'unresolved']).default('all'),
  minSeeders: numberQuery(0, 2000000, 0),
  maxSeeders: numberQuery(0, 2000000, 2000000),
  window: windowSchema.default('24h'),
  source: z
    .string()
    .max(2048)
    .default('')
    .transform((s) => (s ? Array.from(new Set(s.split(','))).sort() : []))
    .pipe(z.array(sourceSchema.shape.id).max(64)),
  sort: z.enum(['name', 'firstObserved', 'seeders']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
};
export const filtersSchema = z
  .strictObject(filters)
  .refine((q) => q.minSeeders <= q.maxSeeders, 'Invalid seeder range');
export const catalogQuerySchema = z
  .strictObject({ ...filters, ...pagination })
  .refine((q) => q.page * q.limit <= 100000 && q.minSeeders <= q.maxSeeders, 'Invalid bounds');
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export type Filters = z.infer<typeof filtersSchema>;
export const graphQuerySchema = z
  .strictObject({
    ...filters,
    mode: z.enum(['overview', 'neighborhood', 'full']).default('overview'),
    selected: z.string().max(80).optional(),
    vertices: numberQuery(1, 25000, 2000),
    edges: numberQuery(1, 150000, 10000),
  })
  .refine((q) => q.minSeeders <= q.maxSeeders && (q.mode !== 'neighborhood' || !!q.selected));
export type GraphQuery = z.infer<typeof graphQuerySchema>;
export const timeQuerySchema = z
  .strictObject({
    ...pagination,
    source: filters.source,
    window: filters.window,
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  })
  .refine((q) => q.page * q.limit <= 100000 && (!q.from || !q.to || q.from <= q.to));
export const emptyQuerySchema = z.strictObject({});
export const capabilitiesSchema = z.object({
  schema: z.string().max(160).optional(),
  routing: z.boolean().optional(),
  events: z.boolean().optional(),
  snapshotOnly: z.boolean().optional(),
  version: z.string().max(160).optional(),
  node: z.boolean().optional(),
  inventory: z.union([z.boolean(), z.literal('pending')]).optional(),
  catalog: z.union([z.boolean(), z.literal('pending')]).optional(),
});
export const sourceViewSchema = z.strictObject({
  id: sourceSchema.shape.id,
  label: z.string(),
  adapter: z.enum(['synthetic', 'cli', 'http']),
  observerNid: nidSchema.nullable(),
  enabled: z.boolean(),
  capabilities: capabilitiesSchema,
  lastAttempt: iso.nullable(),
  lastSuccess: iso.nullable(),
  lastCompleteSnapshot: iso.nullable(),
  heartbeat: iso.nullable(),
  lastEvent: iso.nullable(),
  error: z.string().nullable(),
  retryAt: iso.nullable(),
  eventStreamStatus: z.string(),
  requestCount: count,
  parseErrors: count,
  unknownEvents: count,
  decodedBodyBytes: count,
  queueDepth: count,
  deferredJobs: count,
  partialRuns: count,
  consecutiveFailures: count,
  lastReconciliation: iso.nullable(),
  breaker: z.enum(['closed', 'open', 'half-open']),
  paused: z.boolean(),
});
export const maintenanceViewSchema = z.strictObject({
  lastPrunedAt: iso.nullable(),
  lastMeasuredAt: iso.nullable(),
  databaseBytes: count,
  walBytes: count,
  queueDepth: count,
  queueHighWater: count,
  eventBacklog: count,
  eventBacklogHighWater: count,
});
export const coverageSchema = z.strictObject({
  sources: z.array(sourceViewSchema),
  retainedHistoryFrom: iso,
  limitations: z.string(),
  collectionStatus: z.enum(['unconfigured', 'healthy', 'degraded', 'idle']),
  maintenance: maintenanceViewSchema,
});
export const fullSummarySchema = summarySchema.extend({
  coverage: coverageSchema,
  windowBucket: count,
});
const revision = { datasetRevision: count };
const page = <T extends z.ZodType>(schema: T) =>
  z.strictObject({ items: z.array(schema), total: count, page: count, limit: count, ...revision });
export const catalogSchema = page(repoRowSchema);
export const evidenceSchema = z.strictObject({
  sourceId: sourceSchema.shape.id,
  observerNid: nidSchema.nullable(),
  state: z.enum(['present', 'missing']),
  firstObservedAt: iso,
  lastObservedAt: iso,
  lastPositiveAt: iso,
  announcedAt: iso.nullable(),
  evidenceKind: z.string(),
});
export const relationshipSchema = z.strictObject({
  rid: ridSchema,
  nid: nidSchema,
  historical: z.boolean(),
  sourcesDisagree: z.boolean(),
  evidence: z.array(evidenceSchema),
});
export const seedersSchema = page(relationshipSchema);
export const nodeRowSchema = z.strictObject({
  nid: nidSchema,
  alias: z.string().nullable(),
  aliasSource: z.string().nullable(),
  observedRepositoryCount: count,
  firstObservedAt: iso,
  lastObservedAt: iso,
});
export const nodesSchema = page(nodeRowSchema);
export const metadataVariantSchema = z.strictObject({
  sourceId: sourceSchema.shape.id,
  name: z.string().nullable(),
  description: z.string().nullable(),
  branch: z.string().nullable(),
  delegates: z.array(z.string()),
  revision: z.string().nullable(),
  retrievedAt: iso,
});
export const repoDetailSchema = repoRowSchema.extend({
  branch: z.string().nullable(),
  delegates: z.array(z.string()),
  metadataRetrievedAt: iso.nullable(),
  metadataVariants: z.array(metadataVariantSchema),
  sourcesDisagree: z.boolean(),
  provenance: z.array(
    z.strictObject({
      sourceId: sourceSchema.shape.id,
      observerNid: nidSchema.nullable(),
      firstObservedAt: iso,
      lastObservedAt: iso,
    }),
  ),
  browseTargets: z.array(z.strictObject({ label: z.string(), url: z.url() })),
  ...revision,
});
export const nodeDetailSchema = nodeRowSchema.extend({
  evidenceSources: z.array(sourceSchema.shape.id),
  ...revision,
});
export const nodeReposSchema = page(repoRowSchema.extend({ relationship: relationshipSchema }));
const graphNode = z.strictObject({
  key: z.string(),
  id: z.union([ridSchema, nidSchema]),
  kind: z.enum(['repo', 'node']),
  label: z.string(),
  degree: count,
});
export const graphSchema = z
  .strictObject({
    nodes: z.array(graphNode),
    edges: z.array(
      z.strictObject({
        key: z.string(),
        source: z.string(),
        target: z.string(),
        weight: z.literal(1),
        historical: z.boolean(),
      }),
    ),
    scope: z.enum(['overview', 'neighborhood', 'full']),
    filters: z.object({
      q: z.string(),
      metadata: z.string(),
      source: z.array(z.string()),
      minSeeders: count,
      maxSeeders: count,
    }),
    observationWindow: windowSchema,
    eligibleNodeCount: count,
    eligibleEdgeCount: count,
    returnedNodeCount: count,
    returnedEdgeCount: count,
    truncated: z.boolean(),
    vertexTruncated: z.boolean(),
    edgeTruncated: z.boolean(),
    truncationReason: z.string().nullable(),
    selectionMethod: z.string(),
    ...revision,
    generatedAt: iso,
    coverage: coverageSchema,
  })
  .refine((value) => {
    const keys = new Set(value.nodes.map((node) => node.key));
    return value.edges.every((edge) => keys.has(edge.source) && keys.has(edge.target));
  }, 'Dangling graph edge');
export const graphLimitSchema = z.strictObject({
  error: z.literal('Full graph exceeds limits'),
  eligibleNodeCount: count,
  eligibleEdgeCount: count,
  limits: z.strictObject({ vertices: count, edges: count }),
  ...revision,
});
export const activityItemSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(['present', 'missing', 'gap']),
  sourceId: sourceSchema.shape.id,
  rid: ridSchema.nullable(),
  nid: nidSchema.nullable(),
  observedAt: iso,
  endedAt: iso.nullable(),
  message: z.string(),
});
export const activitySchema = page(activityItemSchema).extend({ retainedHistoryFrom: iso });
export const historySchema = z.strictObject({
  items: z.array(
    z.strictObject({
      at: iso,
      repositories: count,
      nodeIdentities: count,
      hostingRelationships: count,
      availableSources: count,
    }),
  ),
  observationWindow: windowSchema,
  scope: z.literal('public'),
  total: count,
  page: count,
  limit: count,
  definitions: z.string(),
  retainedHistoryFrom: iso,
  ...revision,
});
export const sourcesSchema = z.strictObject({ items: z.array(sourceViewSchema), ...revision });
export const randomRepoSchema = z.strictObject({ item: repoRowSchema.nullable(), ...revision });
export type SourceView = z.infer<typeof sourceViewSchema>;
