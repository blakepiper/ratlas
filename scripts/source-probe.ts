import { backupBeforeMigration } from '../apps/service/src/commands/migration-backup.js';
import { parseArgs } from 'node:util';
import { loadConfig } from '../apps/service/src/commands/config.js';
import { probeSource } from '../apps/service/src/collector/probe.js';
import { openWriter, migrate, registerSource, reserveRequest } from '../packages/db/dist/index.js';
import { sourceSchema, nidSchema } from '../packages/core/dist/index.js';
import { HttpTransport } from '../packages/radicle/dist/index.js';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    source: { type: 'string', multiple: true },
    subject: { type: 'string' },
  },
  strict: true,
});
const config = loadConfig(values.config);
if (config.mode !== 'live') throw new Error('Source diagnostics require live configuration');
const selected = config.httpSources.filter((s) => values.source?.includes(s.id));
if (!selected.length || values.source!.some((id) => !selected.some((s) => s.id === id)))
  throw new Error('Select configured source IDs with --source');
const subject = values.subject ? nidSchema.parse(values.subject) : null;
await backupBeforeMigration(config);
const writer = openWriter(config.storage.databasePath);
try {
  migrate(writer.db, 'live', Date.now());
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
        metadataPriority: source.metadataPriority,
        observerNid:
          (
            writer.db.prepare('SELECT observer_nid FROM sources WHERE id=?').get(source.id) as
              { observer_nid: string | null } | undefined
          )?.observer_nid ?? null,
      }),
    );
    const result = await probeSource(
      source,
      new HttpTransport(source.apiBaseUrl, config.collection),
      (task) =>
        reserveRequest(
          writer.db,
          source.id,
          new URL(source.apiBaseUrl).origin,
          task,
          Date.now(),
          config.collection,
        ),
      subject,
    );
    console.log(JSON.stringify(result));
    if (!result.observerNid) process.exitCode = 2;
  }
} finally {
  writer.close();
}
