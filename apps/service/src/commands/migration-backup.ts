import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Config } from '@ratlas/core';
import { openReader, schemaCurrent, backupDatabase } from '@ratlas/db';

export async function backupBeforeMigration(config: Config) {
  if (config.mode !== 'live' || !existsSync(config.storage.databasePath)) return;
  const reader = openReader(config.storage.databasePath, { allowMigration: true });
  let current: boolean;
  try {
    current = schemaCurrent(reader);
  } finally {
    reader.close();
  }
  if (!current) {
    const output = config.storage.databasePath + '.pre-migration-' + randomUUID() + '.sqlite';
    await backupDatabase(config.storage.databasePath, output);
    console.log('ratlas verified pre-migration backup created beside live database');
  }
}
