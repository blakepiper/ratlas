import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { configPath, loadConfig } from '../apps/service/src/commands/config.js';
import {
  dataset,
  openReader,
  openWriter,
  registerSource,
  reserveRequest,
} from '../packages/db/dist/index.js';
import { sourceSchema } from '../packages/core/dist/index.js';
import {
  cliCapabilities,
  routingSnapshot,
  HttpAdapter,
  HttpTransport,
  AdapterError,
  failureKind,
} from '../packages/radicle/dist/index.js';
import { toolchainSmoke } from './toolchain-smoke.js';

const { values } = parseArgs({
  options: { config: { type: 'string' }, 'check-sources': { type: 'boolean', default: false } },
  strict: true,
  allowPositionals: false,
});
await toolchainSmoke();
if (!values.config && !process.env.RATLAS_CONFIG && !existsSync(configPath())) {
  console.log(
    'Live configuration: unconfigured. Copy and edit config/ratlas.example.json when ready.',
  );
  if (values['check-sources']) process.exitCode = 2;
} else {
  const config = loadConfig(values.config);
  console.log(
    `Configuration valid: mode=${config.mode}; local observer policy=${config.localObserverPublication}; collection not started`,
  );
  if (existsSync(config.storage.databasePath)) {
    const db = openReader(config.storage.databasePath);
    try {
      if (dataset(db).kind !== config.mode) throw new Error('Configured database mode mismatch');
      console.log('Database: readable, schema current, mode matches');
    } finally {
      db.close();
    }
  } else console.log('Database: not initialized; doctor did not create it');
  const signal = AbortSignal.timeout(60000);
  let configured = 0;
  if (config.radicle.enabled) {
    configured++;
    try {
      const capabilities = await cliCapabilities(config.radicle, signal, values['check-sources']);
      console.log(
        JSON.stringify({
          adapter: 'cli',
          ...capabilities,
          publication: config.localObserverPublication,
        }),
      );
      if (values['check-sources']) {
        let rows = 0;
        for await (const row of routingSnapshot(config, signal)) if (row.rid) rows++;
        console.log(`Configured CLI bounded snapshot: ${rows} rows; no data persisted`);
      }
    } catch (error) {
      console.log('Configured CLI check: ' + failureKind(error));
      process.exitCode = 1;
    }
  } else console.log('Local observer disabled; no personal profile accessed');
  if (values['check-sources']) {
    const httpSources = config.httpSources.filter((s) => s.enabled);
    const writer =
      httpSources.length && existsSync(config.storage.databasePath)
        ? openWriter(config.storage.databasePath)
        : null;
    try {
      if (httpSources.length && !writer) {
        console.log(
          'HTTP identity checks require an initialized database for persistent budgets; run db:migrate explicitly first',
        );
        process.exitCode = 2;
        configured += httpSources.length;
      }
      for (const source of writer ? httpSources : []) {
        configured++;
        try {
          const db = writer!.db;
          registerSource(
            db,
            sourceSchema.parse({
              id: source.id,
              label: source.label,
              adapter: 'http',
              policy: 'public-http',
              origin: new URL(source.apiBaseUrl).origin,
              enabled: source.enabled,
              metadataPriority: source.metadataPriority,
              observerNid:
                (
                  db.prepare('SELECT observer_nid FROM sources WHERE id=?').get(source.id) as
                    { observer_nid: string | null } | undefined
                )?.observer_nid ?? null,
            }),
          );
          const raw = new HttpTransport(source.apiBaseUrl, config.collection);
          const adapter = new HttpAdapter({
            get: async (path, signal) => {
              for (;;) {
                const until = reserveRequest(
                  db,
                  source.id,
                  new URL(source.apiBaseUrl).origin,
                  'probe',
                  Date.now(),
                  config.collection,
                );
                if (until === null) break;
                if (until - Date.now() > config.collection.originSpacingMs)
                  throw new AdapterError('budget-deferred');
                await delay(Math.max(1, until - Date.now()), undefined, { signal });
              }
              return raw.get(path, signal);
            },
          });
          const node = await adapter.node(signal, source.expectedNid);
          console.log(
            JSON.stringify({
              source: source.id,
              adapter: 'http',
              observerNid: node.id,
              nodeSchema: 'recognized',
              inventory: 'not-probed',
              catalog: 'not-probed',
              publication: 'public-http',
            }),
          );
        } catch (error) {
          console.log(JSON.stringify({ source: source.id, status: failureKind(error) }));
          process.exitCode = 1;
        }
      }
    } finally {
      writer?.close();
    }
    if (!configured) {
      console.log('Source checks not run: no enabled configured sources');
      process.exitCode = 2;
    }
  } else console.log('Offline doctor: HTTP sources were not contacted');
}
