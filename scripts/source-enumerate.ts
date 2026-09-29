import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { loadConfig } from '../apps/service/src/commands/config.js';
import { backupBeforeMigration } from '../apps/service/src/commands/migration-backup.js';
import { openWriter, migrate, registerSource, reserveRequest } from '../packages/db/dist/index.js';
import { sourceSchema } from '../packages/core/dist/index.js';
import {
  HttpTransport,
  HttpAdapter,
  parseHttpCatalog,
  HTTP_SCHEMA,
  AdapterError,
  failureKind,
  type JsonTransport,
} from '../packages/radicle/dist/index.js';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    source: { type: 'string', multiple: true },
    kind: { type: 'string', default: 'catalog' },
    resume: { type: 'boolean', default: false },
  },
  strict: true,
});
if (!['catalog', 'inventory'].includes(values.kind!))
  throw new Error('Choose catalog or inventory');
const config = loadConfig(values.config);
const selected = config.httpSources.filter((s) => values.source?.includes(s.id));
if (
  config.mode !== 'live' ||
  !selected.length ||
  values.source!.some((id) => !selected.some((s) => s.id === id))
)
  throw new Error('Select configured public HTTP sources explicitly');
await backupBeforeMigration(config);
const writer = openWriter(config.storage.databasePath);
const signal = AbortSignal.timeout(300000);
try {
  migrate(writer.db, 'live', Date.now());
  // Serial enumeration preserves single-origin and global transport limits.
  for (const source of selected) {
    registerSource(
      writer.db,
      sourceSchema.parse({
        id: source.id,
        label: source.label,
        adapter: 'http',
        policy: 'public-http',
        origin: new URL(source.apiBaseUrl).origin,
        enabled: source.enabled,
        observerNid:
          (
            writer.db.prepare('SELECT observer_nid FROM sources WHERE id=?').get(source.id) as
              { observer_nid: string | null } | undefined
          )?.observer_nid ?? null,
        metadataPriority: source.metadataPriority,
      }),
    );
    const raw = new HttpTransport(source.apiBaseUrl, config.collection);
    const transport: JsonTransport = {
      get: async (path, signal) => {
        for (;;) {
          const until = reserveRequest(
            writer.db,
            source.id,
            new URL(source.apiBaseUrl).origin,
            'reference',
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
    };
    const adapter = new HttpAdapter(transport);
    let id: string = randomUUID();
    try {
      const node = await adapter.node(signal, source.expectedNid);
      const previous = writer.db
        .prepare('SELECT observer_nid FROM sources WHERE id=?')
        .get(source.id) as { observer_nid: string | null };
      if (previous.observer_nid && previous.observer_nid !== node.id)
        throw new AdapterError('observer-mismatch');
      const resumable = values.resume
        ? (writer.db
            .prepare(
              "SELECT id,pages FROM reference_enumerations WHERE source_id=? AND kind=? AND observer_nid=? AND schema_version=? AND status='partial' ORDER BY started_at DESC,id DESC LIMIT 1",
            )
            .get(source.id, values.kind, node.id, HTTP_SCHEMA) as
            { id: string; pages: number } | undefined)
        : undefined;
      if (resumable) {
        id = resumable.id;
        writer.db
          .prepare('UPDATE reference_enumerations SET error=NULL,ended_at=NULL WHERE id=?')
          .run(id);
      } else
        writer.db
          .prepare(
            'INSERT INTO reference_enumerations(id,source_id,kind,observer_nid,schema_version,started_at) VALUES (?,?,?,?,?,?)',
          )
          .run(id, source.id, values.kind, node.id, HTTP_SCHEMA, Date.now());
      if (values.kind === 'inventory') {
        const rids = await adapter.inventory(node.id, signal, config.collection.snapshotMaxRows);
        writer.db.transaction(() => {
          for (const rid of rids)
            writer.db
              .prepare('INSERT OR IGNORE INTO reference_members VALUES (?,?,NULL)')
              .run(id, rid);
        })();
        writer.db
          .prepare(
            "UPDATE reference_enumerations SET status='complete',pages=1,ended_at=? WHERE id=?",
          )
          .run(Date.now(), id);
      } else {
        const seenPages = new Set<string>();
        let complete = false;
        for (
          let page = resumable?.pages ?? 0;
          page < Math.ceil(config.collection.snapshotMaxRows / 100);
          page++
        ) {
          const rows = parseHttpCatalog(
            await transport.get('repos?show=all&page=' + page + '&perPage=100', signal),
          );
          const hash = createHash('sha256')
            .update(JSON.stringify(rows.map((r) => r.rid).sort()))
            .digest('hex');
          if (rows.length && seenPages.has(hash)) throw new AdapterError('repeated-page');
          seenPages.add(hash);
          writer.db.transaction(() => {
            let added = 0;
            for (const r of rows) {
              if (r.visibility === 'private') {
                writer.db
                  .prepare(
                    'UPDATE reference_enumerations SET excluded_private=excluded_private+1 WHERE id=?',
                  )
                  .run(id);
                continue;
              }
              const metadataHash = createHash('sha256')
                .update(
                  JSON.stringify([
                    r.name,
                    r.description,
                    r.branch,
                    r.delegates,
                    r.visibility,
                    r.revision,
                  ]),
                )
                .digest('hex');
              added += writer.db
                .prepare('INSERT OR IGNORE INTO reference_members VALUES (?,?,?)')
                .run(id, r.rid, metadataHash).changes;
            }
            if (rows.some((r) => r.visibility === 'public') && added === 0)
              throw new AdapterError('repeated-page');
            writer.db.prepare('UPDATE reference_enumerations SET pages=pages+1 WHERE id=?').run(id);
          })();
          if (!rows.length) {
            complete = true;
            break;
          }
        }
        if (!complete) throw new AdapterError('page-limit');
        writer.db
          .prepare("UPDATE reference_enumerations SET status='complete',ended_at=? WHERE id=?")
          .run(Date.now(), id);
      }
    } catch (error) {
      writer.db
        .prepare('UPDATE reference_enumerations SET ended_at=?,error=? WHERE id=?')
        .run(Date.now(), failureKind(error), id);
      process.exitCode = 2;
      console.log(
        JSON.stringify({
          sourceId: source.id,
          status: failureKind(error),
          reference: 'partial or unavailable',
        }),
      );
    }
    const enumeration = writer.db
      .prepare('SELECT * FROM reference_enumerations WHERE id=?')
      .get(id);
    if (enumeration)
      console.log(
        JSON.stringify({
          enumeration,
          members: (
            writer.db
              .prepare('SELECT COUNT(*) count FROM reference_members WHERE enumeration_id=?')
              .get(id) as { count: number }
          ).count,
          note: 'Independent bounded reference enumeration; --resume retains its start time and prefix across invocations. Never an atomic census. No hosting state or metadata was ingested.',
        }),
      );
  }
} finally {
  writer.close();
}
