import { z } from 'zod';
import { nidSchema, ridSchema } from './ids.js';

export const instantSchema = z.number().int().min(0).max(8_640_000_000_000_000);
export const windowSchema = z.enum(['24h', '7d', 'all']);
export type ObservationWindow = z.infer<typeof windowSchema>;
export const policySchema = z.enum(['quarantine', 'public-http', 'public-only-observer']);
export const sourceSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/u),
  label: z.string().min(1).max(120),
  adapter: z.enum(['synthetic', 'cli', 'http']),
  policy: policySchema,
  origin: z.string().nullable().default(null),
  observerNid: nidSchema.nullable().default(null),
  metadataPriority: z.number().int().min(0).max(1_000_000).default(100),
  enabled: z.boolean().default(true),
});
export type Source = z.infer<typeof sourceSchema>;
export const routeSchema = z.strictObject({ rid: ridSchema, nid: nidSchema });
export const observationSchema = routeSchema.extend({
  id: z.string().min(1).max(160),
  sourceId: sourceSchema.shape.id,
  kind: z.enum(['present', 'missing']),
  observedAt: instantSchema,
  announcedAt: z.unknown().optional(),
  evidence: z.enum(['event', 'snapshot', 'inventory']).default('event'),
});
export type ObservationInput = z.input<typeof observationSchema>;
export function announcementTime(value: unknown, observedAt: number, skew = 300_000) {
  if (value === undefined || value === null) return { value: null, diagnostic: null };
  const parsed = instantSchema.safeParse(value);
  if (!parsed.success || parsed.data > observedAt + skew)
    return { value: null, diagnostic: 'invalid-or-future-announcement' };
  return { value: parsed.data, diagnostic: null };
}
export function windowStart(window: ObservationWindow, reference: number): number {
  return window === 'all' ? 0 : reference - (window === '24h' ? 86_400_000 : 604_800_000);
}
export const metadataSchema = z.strictObject({
  sourceId: sourceSchema.shape.id,
  rid: ridSchema,
  name: z.string().max(255).nullable(),
  description: z.string().max(4096).nullable(),
  branch: z.string().max(255).nullable().default(null),
  delegates: z.array(z.string().max(80)).max(255).default([]),
  visibility: z.enum(['public', 'private']),
  retrievedAt: instantSchema,
  revision: z.string().max(128).nullable().default(null),
});
export const repoRowSchema = z.strictObject({
  rid: ridSchema,
  name: z.string().nullable(),
  description: z.string().nullable(),
  observedSeederCount: z.number().int().nonnegative(),
  metadataStatus: z.enum(['resolved', 'unresolved']),
  firstObservedAt: z.iso.datetime(),
  lastObservedAt: z.iso.datetime(),
  metadataSource: z.string().nullable(),
});
export const summarySchema = z.strictObject({
  mode: z.enum(['live', 'demo']),
  repositories: z.number().int().nonnegative(),
  nodeIdentities: z.number().int().nonnegative(),
  hostingRelationships: z.number().int().nonnegative(),
  evidenceSources: z.number().int().nonnegative(),
  unresolvedMetadata: z.number().int().nonnegative(),
  observationWindow: windowSchema,
  referenceTime: z.iso.datetime(),
  datasetRevision: z.number().int().nonnegative(),
});
export const repoListSchema = z.strictObject({
  items: z.array(repoRowSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  datasetRevision: z.number().int().nonnegative(),
});
export type Summary = z.infer<typeof summarySchema>;
export type RepoList = z.infer<typeof repoListSchema>;
