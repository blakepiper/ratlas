import { z, nidSchema, ridSchema, normalizeNid } from '@ratlas/core';
import { AdapterError } from './errors.js';
export const CLI_SCHEMA = 'heartwood-341982110-v1';
export const HTTP_SCHEMA = 'explorer-00f079d0d9fb4828e570bc568ffde1dcd43ebb25-v1';
const routing = z.object({ rid: ridSchema, nid: nidSchema });
const seed = routing.extend({ type: z.enum(['seedDiscovered', 'seedDropped']) });
const inventory = z.object({
  type: z.literal('inventoryAnnounced'),
  nid: nidSchema,
  inventory: z.array(ridSchema).max(1000000),
  timestamp: z.unknown(),
});
const node = z.object({
  type: z.literal('nodeAnnounced'),
  nid: nidSchema,
  alias: z.string().max(255),
  timestamp: z.unknown(),
});
const events = z.union([seed, inventory, node]);
export type RadicleEvent = z.infer<typeof events>;
export function parseRoute(value: unknown) {
  return parse(routing, value);
}
export function parseEvent(value: unknown): RadicleEvent | null {
  const type = parse(z.object({ type: z.string().max(100) }), value).type;
  if (!['seedDiscovered', 'seedDropped', 'inventoryAnnounced', 'nodeAnnounced'].includes(type))
    return null;
  return parse(events, value);
}
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AdapterError('unsupported-schema');
  return result.data;
}
const did = z
  .string()
  .max(80)
  .refine((value) => {
    try {
      return value.startsWith('did:key:') && !!normalizeNid(value);
    } catch {
      return false;
    }
  });
const project = z.object({
  data: z.object({
    name: z.string().max(255).optional(),
    description: z.string().max(4096).optional(),
    defaultBranch: z.string().max(255).optional(),
  }),
  meta: z
    .object({
      head: z
        .string()
        .regex(/^[a-f0-9]{40}$/u)
        .optional(),
    })
    .optional(),
});
const repo = z.object({
  rid: ridSchema,
  payloads: z.record(z.string().max(255), z.unknown()),
  delegates: z.array(z.object({ id: did })).max(255),
  visibility: z.object({ type: z.enum(['public', 'private']) }),
});
export function parseHttpNode(value: unknown) {
  return parse(z.object({ id: nidSchema, state: z.enum(['running', 'stopped']) }), value);
}
export function parseHttpInventory(value: unknown, rowLimit = 1000000) {
  return parse(z.array(ridSchema).max(rowLimit), value);
}
export function parseHttpRepo(value: unknown) {
  const visibility = parse(
    z.object({ rid: ridSchema, visibility: z.object({ type: z.enum(['public', 'private']) }) }),
    value,
  );
  if (visibility.visibility.type === 'private')
    return {
      rid: visibility.rid,
      visibility: 'private' as const,
      name: null,
      description: null,
      branch: null,
      delegates: [],
      revision: null,
    };
  const base = parse(repo, value);
  const payload = base.payloads['xyz.radicle.project'];
  const data = payload === undefined ? null : parse(project, payload);
  // No arbitrary payloads, node addresses, project URLs, or private text retained.
  return {
    rid: base.rid,
    visibility: base.visibility.type,
    name: data?.data.name ?? null,
    description: data?.data.description ?? null,
    branch: data?.data.defaultBranch ?? null,
    delegates: base.delegates.map((entry) => entry.id),
    revision: data?.meta?.head ?? null,
  };
}
export function parseHttpCatalog(value: unknown) {
  return parse(z.array(z.unknown()).max(100), value).map(parseHttpRepo);
}
