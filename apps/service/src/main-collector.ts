import { parseArgs } from 'node:util';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pino from 'pino';
import { loadConfig } from './commands/config.js';
import { migrate, openWriter, summary } from '@ratlas/db';
import { Collector } from './collector/runtime.js';

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    once: { type: 'boolean', default: false },
    'duration-ms': { type: 'string' },
  },
  strict: true,
  allowPositionals: false,
});
const config = loadConfig(values.config);
if (config.mode !== 'live') throw new Error('Collection requires an explicit live configuration');
if (!config.radicle.enabled && !config.httpSources.some((s) => s.enabled)) {
  console.error('ratlas collection not run: no enabled configured sources');
  process.exitCode = 2;
} else {
  const duration = values['duration-ms'] === undefined ? null : Number(values['duration-ms']);
  if (
    duration !== null &&
    (!Number.isSafeInteger(duration) || duration < 1000 || duration > 300000)
  )
    throw new Error('Smoke duration must be 1000–300000 ms');
  process.umask(0o077);
  mkdirSync(config.logging.directory, { recursive: true, mode: 0o700 });
  const destination = pino.destination({
    dest: resolve(config.logging.directory, 'collector-' + randomUUID() + '.log'),
    sync: true,
  });
  const logger = pino({ name: 'ratlas', level: config.logging.level }, destination);
  const writer = openWriter(config.storage.databasePath);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const timer = duration === null ? undefined : setTimeout(stop, duration);
  const collector = new Collector(writer.db, config, controller.signal);
  try {
    migrate(writer.db, 'live', Date.now());
    logger.info('collection started');
    await collector.run(values.once!);
    controller.abort();
    await collector.close();
    const failed = writer.db
      .prepare(
        'SELECT COUNT(*) count FROM source_health h JOIN sources s ON s.id=h.source_id WHERE s.enabled=1 AND h.current_error IS NOT NULL',
      )
      .get() as { count: number };
    console.log(
      JSON.stringify({ kind: 'live', ...summary(writer.db), failedSources: failed.count }),
    );
    if (failed.count) process.exitCode = 1;
  } catch {
    logger.error('collection failed; previously committed state retained');
    console.error('ratlas collection failed; inspect source health and private logs');
    process.exitCode = 1;
  } finally {
    controller.abort();
    try {
      await collector.close();
    } catch {
      logger.error('collector cleanup failed');
      process.exitCode = 1;
    }
    if (timer) clearTimeout(timer);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    try {
      writer.close();
    } finally {
      destination.end();
    }
  }
}
