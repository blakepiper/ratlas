import { setTimeout as delay } from 'node:timers/promises';
import type { Config } from '@ratlas/core';
import {
  HttpAdapter,
  parseHttpCatalog,
  failureKind,
  AdapterError,
  HTTP_SCHEMA,
  type JsonTransport,
} from '@ratlas/radicle';

/** A bounded capability probe, not a catalog enumeration or a doctor run. */
export async function probeSource(
  source: Config['httpSources'][number],
  raw: JsonTransport,
  reserve: (task: string) => number | null,
  thirdSubject: string | null = null,
  signal = AbortSignal.timeout(60000),
) {
  let requests = 0;
  const checks: Record<string, object> = {};
  const transport: JsonTransport = {
    get: async (path, signal) => {
      if (requests >= 20) throw new AdapterError('page-limit');
      const task =
        path === 'node'
          ? 'probe'
          : path.startsWith('repos?')
            ? 'catalog'
            : path.startsWith('repos/')
              ? 'metadata'
              : path.includes(encodeURIComponent(thirdSubject ?? '\0'))
                ? 'other-inventory'
                : 'inventory';
      for (;;) {
        const until = reserve(task);
        if (until === null) break;
        if (until - Date.now() > 1000) throw new AdapterError('budget-deferred');
        await delay(Math.max(1, until - Date.now()), undefined, { signal });
      }
      requests++;
      return raw.get(path, signal);
    },
  };
  const adapter = new HttpAdapter(transport);
  async function check(name: string, action: () => Promise<object>) {
    try {
      checks[name] = await action();
    } catch (error) {
      checks[name] = { status: failureKind(error) };
    }
  }
  let observerNid: string | null = null;
  await check('identity', async () => {
    const node = await adapter.node(signal, source.expectedNid);
    observerNid = node.id;
    return { status: 'successful', observerNid, state: node.state };
  });
  if (observerNid) {
    await check('selfInventory', async () => {
      const inventory = await adapter.inventory(observerNid!, signal);
      return { status: inventory.length ? 'successful' : 'empty', count: new Set(inventory).size };
    });
    let first: ReturnType<typeof parseHttpCatalog> = [];
    await check('catalog', async () => {
      first = parseHttpCatalog(await transport.get('repos?show=all&page=0&perPage=100', signal));
      const second = parseHttpCatalog(
        await transport.get('repos?show=all&page=1&perPage=100', signal),
      );
      const ids = new Set(first.map((r) => r.rid));
      const overlap = second.filter((r) => ids.has(r.rid)).length;
      return {
        status:
          !first.length && !second.length ? 'empty' : second.length ? 'partial' : 'successful',
        pages: 2,
        records: first.length + second.length,
        publicRecords: [...first, ...second].filter((r) => r.visibility === 'public').length,
        overlap,
        termination: !second.length,
        completeDenominator: null,
        query: 'show=all; zero-based; perPage=100',
      };
    });
    const record = first.find((r) => r.visibility === 'public');
    if (record)
      await check('metadata', async () => {
        const metadata = await adapter.repo(record.rid, signal);
        return {
          status: metadata.visibility === 'public' ? 'successful' : 'quarantined',
          usableName: !!metadata.name?.trim(),
          description: !!metadata.description?.trim(),
        };
      });
    if (thirdSubject && thirdSubject !== observerNid)
      await check('thirdInventory', async () => {
        const inventory = await adapter.inventory(thirdSubject, signal);
        return {
          status: inventory.length ? 'successful' : 'empty',
          count: new Set(inventory).size,
          subjectNid: thirdSubject,
        };
      });
  }
  return {
    sourceId: source.id,
    apiBaseUrl: source.apiBaseUrl,
    observerNid,
    schema: HTTP_SCHEMA,
    checkedAt: new Date().toISOString(),
    requests,
    limit: { requests: 20, milliseconds: 60000 },
    checks,
  };
}
